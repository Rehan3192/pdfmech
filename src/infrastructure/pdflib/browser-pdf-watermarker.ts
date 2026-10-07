import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

import { parseHexColor, validateWatermarkText, watermarkPlacement, type WatermarkOptions } from "../../domain/watermark-pdf";
import type { WatermarkInspection, WatermarkPdfProcessor, WatermarkProgress, WatermarkResult } from "../../ports/watermark-pdf";
import { BrowserPageExtractor } from "./browser-page-extractor";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 300;

export class BrowserPdfWatermarker implements WatermarkPdfProcessor {
  async inspect(file: File, onProgress: (progress: WatermarkProgress) => void, signal?: AbortSignal): Promise<WatermarkInspection> {
    const result = await new BrowserPageExtractor().inspect(file, (progress) => onProgress({ phase: "inspecting", completedPages: progress.completedPages, totalPages: progress.totalPages, message: progress.message }), signal);
    return result;
  }

  async apply(file: File, options: WatermarkOptions, onProgress: (progress: WatermarkProgress) => void, signal?: AbortSignal): Promise<WatermarkResult> {
    assertPdfFile(file);
    const text = validateWatermarkText(options.text);
    if (!Number.isFinite(options.fontSize) || options.fontSize < 12 || options.fontSize > 144) throw new Error("Choose a watermark size from 12 to 144 points.");
    if (!Number.isFinite(options.opacity) || options.opacity < .05 || options.opacity > 1) throw new Error("Choose watermark opacity from 5% to 100%.");
    const [red, green, blue] = parseHexColor(options.color);
    const source = await loadPdf(file);
    const pageCount = source.getPageCount();
    if (pageCount < 1 || pageCount > MAX_PAGE_COUNT) throw new Error(`PDFs must contain 1 to ${MAX_PAGE_COUNT} pages.`);
    const selected = [...new Set(options.pageIndexes)].sort((left, right) => left - right);
    if (selected.length === 0) throw new Error("Choose at least one page to watermark.");
    if (selected.some((index) => !Number.isInteger(index) || index < 0 || index >= pageCount)) throw new Error("A selected watermark page is outside this PDF.");
    const font = await source.embedFont(StandardFonts.HelveticaBold);
    const textWidth = font.widthOfTextAtSize(text, options.fontSize);
    const textHeight = options.fontSize;
    for (const [completed, pageIndex] of selected.entries()) {
      throwIfAborted(signal);
      const page = source.getPage(pageIndex);
      const { width, height } = page.getSize();
      const placement = watermarkPlacement(width, height, textWidth, textHeight, options.rotation, options.position);
      page.drawText(text, { ...placement, size: options.fontSize, font, color: rgb(red, green, blue), opacity: options.opacity, rotate: degrees(options.rotation) });
      onProgress({ phase: "applying", completedPages: completed + 1, totalPages: selected.length, message: `Watermarked page ${pageIndex + 1} (${completed + 1} of ${selected.length})` });
    }
    throwIfAborted(signal);
    const saved = new Uint8Array(await source.save({ useObjectStreams: true }));
    onProgress({ phase: "validating", completedPages: selected.length, totalPages: selected.length, message: "Validating the watermarked PDF" });
    const validation = await PDFDocument.load(saved.slice(), { updateMetadata: false });
    if (validation.getPageCount() !== pageCount) throw new Error("The watermarked PDF failed page-count validation.");
    const buffer = saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
    return { blob: new Blob([buffer], { type: "application/pdf" }), downloadName: `${file.name.replace(/\.pdf$/i, "") || "document"}-watermarked.pdf`, pageCount, watermarkedPageCount: selected.length };
  }
}

async function loadPdf(file: File): Promise<PDFDocument> {
  try { return await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false }); }
  catch { throw new Error(`${file.name} could not be opened. Password-protected or damaged PDFs are not supported.`); }
}
function assertPdfFile(file: File): void {
  if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 100 MB limit.`);
  if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") throw new Error(`${file.name} is not a PDF file.`);
}
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted === true) throw new DOMException("The operation was cancelled.", "AbortError"); }
