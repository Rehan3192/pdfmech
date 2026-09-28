import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  TextRenderingMode,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSqueeze,
  setFontAndSize,
  setTextMatrix,
  setTextRenderingMode,
  showText,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageViewport,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import liberationSansRegularUrl from "pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url";
import { createWorker, OEM, type LoggerMessage } from "tesseract.js";

import { normalizeOcrText, type OcrWordBox } from "../../domain/ocr";
import type {
  OcrInspection,
  OcrInspectionPage,
  OcrPageResult,
  OcrProcessOptions,
  OcrProcessResult,
  OcrProcessor,
  OcrProgress,
} from "../../ports/ocr";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 500;
const MAX_THUMBNAILS = 50;
const USEFUL_NATIVE_CHARACTER_COUNT = 32;
const MOBILE_MAX_RASTER_PIXELS = 6_000_000;
const DESKTOP_MAX_RASTER_PIXELS = 12_000_000;
const TARGET_RENDER_SCALE = 2.5;

interface TextItemLike {
  readonly str?: string;
}

interface PageTextSummary {
  readonly text: string;
  readonly normalizedCharacterCount: number;
  readonly useful: boolean;
}

interface TesseractWordLike {
  readonly text: string;
  readonly confidence: number;
  readonly bbox: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  };
}

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

export class BrowserOcrProcessor implements OcrProcessor {
  async inspect(file: File, signal?: AbortSignal): Promise<OcrInspection> {
    assertSupportedFile(file);
    throwIfAborted(signal);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const task = createLoadingTask(bytes);
    let viewer: PDFDocumentProxy | null = null;
    try {
      viewer = await task.promise;
      await assertSupportedDocument(viewer);
      const pages: OcrInspectionPage[] = [];

      for (let pageNumber = 1; pageNumber <= viewer.numPages; pageNumber += 1) {
        throwIfAborted(signal);
        const page = await viewer.getPage(pageNumber);
        try {
          const viewport = page.getViewport({ scale: 1 });
          const summary = await summarizePageText(page);
          const thumbnail =
            pageNumber <= MAX_THUMBNAILS
              ? await renderThumbnail(page, viewport)
              : null;
          pages.push({
            pageIndex: pageNumber - 1,
            width: viewport.width,
            height: viewport.height,
            hasUsefulNativeText: summary.useful,
            thumbnail,
          });
        } finally {
          page.cleanup();
        }
      }

      return {
        fileName: file.name,
        byteLength: file.size,
        pageCount: viewer.numPages,
        pages,
      };
    } finally {
      await task.destroy();
    }
  }

