import { PDFDocument } from "pdf-lib";

import { fitJpgOnPage, JPG_PDF_MARGIN_POINTS, JPG_TO_PDF_LIMITS, jpgPdfPageDimensions, type JpgPdfOptions } from "../../domain/jpg-to-pdf";
import type { JpgInspection, JpgPdfSource, JpgToPdfProcessor, JpgToPdfProgress, JpgToPdfResult } from "../../ports/jpg-to-pdf";

export class BrowserJpgToPdfProcessor implements JpgToPdfProcessor {
  async inspect(file: File, signal?: AbortSignal): Promise<JpgInspection> {
    assertJpgFile(file);
    throwIfAborted(signal);
    const dimensions = await decodeDimensions(file);
    if (dimensions.width * dimensions.height > JPG_TO_PDF_LIMITS.maxPixelsPerImage) throw new Error(`${file.name} exceeds the 50-megapixel image limit.`);
    return { fileName: file.name, byteLength: file.size, ...dimensions };
  }

  async convert(sources: readonly JpgPdfSource[], options: JpgPdfOptions, onProgress: (progress: JpgToPdfProgress) => void, signal?: AbortSignal): Promise<JpgToPdfResult> {
    validateSources(sources);
    const output = await PDFDocument.create();
    for (const [index, source] of sources.entries()) {
      throwIfAborted(signal);
      onProgress({ phase: "normalizing", completed: index, total: sources.length, message: `Preparing ${source.file.name}` });
      const normalized = await normalizeJpg(source.file);
      throwIfAborted(signal);
      const image = await output.embedJpg(normalized);
      const [pageWidth, pageHeight] = jpgPdfPageDimensions(image.width, image.height, options);
      const page = output.addPage([pageWidth, pageHeight]);
      const placement = fitJpgOnPage(image.width, image.height, pageWidth, pageHeight, JPG_PDF_MARGIN_POINTS[options.margin]);
      page.drawImage(image, placement);
      onProgress({ phase: "writing", completed: index + 1, total: sources.length, message: `Added image ${index + 1} of ${sources.length}` });
    }
    throwIfAborted(signal);
    output.setTitle(`${sources[0]?.file.name.replace(/\.(?:jpe?g)$/i, "") || "images"} images`);
    output.setCreator("PDFMech");
    const saved = new Uint8Array(await output.save({ useObjectStreams: true }));
    onProgress({ phase: "validating", completed: sources.length, total: sources.length, message: "Validating the PDF" });
    const validation = await PDFDocument.load(saved.slice(), { updateMetadata: false });
    if (validation.getPageCount() !== sources.length) throw new Error("The generated PDF failed page-count validation.");
    const buffer = saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
    return {
      blob: new Blob([buffer], { type: "application/pdf" }),
      downloadName: `${sources[0]?.file.name.replace(/\.(?:jpe?g)$/i, "") || "images"}-images.pdf`,
      pageCount: sources.length,
      outputBytes: saved.byteLength,
    };
  }
}

async function decodeDimensions(file: File): Promise<{ readonly width: number; readonly height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try { return { width: bitmap.width, height: bitmap.height }; }
    finally { bitmap.close(); }
  }
  const image = await loadHtmlImage(file);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

async function normalizeJpg(file: File): Promise<ArrayBuffer> {
  const canvas = document.createElement("canvas");
  let width: number;
  let height: number;
  let drawable: CanvasImageSource;
  let close: (() => void) | undefined;
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    width = bitmap.width;
    height = bitmap.height;
    drawable = bitmap;
    close = () => bitmap.close();
  } else {
    const image = await loadHtmlImage(file);
    width = image.naturalWidth;
    height = image.naturalHeight;
    drawable = image;
  }
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) { close?.(); throw new Error("Image conversion is unavailable in this browser."); }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(drawable, 0, 0, width, height);
  close?.();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value === null ? reject(new Error("A JPG image could not be prepared.")) : resolve(value), "image/jpeg", .94));
  canvas.width = 1;
  canvas.height = 1;
  return blob.arrayBuffer();
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name} could not be decoded as a JPG image.`)); };
    image.src = url;
  });
}

function validateSources(sources: readonly JpgPdfSource[]): void {
  if (sources.length < 1) throw new Error("Choose at least one JPG image.");
  if (sources.length > JPG_TO_PDF_LIMITS.maxFiles) throw new Error(`Choose no more than ${JPG_TO_PDF_LIMITS.maxFiles} JPG images.`);
  const totalBytes = sources.reduce((sum, source) => sum + source.file.size, 0);
  if (totalBytes > JPG_TO_PDF_LIMITS.maxTotalBytes) throw new Error("The selected images exceed the 150 MB combined limit.");
  sources.forEach((source) => assertJpgFile(source.file));
}

function assertJpgFile(file: File): void {
  if (file.size === 0) throw new Error(`${file.name || "This image"} is empty.`);
  if (file.size > JPG_TO_PDF_LIMITS.maxFileBytes) throw new Error(`${file.name} is larger than the 30 MB per-image limit.`);
  const isJpgName = /\.(?:jpe?g)$/i.test(file.name);
  const isJpgType = file.type === "image/jpeg";
  if (!isJpgName && !isJpgType) throw new Error(`${file.name} is not a JPG image.`);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new DOMException("The operation was cancelled.", "AbortError");
}
