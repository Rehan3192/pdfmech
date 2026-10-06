import { PDFDocument, PDFName } from "pdf-lib";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

import { isValidRedaction, redactedPageCount, type PdfRedaction } from "../../domain/redact-pdf";
import type { RedactPdfInspection, RedactPdfProcessor, RedactPdfProgress, RedactPdfResult } from "../../ports/redact-pdf";
import { BrowserPageExtractor } from "./browser-page-extractor";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 300;
const PREVIEW_WIDTH = 1100;
const OUTPUT_SCALE = 2;
const OUTPUT_MAX_PIXELS = 10_000_000;

export class BrowserPdfRedactor implements RedactPdfProcessor {
  async inspect(file: File, onProgress: (progress: RedactPdfProgress) => void, signal?: AbortSignal): Promise<RedactPdfInspection> {
    const inspection = await new BrowserPageExtractor().inspect(file, (progress) => onProgress({ phase: "inspecting", completedPages: progress.completedPages, totalPages: progress.totalPages, message: progress.message }), signal);
    return inspection;
  }

  async renderPreview(file: File, pageIndex: number, signal?: AbortSignal): Promise<Blob> {
    assertPdfFile(file);
    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const task = await createLoadingTask(sourceBytes);
    let viewer: PDFDocumentProxy | null = null;
    try {
      viewer = await task.promise;
      assertPageCount(viewer.numPages);
      if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= viewer.numPages) throw new Error("The selected page is outside this PDF.");
      throwIfAborted(signal);
      const page = await viewer.getPage(pageIndex + 1);
      try {
        const atOne = page.getViewport({ scale: 1 });
        const scale = Math.min(2, PREVIEW_WIDTH / atOne.width);
        const canvas = await renderPage(page, scale);
        const blob = await canvasToJpeg(canvas, 0.9);
        canvas.width = 1;
        canvas.height = 1;
        return blob;
      } finally {
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
  }

  async redact(file: File, redactions: readonly PdfRedaction[], onProgress: (progress: RedactPdfProgress) => void, signal?: AbortSignal): Promise<RedactPdfResult> {
    assertPdfFile(file);
    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const sourceDocument = await PDFDocument.load(sourceBytes.slice(), { updateMetadata: false });
    const pageCount = sourceDocument.getPageCount();
    assertPageCount(pageCount);
    if (redactions.length === 0) throw new Error("Draw at least one redaction area before creating the PDF.");
    if (redactions.some((redaction) => !isValidRedaction(redaction, pageCount))) throw new Error("One or more redaction areas are outside the document pages.");
    const redactionsByPage = new Map<number, PdfRedaction[]>();
    for (const redaction of redactions) {
      const pageRedactions = redactionsByPage.get(redaction.pageIndex) ?? [];
      pageRedactions.push(redaction);
      redactionsByPage.set(redaction.pageIndex, pageRedactions);
    }
    const task = await createLoadingTask(sourceBytes.slice());
    let viewer: PDFDocumentProxy | null = null;
    try {
      viewer = await task.promise;
      if (viewer.numPages !== pageCount) throw new Error("The source PDF page count could not be verified.");
      const output = await PDFDocument.create();
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        throwIfAborted(signal);
        const pageRedactions = redactionsByPage.get(pageIndex);
        if (pageRedactions === undefined) {
          onProgress({ phase: "copying", completedPages: pageIndex, totalPages: pageCount, message: `Preserving page ${pageIndex + 1} of ${pageCount}` });
          const [copiedPage] = await output.copyPages(sourceDocument, [pageIndex]);
          if (copiedPage === undefined) throw new Error("A PDF page could not be copied.");
          copiedPage.node.delete(PDFName.of("Annots"));
          copiedPage.node.delete(PDFName.of("AA"));
          output.addPage(copiedPage);
          continue;
        }
        onProgress({ phase: "rendering", completedPages: pageIndex, totalPages: pageCount, message: `Permanently redacting page ${pageIndex + 1} of ${pageCount}` });
        const page = await viewer.getPage(pageIndex + 1);
        try {
          await addRedactedPage(output, page, pageRedactions);
        } finally {
          page.cleanup();
        }
      }
      throwIfAborted(signal);
      onProgress({ phase: "writing", completedPages: pageCount, totalPages: pageCount, message: "Writing the redacted PDF" });
      const bytes = new Uint8Array(await output.save({ useObjectStreams: true }));
      onProgress({ phase: "validating", completedPages: pageCount, totalPages: pageCount, message: "Validating the redacted PDF" });
      const validation = await PDFDocument.load(bytes.slice());
      if (validation.getPageCount() !== pageCount) throw new Error("The redacted PDF failed page-count validation.");
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const changedPages = redactedPageCount(redactions);
      return {
        blob: new Blob([buffer], { type: "application/pdf" }),
        downloadName: `${file.name.replace(/\.pdf$/i, "") || "document"}-redacted.pdf`,
        pageCount,
        redactionCount: redactions.length,
        redactedPageCount: changedPages,
        preservedPageCount: pageCount - changedPages,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new Error(error instanceof Error ? error.message : "The PDF could not be redacted.");
    } finally {
      await task.destroy();
    }
  }
}

async function addRedactedPage(output: PDFDocument, page: PDFPageProxy, redactions: readonly PdfRedaction[]): Promise<void> {
  const atOne = page.getViewport({ scale: 1 });
  const scale = Math.min(OUTPUT_SCALE, Math.sqrt(OUTPUT_MAX_PIXELS / (atOne.width * atOne.height)));
  const canvas = await renderPage(page, scale);
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) throw new Error("Canvas redaction is unavailable in this browser.");
  context.fillStyle = "#000000";
  for (const redaction of redactions) {
    const x = Math.max(0, Math.floor(redaction.x * canvas.width) - 2);
    const y = Math.max(0, Math.floor(redaction.y * canvas.height) - 2);
    const width = Math.min(canvas.width - x, Math.ceil(redaction.width * canvas.width) + 4);
    const height = Math.min(canvas.height - y, Math.ceil(redaction.height * canvas.height) + 4);
    context.fillRect(x, y, width, height);
  }
  const jpeg = await canvasToJpeg(canvas, 0.94);
  canvas.width = 1;
  canvas.height = 1;
  const image = await output.embedJpg(await jpeg.arrayBuffer());
  const outputPage = output.addPage([atOne.width, atOne.height]);
  outputPage.drawImage(image, { x: 0, y: 0, width: atOne.width, height: atOne.height });
}

async function createLoadingTask(bytes: Uint8Array) {
  const [{ GlobalWorkerOptions, getDocument }, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrl;
  return getDocument({ data: bytes, stopAtErrors: true, enableXfa: false });
}

async function renderPage(page: PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) throw new Error("Canvas rendering is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob === null ? reject(new Error("A redacted page image could not be created.")) : resolve(blob), "image/jpeg", quality));
}

function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted === true) throw new DOMException("The operation was cancelled.", "AbortError"); }
function assertPdfFile(file: File): void {
  if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 100 MB limit.`);
  if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") throw new Error(`${file.name} is not a PDF file.`);
}
function assertPageCount(pageCount: number): void {
  if (pageCount < 1) throw new Error("The PDF does not contain any pages.");
  if (pageCount > MAX_PAGE_COUNT) throw new Error(`PDFs with more than ${MAX_PAGE_COUNT} pages are not supported.`);
}
