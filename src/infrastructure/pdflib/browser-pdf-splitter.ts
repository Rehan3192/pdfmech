import { unzipSync, zip } from "fflate";
import { PDFDocument } from "pdf-lib";

import { BrowserPageExtractor } from "./browser-page-extractor";
import type { SplitPageGroup } from "../../domain/split-pdf";
import { normalizePdfFilename } from "../../domain/split-rename";
import type { SplitPdfInspection, SplitPdfOptions, SplitPdfProcessor, SplitPdfProgress, SplitPdfResult } from "../../ports/split-pdf";

export class BrowserPdfSplitter implements SplitPdfProcessor {
  private readonly inspector = new BrowserPageExtractor();
  constructor(private readonly zipBuilder: (files: Record<string, Uint8Array>) => Promise<Uint8Array> = createZip) {}

  inspect(file: File, onProgress: (progress: SplitPdfProgress) => void, signal?: AbortSignal): Promise<SplitPdfInspection> {
    return this.inspector.inspect(file, onProgress, signal);
  }

  async split(file: File, groups: readonly SplitPageGroup[], onProgress: (progress: SplitPdfProgress) => void, signal?: AbortSignal, options: SplitPdfOptions = {}): Promise<SplitPdfResult> {
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
    const outputs: Array<{ bytes: Uint8Array; downloadName: string; label: string; pageCount: number; sourcePageIndexes: readonly number[] }> = [];
    const outputNames = groups.map((group) => group.outputName === undefined
      ? `${baseName}-pages-${group.label}.pdf`
      : normalizePdfFilename(group.outputName).filename);
    if (outputNames.some((name) => name === "")) throw new Error("Every output group needs a valid filename.");
    const uniqueNames = new Set(outputNames.map((name) => name.toLocaleLowerCase("en")));
    if (uniqueNames.size !== outputNames.length) throw new Error("Two or more output files have the same filename.");

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
      validateOutputPages(source, validation, group);
      outputs.push({ bytes, downloadName: outputNames[groupIndex]!, label: group.label, pageCount: group.pageIndexes.length, sourcePageIndexes: [...group.pageIndexes] });
      await yieldToBrowser();
    }

    throwIfAborted(signal);
    onProgress({ phase: "packaging", completedPages: totalPages, totalPages, message: "Packaging split PDFs" });
    const manifestName = normalizeManifestName(options.manifestName ?? `${baseName}-split-manifest.csv`);
    const manifestBytes = options.includeManifest === true ? new TextEncoder().encode(createManifest(outputs)) : undefined;
    const zipInput: Record<string, Uint8Array> = Object.fromEntries(outputs.map((output) => [output.downloadName, output.bytes]));
    if (manifestBytes !== undefined) zipInput[manifestName] = manifestBytes;
    const zipBytes = await this.zipBuilder(zipInput);
    validateArchive(zipBytes, zipInput);
    throwIfAborted(signal);
    onProgress({ phase: "validating", completedPages: totalPages, totalPages, message: "Split PDFs are ready" });

    return {
      files: outputs.map((output) => ({
        blob: new Blob([toArrayBuffer(output.bytes)], { type: "application/pdf" }),
        downloadName: output.downloadName,
        label: output.label,
        pageCount: output.pageCount,
        sourcePageIndexes: output.sourcePageIndexes,
      })),
      zipBlob: new Blob([toArrayBuffer(zipBytes)], { type: "application/zip" }),
      zipDownloadName: `${baseName}-split-pdfs.zip`,
      outputCount: outputs.length,
      pageCount: totalPages,
      ...(manifestBytes === undefined ? {} : {
        manifestBlob: new Blob([toArrayBuffer(manifestBytes)], { type: "text/csv;charset=utf-8" }),
        manifestDownloadName: manifestName,
      }),
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

function validateOutputPages(source: PDFDocument, output: PDFDocument, group: SplitPageGroup): void {
  const pages = output.getPages();
  if (pages.length !== group.pageIndexes.length) throw new Error(`Output range ${group.label} failed page-count validation.`);
  pages.forEach((page, index) => {
    const sourcePage = source.getPage(group.pageIndexes[index]!);
    const sameSize = Math.abs(page.getWidth() - sourcePage.getWidth()) < 0.01 && Math.abs(page.getHeight() - sourcePage.getHeight()) < 0.01;
    const sameRotation = page.getRotation().angle === sourcePage.getRotation().angle;
    if (!sameSize || !sameRotation) throw new Error(`Output range ${group.label} failed source-page integrity validation.`);
  });
}

function createManifest(outputs: readonly { downloadName: string; label: string; pageCount: number; sourcePageIndexes: readonly number[] }[]): string {
  const rows = ["output_file,source_pages,page_count,integrity_status"];
  outputs.forEach((output) => rows.push([
    csvCell(output.downloadName),
    csvCell(output.sourcePageIndexes.map((index) => index + 1).join(";")),
    String(output.pageCount),
    "verified",
  ].join(",")));
  return `${rows.join("\r\n")}\r\n`;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function normalizeManifestName(value: string): string {
  const normalized = value.replace(/\.csv$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "split-manifest";
  return `${normalized.slice(0, 120)}.csv`;
}

function validateArchive(bytes: Uint8Array, expected: Readonly<Record<string, Uint8Array>>): void {
  let archive: Record<string, Uint8Array>;
  try { archive = unzipSync(bytes); }
  catch { throw new Error("The ZIP archive could not be verified. No successful export was reported."); }
  const expectedNames = Object.keys(expected).sort();
  const archiveNames = Object.keys(archive).sort();
  if (JSON.stringify(expectedNames) !== JSON.stringify(archiveNames)) throw new Error("The ZIP archive is missing one or more expected files.");
  expectedNames.forEach((name) => {
    if ((archive[name]?.byteLength ?? 0) === 0) throw new Error(`The ZIP entry ${name} is empty.`);
  });
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function sanitizeBaseName(fileName: string): string {
  return (fileName.replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "document").slice(0, 100);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new DOMException("The operation was cancelled.", "AbortError");
}
