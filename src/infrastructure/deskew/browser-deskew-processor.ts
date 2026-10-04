import { PDFDocument } from "pdf-lib";
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { clampDeskewAngle, estimateDeskewAngle } from "../../domain/deskew";
import type { DeskewAdjustment, DeskewInspection, DeskewPageInspection, DeskewProcessor, DeskewProgress, DeskewResult } from "../../ports/deskew";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 300;
const ANALYSIS_MAX_EDGE = 1100;
const OUTPUT_SCALE = 2;
const OUTPUT_MAX_PIXELS = 10_000_000;

export class BrowserDeskewProcessor implements DeskewProcessor {
  async inspect(file: File, onProgress: (progress: DeskewProgress) => void, signal?: AbortSignal): Promise<DeskewInspection> {
    assertPdfFile(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const task = getDocument({ data: bytes });
    let viewer: PDFDocumentProxy | null = null;
    try {
      viewer = await task.promise;
      assertPageCount(viewer.numPages);
      const pages: DeskewPageInspection[] = [];
      for (let pageNumber = 1; pageNumber <= viewer.numPages; pageNumber += 1) {
        throwIfAborted(signal);
        onProgress({ phase: "analyzing", pageNumber, totalPages: viewer.numPages, completedPages: pageNumber - 1, message: `Analyzing page ${pageNumber} of ${viewer.numPages}` });
        const page = await viewer.getPage(pageNumber);
        try {
          pages.push(await inspectPage(page, pageNumber - 1));
        } finally {
          page.cleanup();
        }
      }
      return { fileName: file.name, byteLength: file.size, pageCount: viewer.numPages, pages };
    } catch (error) {
      if (error instanceof Error && (error.name === "AbortError" || error.message.includes("page"))) throw error;
      throw new Error(`${file.name} could not be analyzed. Password-protected or damaged PDFs are not supported.`);
    } finally {
      await task.destroy();
    }
  }

  async process(file: File, adjustments: readonly DeskewAdjustment[], onProgress: (progress: DeskewProgress) => void, signal?: AbortSignal): Promise<DeskewResult> {
    assertPdfFile(file);
    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const sourceDocument = await PDFDocument.load(sourceBytes.slice());
    const task = getDocument({ data: sourceBytes.slice() });
    let viewer: PDFDocumentProxy | null = null;
    try {
      viewer = await task.promise;
      assertPageCount(viewer.numPages);
      const angleByPage = new Map(adjustments.map((item) => [item.pageIndex, clampDeskewAngle(item.angle)]));
      const output = await PDFDocument.create();
      let correctedPageCount = 0;
      let preservedPageCount = 0;
      for (let pageIndex = 0; pageIndex < viewer.numPages; pageIndex += 1) {
        throwIfAborted(signal);
        const angle = angleByPage.get(pageIndex) ?? 0;
        onProgress({ phase: "rendering", pageNumber: pageIndex + 1, totalPages: viewer.numPages, completedPages: pageIndex, message: `Preparing page ${pageIndex + 1} of ${viewer.numPages}` });
        if (Math.abs(angle) < 0.05) {
          const [copiedPage] = await output.copyPages(sourceDocument, [pageIndex]);
          if (copiedPage === undefined) throw new Error("A PDF page could not be copied.");
          output.addPage(copiedPage);
          preservedPageCount += 1;
          continue;
        }
        const sourcePage = await viewer.getPage(pageIndex + 1);
        try {
          const viewportAtOne = sourcePage.getViewport({ scale: 1 });
          const scale = Math.min(OUTPUT_SCALE, Math.sqrt(OUTPUT_MAX_PIXELS / (viewportAtOne.width * viewportAtOne.height)));
          const viewport = sourcePage.getViewport({ scale });
          const rendered = await renderPage(sourcePage, viewport.width, viewport.height, scale);
          const corrected = rotateCanvas(rendered, angle);
          const jpeg = await canvasToJpeg(corrected, 0.92);
          const image = await output.embedJpg(await jpeg.arrayBuffer());
          const outputPage = output.addPage([viewportAtOne.width, viewportAtOne.height]);
          outputPage.drawImage(image, { x: 0, y: 0, width: viewportAtOne.width, height: viewportAtOne.height });
          correctedPageCount += 1;
        } finally {
          sourcePage.cleanup();
        }
      }
      onProgress({ phase: "writing", pageNumber: null, totalPages: viewer.numPages, completedPages: viewer.numPages, message: "Writing the corrected PDF" });
      const outputBytes = new Uint8Array(await output.save()).buffer;
      onProgress({ phase: "validating", pageNumber: null, totalPages: viewer.numPages, completedPages: viewer.numPages, message: "Validating the corrected PDF" });
      const validation = await PDFDocument.load(outputBytes);
      if (validation.getPageCount() !== viewer.numPages) throw new Error("The corrected PDF failed page-count validation.");
      return {
        blob: new Blob([outputBytes], { type: "application/pdf" }),
        downloadName: `${file.name.replace(/\.pdf$/i, "") || "document"}-deskewed.pdf`,
        correctedPageCount,
        preservedPageCount,
        pageCount: viewer.numPages,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Error && error.message.includes("validation")) throw error;
      throw new Error(error instanceof Error ? error.message : "The PDF could not be deskewed.");
    } finally {
      await task.destroy();
    }
  }
}

async function inspectPage(page: PDFPageProxy, pageIndex: number): Promise<DeskewPageInspection> {
  const viewportAtOne = page.getViewport({ scale: 1 });
  const scale = Math.min(1.5, ANALYSIS_MAX_EDGE / Math.max(viewportAtOne.width, viewportAtOne.height));
  const canvas = await renderPage(page, viewportAtOne.width * scale, viewportAtOne.height * scale, scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) throw new Error("Canvas analysis is unavailable in this browser.");
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const luminance = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let source = 0, target = 0; source < image.data.length; source += 4, target += 1) {
    const red = image.data[source] ?? 255;
    const green = image.data[source + 1] ?? 255;
    const blue = image.data[source + 2] ?? 255;
    luminance[target] = Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
  }
  return {
    pageIndex,
    width: viewportAtOne.width,
    height: viewportAtOne.height,
    suggestedAngle: estimateDeskewAngle(luminance, canvas.width, canvas.height),
    thumbnail: await createThumbnail(canvas),
  };
}

