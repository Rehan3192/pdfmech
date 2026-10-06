import { PDFDocument } from "pdf-lib";

import { MERGE_LIMITS, validateMergeFiles } from "../../domain/merge-pdf";
import type { MergePdfInspection, MergePdfProcessor, MergePdfProgress, MergePdfResult, MergePdfSource } from "../../ports/merge-pdf";

const THUMBNAIL_WIDTH = 180;

export class BrowserPdfMerger implements MergePdfProcessor {
  async inspect(file: File, onProgress: (progress: MergePdfProgress) => void, signal?: AbortSignal): Promise<MergePdfInspection> {
    assertPdfFile(file);
    throwIfAborted(signal);
    onProgress({ phase: "inspecting", completed: 0, total: 1, message: `Checking ${file.name}` });
    const [{ GlobalWorkerOptions, getDocument }, { default: workerUrl }] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    GlobalWorkerOptions.workerSrc = workerUrl;
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), stopAtErrors: true, enableXfa: false });
    try {
      const viewer = await task.promise;
      if (viewer.numPages < 1) throw new Error("The PDF does not contain any pages.");
      const page = await viewer.getPage(1);
      let thumbnail: Blob;
      let width: number;
      let height: number;
      try {
        const original = page.getViewport({ scale: 1 });
        width = original.width;
        height = original.height;
        const viewport = page.getViewport({ scale: Math.min(1, THUMBNAIL_WIDTH / original.width) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const context = canvas.getContext("2d", { alpha: false });
        if (context === null) throw new Error("A PDF preview is unavailable in this browser.");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        thumbnail = await canvasToBlob(canvas);
      } finally {
        page.cleanup();
      }
      const signatures = await viewer.getSignatures();
      onProgress({ phase: "inspecting", completed: 1, total: 1, message: `Added ${file.name}` });
      return {
        fileName: file.name,
        byteLength: file.size,
        pageCount: viewer.numPages,
        firstPageWidth: width,
        firstPageHeight: height,
        thumbnail,
        hasSignatures: signatures !== null && signatures.length > 0,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Error && /larger|empty|preview/.test(error.message)) throw error;
      throw new Error(`${file.name} could not be opened. Password-protected, damaged, or unsupported PDFs cannot be merged.`);
    } finally {
      await task.destroy();
    }
  }

  async merge(sources: readonly MergePdfSource[], onProgress: (progress: MergePdfProgress) => void, signal?: AbortSignal): Promise<MergePdfResult> {
    const totals = validateMergeFiles(sources.map((source) => ({ byteLength: source.file.size, pageCount: source.pageCount })));
    sources.forEach((source) => assertPdfFile(source.file));
    const output = await PDFDocument.create();
    let copiedPageCount = 0;
    for (const [fileIndex, source] of sources.entries()) {
      throwIfAborted(signal);
      onProgress({ phase: "copying", completed: copiedPageCount, total: totals.pageCount, message: `Copying ${source.file.name}` });
      const document = await loadPdf(source.file);
      if (document.getPageCount() !== source.pageCount) throw new Error(`${source.file.name} changed after it was selected.`);
      const pages = await output.copyPages(document, document.getPageIndices());
      pages.forEach((page) => {
        throwIfAborted(signal);
        output.addPage(page);
        copiedPageCount += 1;
        onProgress({ phase: "copying", completed: copiedPageCount, total: totals.pageCount, message: `Copied ${copiedPageCount} of ${totals.pageCount} pages` });
      });
      if (fileIndex === 0) output.setTitle(`${source.file.name.replace(/\.pdf$/i, "")} merged`);
    }
    throwIfAborted(signal);
    onProgress({ phase: "validating", completed: totals.pageCount, total: totals.pageCount, message: "Validating merged PDF" });
    const bytes = new Uint8Array(await output.save()).buffer;
    const validation = await PDFDocument.load(bytes, { updateMetadata: false });
    if (validation.getPageCount() !== totals.pageCount) throw new Error("The merged PDF failed page-count validation.");
    return {
      blob: new Blob([bytes], { type: "application/pdf" }),
      downloadName: `${sources[0]?.file.name.replace(/\.pdf$/i, "") || "merged"}-merged.pdf`,
      mergedFileCount: totals.fileCount,
      pageCount: totals.pageCount,
    };
  }
}

async function loadPdf(file: File): Promise<PDFDocument> {
  try { return await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false }); }
  catch { throw new Error(`${file.name} could not be opened. Password-protected or damaged PDFs are not supported.`); }
}

function assertPdfFile(file: File): void {
  if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`);
  if (file.size > MERGE_LIMITS.maxFileBytes) throw new Error(`${file.name} is larger than the 100 MB per-file limit.`);
  if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") throw new Error(`${file.name} is not a PDF file.`);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob === null ? reject(new Error("A PDF preview could not be created.")) : resolve(blob), "image/jpeg", .82));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new DOMException("The operation was cancelled.", "AbortError");
}
