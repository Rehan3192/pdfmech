import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { zip } from "fflate";

import { pdfPageImageName, pdfToJpgPreset, type PdfToJpgQuality } from "../../domain/pdf-to-jpg";
import type { PdfToJpgInspection, PdfToJpgProcessor, PdfToJpgProgress, PdfToJpgResult } from "../../ports/pdf-to-jpg";
import { BrowserPageExtractor } from "./browser-page-extractor";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 300;
const MAX_PAGE_PIXELS = 12_000_000;

export class BrowserPdfToJpgProcessor implements PdfToJpgProcessor {
  async inspect(file: File, onProgress: (progress: PdfToJpgProgress) => void, signal?: AbortSignal): Promise<PdfToJpgInspection> {
    const result = await new BrowserPageExtractor().inspect(file, (progress) => onProgress({
      phase: "inspecting",
      completedPages: progress.completedPages,
      totalPages: progress.totalPages,
      message: progress.message,
    }), signal);
    return result;
  }

  async convert(file: File, pageIndexes: readonly number[], quality: PdfToJpgQuality, onProgress: (progress: PdfToJpgProgress) => void, signal?: AbortSignal): Promise<PdfToJpgResult> {
    assertPdfFile(file);
    if (pageIndexes.length === 0) throw new Error("Choose at least one page to convert.");
    const preset = pdfToJpgPreset(quality);
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
      const uniqueIndexes = [...new Set(pageIndexes)].sort((left, right) => left - right);
      for (const pageIndex of uniqueIndexes) {
        if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= viewer.numPages) throw new Error("A selected page is outside this PDF.");
      }
      const images: Array<{ readonly name: string; readonly bytes: Uint8Array }> = [];
      for (let index = 0; index < uniqueIndexes.length; index += 1) {
        throwIfAborted(signal);
        const pageIndex = uniqueIndexes[index]!;
        onProgress({ phase: "rendering", completedPages: index, totalPages: uniqueIndexes.length, message: `Converting page ${pageIndex + 1} (${index + 1} of ${uniqueIndexes.length})` });
        const page = await viewer.getPage(pageIndex + 1);
        try {
          const blob = await renderJpeg(page, preset.renderScale, preset.jpegQuality);
          images.push({ name: pdfPageImageName(file.name, pageIndex + 1, viewer.numPages), bytes: new Uint8Array(await blob.arrayBuffer()) });
        } finally {
          page.cleanup();
        }
      }
      throwIfAborted(signal);
      if (images.length === 1) {
        const image = images[0]!;
        const buffer = image.bytes.buffer.slice(image.bytes.byteOffset, image.bytes.byteOffset + image.bytes.byteLength) as ArrayBuffer;
        return { blob: new Blob([buffer], { type: "image/jpeg" }), downloadName: image.name, imageCount: 1, outputBytes: image.bytes.byteLength, isZip: false, quality };
      }
      onProgress({ phase: "packaging", completedPages: images.length, totalPages: images.length, message: "Packaging JPG images into a ZIP file" });
      const archive = await createZip(Object.fromEntries(images.map((image) => [image.name, image.bytes])));
      throwIfAborted(signal);
      const archiveBuffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
      return {
        blob: new Blob([archiveBuffer], { type: "application/zip" }),
        downloadName: `${file.name.replace(/\.pdf$/i, "") || "document"}-jpg-images.zip`,
        imageCount: images.length,
        outputBytes: archive.byteLength,
        isZip: true,
        quality,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Error && /larger|more than|selected|Canvas|page image/.test(error.message)) throw error;
      throw new Error(`${file.name} could not be converted. Password-protected, damaged, or unsupported PDFs are not supported.`);
    } finally {
      await task.destroy();
    }
  }
}

async function renderJpeg(page: PDFPageProxy, requestedScale: number, quality: number): Promise<Blob> {
  const sourceViewport = page.getViewport({ scale: 1 });
  const pixelLimitedScale = Math.sqrt(MAX_PAGE_PIXELS / (sourceViewport.width * sourceViewport.height));
  const viewport = page.getViewport({ scale: Math.min(requestedScale, pixelLimitedScale) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) throw new Error("Canvas rendering is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value === null ? reject(new Error("A JPG page image could not be created.")) : resolve(value), "image/jpeg", quality));
  canvas.width = 1;
  canvas.height = 1;
  return blob;
}

function createZip(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => zip(files, { level: 0 }, (error, data) => error === null ? resolve(data) : reject(error)));
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
