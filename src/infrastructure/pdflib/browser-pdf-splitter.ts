import { zip } from "fflate";
import { PDFDocument } from "pdf-lib";

import { BrowserPageExtractor } from "./browser-page-extractor";
import type { SplitPageGroup } from "../../domain/split-pdf";
import type { SplitPdfInspection, SplitPdfProcessor, SplitPdfProgress, SplitPdfResult } from "../../ports/split-pdf";

export class BrowserPdfSplitter implements SplitPdfProcessor {
  private readonly inspector = new BrowserPageExtractor();

  inspect(file: File, onProgress: (progress: SplitPdfProgress) => void, signal?: AbortSignal): Promise<SplitPdfInspection> {
    return this.inspector.inspect(file, onProgress, signal);
  }

  async split(file: File, groups: readonly SplitPageGroup[], onProgress: (progress: SplitPdfProgress) => void, signal?: AbortSignal): Promise<SplitPdfResult> {
    if (groups.length < 2) throw new Error("Choose at least two output ranges.");
    throwIfAborted(signal);
    let source: PDFDocument;
    try {
      source = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    } catch {
      throw new Error(`${file.name} could not be opened. Password-protected or damaged PDFs are not supported.`);
    }

    const totalPages = groups.reduce((total, group) => total + group.pageIndexes.length, 0);
    let completedPages = 0;
    const baseName = sanitizeBaseName(file.name);
    const outputs: Array<{ bytes: Uint8Array; downloadName: string; label: string; pageCount: number }> = [];

    for (const [groupIndex, group] of groups.entries()) {
      validateGroup(group, source.getPageCount());
      throwIfAborted(signal);
      onProgress({ phase: "copying", completedPages, totalPages, message: `Creating file ${groupIndex + 1} of ${groups.length}` });
      const output = await PDFDocument.create();
      const pages = await output.copyPages(source, [...group.pageIndexes]);
      for (const page of pages) {
        throwIfAborted(signal);
        output.addPage(page);
        completedPages += 1;
        onProgress({ phase: "copying", completedPages, totalPages, message: `Copied page ${completedPages} of ${totalPages}` });
      }
      const bytes = await output.save();
      const validation = await PDFDocument.load(bytes);
      if (validation.getPageCount() !== group.pageIndexes.length) throw new Error(`Output range ${group.label} failed validation.`);
      outputs.push({ bytes, downloadName: `${baseName}-pages-${group.label}.pdf`, label: group.label, pageCount: group.pageIndexes.length });
    }

    throwIfAborted(signal);
    onProgress({ phase: "packaging", completedPages: totalPages, totalPages, message: "Packaging split PDFs" });
    const zipInput = Object.fromEntries(outputs.map((output) => [output.downloadName, output.bytes]));
    const zipBytes = await createZip(zipInput);
    throwIfAborted(signal);
    onProgress({ phase: "validating", completedPages: totalPages, totalPages, message: "Split PDFs are ready" });

    return {
      files: outputs.map((output) => ({
        blob: new Blob([toArrayBuffer(output.bytes)], { type: "application/pdf" }),
        downloadName: output.downloadName,
        label: output.label,
        pageCount: output.pageCount,
      })),
      zipBlob: new Blob([toArrayBuffer(zipBytes)], { type: "application/zip" }),
      zipDownloadName: `${baseName}-split-pdfs.zip`,
      outputCount: outputs.length,
      pageCount: totalPages,
    };
  }
}

function createZip(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 0 }, (error, data) => error === null ? resolve(data) : reject(error));
  });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function validateGroup(group: SplitPageGroup, pageCount: number): void {
  if (group.pageIndexes.length === 0) throw new Error("An output range cannot be empty.");
  for (const pageIndex of group.pageIndexes) {
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount) throw new Error(`Output range ${group.label} contains a page outside this PDF.`);
  }
}

function sanitizeBaseName(fileName: string): string {
  return (fileName.replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "document").slice(0, 100);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new DOMException("The operation was cancelled.", "AbortError");
}