  async process(
    file: File,
    options: OcrProcessOptions,
    onProgress: (progress: OcrProgress) => void,
    signal?: AbortSignal,
  ): Promise<OcrProcessResult> {
    assertSupportedFile(file);
    if (options.language !== "eng") {
      throw new Error("Only English printed-text OCR is available right now.");
    }
    if (options.pageIndexes.length === 0) {
      throw new Error("Choose at least one page to process.");
    }

    const startedAt = performance.now();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const task = createLoadingTask(bytes);
    let viewer: PDFDocumentProxy | null = null;
    let ocrWorker: OcrWorker | null = null;
    let currentPageNumber: number | null = null;
    let currentPosition = 0;
    const selectedPageCount = options.pageIndexes.length;
    const resultPages: OcrPageResult[] = [];
    let processedPageCount = 0;
    let skippedNativePageCount = 0;

    const abortWorker = () => {
      if (ocrWorker !== null) {
        void ocrWorker.terminate();
        ocrWorker = null;
      }
    };
    signal?.addEventListener("abort", abortWorker, { once: true });

    try {
      throwIfAborted(signal);
      viewer = await task.promise;
      await assertSupportedDocument(viewer);
      assertPageIndexes(options.pageIndexes, viewer.numPages);

      const outputDocument = await PDFDocument.load(bytes.slice(), {
        updateMetadata: false,
      });
      outputDocument.registerFontkit(fontkit);
      const fontBytes = new Uint8Array(
        await (await fetch(liberationSansRegularUrl)).arrayBuffer(),
      );
      const ocrFont = await outputDocument.embedFont(fontBytes, { subset: true });

      const pageSummaries = new Map<number, PageTextSummary>();
      for (const pageIndex of options.pageIndexes) {
        throwIfAborted(signal);
        const page = await viewer.getPage(pageIndex + 1);
        try {
          pageSummaries.set(pageIndex, await summarizePageText(page));
        } finally {
          page.cleanup();
        }
      }

      const pagesNeedingOcr = options.pageIndexes.filter(
        (pageIndex) => !pageSummaries.get(pageIndex)?.useful,
      );

      if (pagesNeedingOcr.length > 0) {
        emitProgress(onProgress, {
          phase: "loading-engine",
          pageNumber: null,
          totalPages: selectedPageCount,
          completedPages: 0,
          pageProgress: 0,
          overallProgress: 0.01,
          message: "Loading the private OCR engine...",
        });

        const logger = (message: LoggerMessage) => {
          if (message.status !== "recognizing text") {
            return;
          }
          const pageProgress = clamp(message.progress, 0, 1);
          emitProgress(onProgress, {
            phase: "recognizing-text",
            pageNumber: currentPageNumber,
            totalPages: selectedPageCount,
            completedPages: currentPosition,
            pageProgress,
            overallProgress: clamp(
              (currentPosition + pageProgress) / selectedPageCount,
              0,
              0.92,
            ),
            message:
              currentPageNumber === null
                ? "Recognizing text..."
                : `Recognizing text on page ${currentPageNumber}...`,
          });
        };

        ocrWorker = await createWorker("eng", OEM.LSTM_ONLY, {
          workerPath: "/ocr/worker.min.js",
          corePath: "/ocr/core",
          langPath: "/ocr/lang",
          workerBlobURL: false,
          gzip: true,
          logger,
        });
      }

      for (const [position, pageIndex] of options.pageIndexes.entries()) {
        throwIfAborted(signal);
        currentPosition = position;
        currentPageNumber = pageIndex + 1;
        const summary = pageSummaries.get(pageIndex);
        if (summary?.useful) {
          skippedNativePageCount += 1;
          resultPages.push({
            pageIndex,
            text: summary.text,
            confidence: null,
            words: [],
            source: "native",
          });
          emitProgress(onProgress, {
            phase: "rendering-page",
            pageNumber: pageIndex + 1,
            totalPages: selectedPageCount,
            completedPages: position + 1,
            pageProgress: 1,
            overallProgress: clamp(
              (position + 1) / selectedPageCount,
              0,
              0.92,
            ),
            message: `Page ${pageIndex + 1} already contains searchable text.`,
          });
          continue;
        }

        if (ocrWorker === null) {
          throw new Error("The OCR engine did not initialize.");
        }

        emitProgress(onProgress, {
          phase: "rendering-page",
          pageNumber: pageIndex + 1,
          totalPages: selectedPageCount,
          completedPages: position,
          pageProgress: 0,
          overallProgress: position / selectedPageCount,
          message: `Preparing page ${pageIndex + 1} for OCR...`,
        });

        const sourcePage = await viewer.getPage(pageIndex + 1);
        try {
          const { canvas, viewport } = await renderPageForOcr(sourcePage);
          throwIfAborted(signal);
          const recognition = await ocrWorker.recognize(
            canvas,
            {},
            { text: true, blocks: true },
          );
          throwIfAborted(signal);

          const words = collectWords(recognition.data.blocks);
          const outputPage = outputDocument.getPage(pageIndex);
          drawInvisibleTextLayer(outputPage, ocrFont, viewport, words);
          const pageText = recognition.data.text.trim();
          resultPages.push({
            pageIndex,
            text: pageText,
            confidence: recognition.data.confidence,
            words,
            source: "ocr",
          });
          processedPageCount += 1;
          canvas.width = 1;
          canvas.height = 1;
        } finally {
          sourcePage.cleanup();
        }
      }

      emitProgress(onProgress, {
        phase: "writing-pdf",
        pageNumber: null,
        totalPages: selectedPageCount,
        completedPages: selectedPageCount,
        pageProgress: 1,
        overallProgress: 0.94,
        message: "Writing the searchable text layer...",
      });
      const generatedBytes = new Uint8Array(await outputDocument.save());

      emitProgress(onProgress, {
        phase: "validating-output",
        pageNumber: null,
        totalPages: selectedPageCount,
        completedPages: selectedPageCount,
        pageProgress: 1,
        overallProgress: 0.98,
        message: "Checking that the downloaded PDF is searchable...",
      });
      await validateSearchableOutput(generatedBytes, viewer.numPages, resultPages);

      const extractedText = resultPages
        .sort((left, right) => left.pageIndex - right.pageIndex)
        .map((page) => `Page ${page.pageIndex + 1}\n${page.text}`)
        .join("\n\n");

      return {
        searchablePdf: new Blob([generatedBytes], { type: "application/pdf" }),
        extractedText: new Blob([extractedText], {
          type: "text/plain;charset=utf-8",
        }),
        pages: resultPages,
        processedPageCount,
        skippedNativePageCount,
        durationMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      if (signal?.aborted) {
        throw createAbortError();
      }
      throw error;
    } finally {
      signal?.removeEventListener("abort", abortWorker);
      if (ocrWorker !== null) {
        await ocrWorker.terminate();
      }
      await task.destroy();
    }
  }
}

function createLoadingTask(bytes: Uint8Array): PDFDocumentLoadingTask {
  return getDocument({
    data: bytes.slice(),
    stopAtErrors: true,
    enableXfa: false,
    maxImageSize: 40_000_000,
  });
}

function assertSupportedFile(file: File): void {
  if (file.size === 0) {
    throw new Error("Choose a PDF that is not empty.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("This PDF is larger than the 100 MB browser limit.");
  }
  if (!file.name.toLocaleLowerCase("en").endsWith(".pdf")) {
    throw new Error("Choose a PDF file.");
  }
}

async function assertSupportedDocument(viewer: PDFDocumentProxy): Promise<void> {
  if (viewer.numPages > MAX_PAGE_COUNT) {
    throw new Error("This PDF contains more than 500 pages.");
  }
  const signatures = await viewer.getSignatures();
  if (signatures !== null && signatures.length > 0) {
    throw new Error(
      "Digitally signed PDFs are not processed because changing them would invalidate their signatures.",
    );
  }
  const metadata = await viewer.getMetadata();
  const info = metadata.info as { readonly IsXFAPresent?: boolean };
  if (viewer.isPureXfa || info.IsXFAPresent === true) {
    throw new Error("XFA PDFs are not supported by the local OCR tool.");
  }
}

function assertPageIndexes(pageIndexes: readonly number[], pageCount: number): void {
  const unique = new Set(pageIndexes);
  if (
    unique.size !== pageIndexes.length ||
    pageIndexes.some(
      (pageIndex) =>
        !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount,
    )
  ) {
    throw new Error("The selected OCR page range is not valid for this PDF.");
  }
}

async function summarizePageText(page: PDFPageProxy): Promise<PageTextSummary> {
  const textContent = await page.getTextContent();
  const text = textContent.items
    .map((item) => (item as TextItemLike).str ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedCharacterCount = normalizeOcrText(text).replaceAll(" ", "").length;
  const useful =
    normalizedCharacterCount >= USEFUL_NATIVE_CHARACTER_COUNT &&
    text.split(/\s+/).filter(Boolean).length >= 4;
  return { text, normalizedCharacterCount, useful };
}

async function renderThumbnail(
  page: PDFPageProxy,
  baseViewport: PageViewport,
): Promise<Blob> {
  // One local preview serves both the thumbnail rail and the large review pane.
  // Rendering it at review size avoids a tiny, blurry page in the main panel.
  const scale = Math.min(0.75, 420 / Math.max(1, baseViewport.width));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) {
    throw new Error("This browser could not create a PDF preview.");
  }
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const thumbnail = await canvasToBlob(canvas, "image/webp", 0.82);
  canvas.width = 1;
  canvas.height = 1;
  return thumbnail;
}

async function renderPageForOcr(
  page: PDFPageProxy,
): Promise<{ readonly canvas: HTMLCanvasElement; readonly viewport: PageViewport }> {
  const baseViewport = page.getViewport({ scale: 1 });
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  const maxPixels = mobile
    ? MOBILE_MAX_RASTER_PIXELS
    : DESKTOP_MAX_RASTER_PIXELS;
  const safeScale = Math.sqrt(
    maxPixels / Math.max(1, baseViewport.width * baseViewport.height),
  );
  const scale = Math.max(1, Math.min(TARGET_RENDER_SCALE, safeScale));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) {
    throw new Error("This browser could not prepare a page for OCR.");
  }
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return { canvas, viewport };
}

function collectWords(
  blocks: Tesseract.Block[] | null,
): readonly OcrWordBox[] {
  if (blocks === null) {
    return [];
  }
  const words: OcrWordBox[] = [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const value of line.words as readonly TesseractWordLike[]) {
          const text = value.text.trim();
          if (text.length === 0 || value.bbox.x1 <= value.bbox.x0 || value.bbox.y1 <= value.bbox.y0) {
            continue;
          }
          words.push({
            text,
            confidence: value.confidence,
            x0: value.bbox.x0,
            y0: value.bbox.y0,
            x1: value.bbox.x1,
            y1: value.bbox.y1,
          });
        }
      }
    }
  }
  return words;
}

