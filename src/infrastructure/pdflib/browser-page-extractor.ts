import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";

import type { ExtractPagePreview, ExtractPagesInspection, ExtractPagesProcessor, ExtractPagesProgress, ExtractPagesResult } from "../../ports/extract-pages";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 300;
const THUMBNAIL_WIDTH = 180;

export class BrowserPageExtractor implements ExtractPagesProcessor {
  async inspect(file: File, onProgress: (progress: ExtractPagesProgress) => void, signal?: AbortSignal): Promise<ExtractPagesInspection> {
    assertPdfFile(file);
    const [{ GlobalWorkerOptions, getDocument }, { default: workerUrl }] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    GlobalWorkerOptions.workerSrc = workerUrl;
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), stopAtErrors: true, enableXfa: false });
    let viewer: PDFDocumentProxy | null = null;
    try {
      viewer = await task.promise;
      assertPageCount(viewer.numPages);
      const pages: ExtractPagePreview[] = [];
      for (let pageNumber = 1; pageNumber <= viewer.numPages; pageNumber += 1) {
        throwIfAborted(signal);
        onProgress({ phase: "inspecting", completedPages: pageNumber - 1, totalPages: viewer.numPages, message: `Preparing page ${pageNumber} of ${viewer.numPages}` });
        const page = await viewer.getPage(pageNumber);
        try {
          const viewportAtOne = page.getViewport({ scale: 1 });
          const scale = Math.min(1, THUMBNAIL_WIDTH / viewportAtOne.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(viewport.width));
          canvas.height = Math.max(1, Math.round(viewport.height));
          const context = canvas.getContext("2d", { alpha: false });
          if (context === null) throw new Error("Page preview is unavailable in this browser.");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          pages.push({ pageIndex: pageNumber - 1, width: viewportAtOne.width, height: viewportAtOne.height, thumbnail: await canvasToBlob(canvas) });
        } finally {
          page.cleanup();
        }
      }
      const signatures = await viewer.getSignatures();
      return { fileName: file.name, byteLength: file.size, pageCount: viewer.numPages, hasSignatures: signatures !== null && signatures.length > 0, pages };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Error && /larger|more than|preview/.test(error.message)) throw error;
      throw new Error(`${file.name} could not be opened. Password-protected, damaged, or unsupported PDFs cannot be extracted.`);
    } finally {
      await task.destroy();
    }
  }

  async extract(file: File, pageIndexes: readonly number[], onProgress: (progress: ExtractPagesProgress) => void, signal?: AbortSignal): Promise<ExtractPagesResult> {
    assertPdfFile(file);
    if (pageIndexes.length === 0) throw new Error("Choose at least one page to extract.");
    const source = await loadPdf(file);
    assertPageCount(source.getPageCount());
    const uniqueIndexes = [...new Set(pageIndexes)].sort((left, right) => left - right);
    for (const pageIndex of uniqueIndexes) {
      if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= source.getPageCount()) throw new Error("A selected page is outside this PDF.");
    }
    throwIfAborted(signal);
    onProgress({ phase: "copying", completedPages: 0, totalPages: uniqueIndexes.length, message: `Copying ${uniqueIndexes.length} selected page${uniqueIndexes.length === 1 ? "" : "s"}` });
    const output = await PDFDocument.create();
    const copiedPages = await output.copyPages(source, uniqueIndexes);
    copiedPages.forEach((page, index) => {
      throwIfAborted(signal);
      output.addPage(page);
      onProgress({ phase: "copying", completedPages: index + 1, totalPages: uniqueIndexes.length, message: `Copied page ${index + 1} of ${uniqueIndexes.length}` });
    });
    const bytes = new Uint8Array(await output.save()).buffer;
    onProgress({ phase: "validating", completedPages: uniqueIndexes.length, totalPages: uniqueIndexes.length, message: "Validating extracted PDF" });
    const validation = await PDFDocument.load(bytes);
    if (validation.getPageCount() !== uniqueIndexes.length) throw new Error("The extracted PDF failed page-count validation.");
    return { blob: new Blob([bytes], { type: "application/pdf" }), downloadName: `${file.name.replace(/\.pdf$/i, "") || "document"}-extracted-pages.pdf`, extractedPageCount: uniqueIndexes.length };
  }
}

async function loadPdf(file: File): Promise<PDFDocument> {
  try { return await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false }); }
  catch { throw new Error(`${file.name} could not be opened. Password-protected or damaged PDFs are not supported.`); }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob === null ? reject(new Error("A page preview could not be created.")) : resolve(blob), "image/jpeg", .8));
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
