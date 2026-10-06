import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

import { compressionPreset, reductionPercent, type PdfCompressionLevel } from "../../domain/compress-pdf";
import type { CompressPdfInspection, CompressPdfProcessor, CompressPdfProgress, CompressPdfResult } from "../../ports/compress-pdf";
import { BrowserPageExtractor } from "./browser-page-extractor";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 300;
const MAX_PAGE_PIXELS = 8_000_000;

export class BrowserPdfCompressor implements CompressPdfProcessor {
  async inspect(file: File, onProgress: (progress: CompressPdfProgress) => void, signal?: AbortSignal): Promise<CompressPdfInspection> {
    const inspection = await new BrowserPageExtractor().inspect(file, (progress) => {
      onProgress({
        phase: "inspecting",
        completedPages: progress.completedPages,
        totalPages: progress.totalPages,
        message: progress.message,
      });
    }, signal);
    return inspection;
  }

  async compress(file: File, level: PdfCompressionLevel, onProgress: (progress: CompressPdfProgress) => void, signal?: AbortSignal): Promise<CompressPdfResult> {
    assertPdfFile(file);
    const preset = compressionPreset(level);
    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const [{ GlobalWorkerOptions, getDocument }, { default: workerUrl }] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    GlobalWorkerOptions.workerSrc = workerUrl;
    const task = getDocument({ data: sourceBytes.slice(), stopAtErrors: true, enableXfa: false });
    let viewer: PDFDocumentProxy | null = null;
    try {
      viewer = await task.promise;
      assertPageCount(viewer.numPages);
      const output = await PDFDocument.create();
      for (let pageNumber = 1; pageNumber <= viewer.numPages; pageNumber += 1) {
        throwIfAborted(signal);
        onProgress({ phase: "rendering", completedPages: pageNumber - 1, totalPages: viewer.numPages, message: `Compressing page ${pageNumber} of ${viewer.numPages}` });
        const page = await viewer.getPage(pageNumber);
        try {
          await addCompressedPage(output, page, preset.renderScale, preset.jpegQuality);
        } finally {
          page.cleanup();
        }
      }
      throwIfAborted(signal);
      onProgress({ phase: "writing", completedPages: viewer.numPages, totalPages: viewer.numPages, message: "Writing the compressed PDF" });
      const generatedBytes = new Uint8Array(await output.save({ useObjectStreams: true }));
      const wasReduced = generatedBytes.byteLength < sourceBytes.byteLength;
      const finalBytes = wasReduced ? generatedBytes : sourceBytes;
      onProgress({ phase: "validating", completedPages: viewer.numPages, totalPages: viewer.numPages, message: "Validating the compressed PDF" });
      const validation = await PDFDocument.load(finalBytes.slice());
      if (validation.getPageCount() !== viewer.numPages) throw new Error("The compressed PDF failed page-count validation.");
      const finalBuffer = finalBytes.buffer.slice(finalBytes.byteOffset, finalBytes.byteOffset + finalBytes.byteLength) as ArrayBuffer;
      return {
        blob: new Blob([finalBuffer], { type: "application/pdf" }),
        downloadName: `${file.name.replace(/\.pdf$/i, "") || "document"}-compressed.pdf`,
        pageCount: viewer.numPages,
        sourceBytes: sourceBytes.byteLength,
        outputBytes: finalBytes.byteLength,
        reductionPercent: reductionPercent(sourceBytes.byteLength, finalBytes.byteLength),
        level,
        wasReduced,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Error && /larger|more than|validation|Canvas/.test(error.message)) throw error;
      throw new Error(error instanceof Error ? error.message : "The PDF could not be compressed.");
    } finally {
      await task.destroy();
    }
  }
}

async function addCompressedPage(output: PDFDocument, page: PDFPageProxy, requestedScale: number, quality: number): Promise<void> {
  const sourceViewport = page.getViewport({ scale: 1 });
  const pixelLimitedScale = Math.sqrt(MAX_PAGE_PIXELS / (sourceViewport.width * sourceViewport.height));
  const scale = Math.min(requestedScale, pixelLimitedScale);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) throw new Error("Canvas rendering is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const jpeg = await canvasToJpeg(canvas, quality);
  canvas.width = 1;
  canvas.height = 1;
  const image = await output.embedJpg(await jpeg.arrayBuffer());
  const outputPage = output.addPage([sourceViewport.width, sourceViewport.height]);
  outputPage.drawImage(image, { x: 0, y: 0, width: sourceViewport.width, height: sourceViewport.height });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob === null ? reject(new Error("The compressed page image could not be created.")) : resolve(blob), "image/jpeg", quality));
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
