import { PDFDocument } from "pdf-lib";

import { signatureHeightRatio, validateSignaturePlacements, type SignaturePlacement } from "../../domain/sign-pdf";
import type { SignPdfInspection, SignPdfProcessor, SignPdfProgress, SignPdfResult } from "../../ports/sign-pdf";
import { BrowserPageExtractor } from "./browser-page-extractor";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

export class BrowserPdfSigner implements SignPdfProcessor {
  async inspect(file: File, onProgress: (progress: SignPdfProgress) => void, signal?: AbortSignal): Promise<SignPdfInspection> {
    return new BrowserPageExtractor().inspect(file, (progress) => onProgress({ phase: "inspecting", completed: progress.completedPages, total: progress.totalPages, message: progress.message }), signal);
  }

  async sign(file: File, signature: Blob, aspectRatio: number, placements: readonly SignaturePlacement[], onProgress: (progress: SignPdfProgress) => void, signal?: AbortSignal): Promise<SignPdfResult> {
    assertPdfFile(file);
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) throw new Error("Create or upload a valid signature first.");
    if (signature.size === 0 || signature.size > 10 * 1024 * 1024) throw new Error("The signature image must be between 1 byte and 10 MB.");
    const document = await loadPdf(file);
    validateSignaturePlacements(placements, document.getPageCount());
    const bytes = new Uint8Array(await signature.arrayBuffer());
    let image;
    try { image = signature.type === "image/jpeg" ? await document.embedJpg(bytes) : await document.embedPng(bytes); }
    catch { throw new Error("The signature image could not be embedded. Use a valid PNG or JPG image."); }
    for (const [index, placement] of placements.entries()) {
      throwIfAborted(signal);
      const page = document.getPage(placement.pageIndex);
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const width = placement.width * pageWidth;
      const height = signatureHeightRatio(placement.width, aspectRatio, pageWidth, pageHeight) * pageHeight;
      page.drawImage(image, { x: placement.x * pageWidth, y: pageHeight - (placement.y * pageHeight) - height, width, height });
      onProgress({ phase: "signing", completed: index + 1, total: placements.length, message: `Added signature ${index + 1} of ${placements.length}` });
    }
    throwIfAborted(signal);
    const output = new Uint8Array(await document.save({ useObjectStreams: true }));
    onProgress({ phase: "validating", completed: placements.length, total: placements.length, message: "Validating the signed PDF" });
    const validation = await PDFDocument.load(output.slice(), { updateMetadata: false });
    if (validation.getPageCount() !== document.getPageCount()) throw new Error("The signed PDF failed page-count validation.");
    return { blob: new Blob([output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer], { type: "application/pdf" }), downloadName: `${file.name.replace(/\.pdf$/i, "") || "document"}-signed.pdf`, pageCount: document.getPageCount(), signatureCount: placements.length };
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