function drawInvisibleTextLayer(
  page: PDFPage,
  font: PDFFont,
  viewport: PageViewport,
  words: readonly OcrWordBox[],
): void {
  if (words.length === 0) {
    return;
  }
  const fontKey = page.node.newFontDictionary("OCR", font.ref);

  for (const word of words) {
    const encodedText = `${word.text} `;
    const baselineCanvasY = word.y1 - (word.y1 - word.y0) * 0.12;
    const [baseX, baseY] = viewport.convertToPdfPoint(word.x0, baselineCanvasY);
    const [rightX, rightY] = viewport.convertToPdfPoint(word.x1, baselineCanvasY);
    const [topX, topY] = viewport.convertToPdfPoint(word.x0, word.y0);
    const targetWidth = Math.hypot(rightX - baseX, rightY - baseY);
    const targetHeight = Math.hypot(topX - baseX, topY - baseY);
    const fontSize = clamp(targetHeight * 0.88, 3, 96);
    const naturalWidth = font.widthOfTextAtSize(encodedText, fontSize);
    if (naturalWidth <= 0 || targetWidth <= 0) {
      continue;
    }
    const horizontalScale = clamp((targetWidth / naturalWidth) * 100, 20, 500);
    const angle = Math.atan2(rightY - baseY, rightX - baseX);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    page.pushOperators(
      pushGraphicsState(),
      beginText(),
      setTextRenderingMode(TextRenderingMode.Invisible),
      setFontAndSize(fontKey, fontSize),
      setCharacterSqueeze(horizontalScale),
      setTextMatrix(cosine, sine, -sine, cosine, baseX, baseY),
      showText(font.encodeText(encodedText)),
      endText(),
      popGraphicsState(),
    );
  }
}