async function renderPage(page: PDFPageProxy, width: number, height: number, scale: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) throw new Error("Canvas rendering is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport: page.getViewport({ scale }) }).promise;
  return canvas;
}

function rotateCanvas(source: HTMLCanvasElement, angle: number): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const context = output.getContext("2d", { alpha: false });
  if (context === null) throw new Error("Canvas rotation is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);
  context.translate(output.width / 2, output.height / 2);
  context.rotate(angle * Math.PI / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return output;
}

async function createThumbnail(source: HTMLCanvasElement): Promise<Blob> {
  const width = Math.min(220, source.width);
  const height = Math.max(1, Math.round(source.height * width / source.width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(source, 0, 0, width, height);
  return canvasToJpeg(canvas, 0.78);
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob === null ? reject(new Error("The page image could not be created.")) : resolve(blob), "image/jpeg", quality));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new DOMException("The operation was cancelled.", "AbortError");
}

function assertPdfFile(file: File): void {
  if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 100 MB limit.`);
  if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") throw new Error(`${file.name} is not a PDF file.`);
}

function assertPageCount(pageCount: number): void {
  if (pageCount < 1) throw new Error("The PDF does not contain any pages.");
  if (pageCount > MAX_PAGE_COUNT) throw new Error(`PDFs with more than ${MAX_PAGE_COUNT} pages are not supported.`);
}