async function validateSearchableOutput(
  bytes: Uint8Array,
  expectedPageCount: number,
  pages: readonly OcrPageResult[],
): Promise<void> {
  const task = createLoadingTask(bytes);
  let viewer: PDFDocumentProxy | null = null;
  try {
    viewer = await task.promise;
    if (viewer.numPages !== expectedPageCount) {
      throw new Error("The searchable PDF failed its page-count check.");
    }

    for (const resultPage of pages.filter((page) => page.source === "ocr")) {
      const expectedWords = resultPage.words
        .map((word) => normalizeOcrText(word.text))
        .filter((word) => word.length >= 2)
        .slice(0, 12);
      if (expectedWords.length === 0) {
        continue;
      }
      const page = await viewer.getPage(resultPage.pageIndex + 1);
      try {
        const extracted = normalizeOcrText(
          (await page.getTextContent()).items
            .map((item) => (item as TextItemLike).str ?? "")
            .join(" "),
        );
        const matches = expectedWords.filter((word) => extracted.includes(word));
        if (matches.length < Math.max(1, Math.floor(expectedWords.length * 0.5))) {
          throw new Error(
            `The searchable text layer could not be verified on page ${resultPage.pageIndex + 1}.`,
          );
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await task.destroy();
  }
}

function emitProgress(
  callback: (progress: OcrProgress) => void,
  progress: OcrProgress,
): void {
  callback({
    ...progress,
    overallProgress: clamp(progress.overallProgress, 0, 1),
    pageProgress: clamp(progress.pageProgress, 0, 1),
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error("This browser could not create a page preview."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function createAbortError(): DOMException {
  return new DOMException("OCR processing was cancelled.", "AbortError");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
