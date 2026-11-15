import { GlobalWorkerOptions, getDocument, type PDFDocumentLoadingTask, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { stringifyCsv } from "../../domain/csv-conversion";
import type { CsvConversionProgress, PdfCsvInspection, PdfCsvOptions, PdfCsvResult, PdfToCsvProcessor } from "../../ports/csv-conversion";

GlobalWorkerOptions.workerSrc = workerUrl;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 300;

interface PositionedItem { readonly text: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
interface PositionedRow { readonly y: number; readonly items: readonly PositionedItem[]; }

export class BrowserPdfToCsvProcessor implements PdfToCsvProcessor {
  async inspect(file: File, onProgress: (progress: CsvConversionProgress) => void, signal?: AbortSignal): Promise<PdfCsvInspection> {
    assertPdf(file);
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), stopAtErrors: true, enableXfa: false });
    let viewer: PDFDocumentProxy | null = null;
    try {
      viewer = await waitForDocument(task); if (viewer.numPages > MAX_PAGES) throw new Error(`PDFs with more than ${MAX_PAGES} pages are not supported.`);
      const rows: Array<{ pageNumber: number; cells: readonly string[] }> = []; let emptyPageCount = 0; let columnCount = 0;
      for (let pageNumber = 1; pageNumber <= viewer.numPages; pageNumber += 1) {
        throwIfAborted(signal); onProgress({ message: `Detecting table rows on page ${pageNumber} of ${viewer.numPages}`, current: pageNumber, total: viewer.numPages });
        const page = await viewer.getPage(pageNumber);
        try {
          const content = await page.getTextContent({ disableNormalization: false });
          const pageRows = inferTableRows(content.items);
          if (pageRows.length === 0) emptyPageCount += 1;
          for (const cells of pageRows) { columnCount = Math.max(columnCount, cells.length); rows.push({ pageNumber, cells }); }
        } finally { page.cleanup(); }
      }
      if (rows.length === 0) throw new Error("No selectable table text was found. Run OCR PDF first if this document is scanned.");
      return { fileName: file.name, byteLength: file.size, pageCount: viewer.numPages, rows, columnCount, emptyPageCount };
    } catch (error) {
      if (error instanceof Error && (error.name === "AbortError" || /more than|No selectable/.test(error.message))) throw error;
      throw new Error(`${file.name} could not be read. Password-protected, damaged, or unsupported PDFs cannot be converted to CSV.`);
    } finally { await task.destroy(); }
  }

  convert(inspection: PdfCsvInspection, options: PdfCsvOptions): PdfCsvResult {
    let rows = inspection.rows.map((row) => ({ ...row, cells: Array.from({ length: inspection.columnCount }, (_, index) => row.cells[index] ?? "") }));
    if (options.removeEmptyRows) rows = rows.filter((row) => row.cells.some((cell) => cell.trim() !== ""));
    const table = rows.map((row) => options.includePageColumn ? [String(row.pageNumber), ...row.cells] : row.cells);
    if (options.includePageColumn) table.unshift(["Page", ...Array.from({ length: inspection.columnCount }, (_, index) => `Column ${index + 1}`)]);
    const csv = `\uFEFF${stringifyCsv(table)}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    return { blob, downloadName: `${withoutExtension(inspection.fileName)}.csv`, outputBytes: blob.size, rowCount: rows.length, columnCount: inspection.columnCount + (options.includePageColumn ? 1 : 0) };
  }
}

function inferTableRows(values: readonly unknown[]): readonly (readonly string[])[] {
  const items = values.filter(isTextItem).map((item) => ({ text: item.str.replace(/\s+/g, " ").trim(), x: item.transform[4] ?? 0, y: item.transform[5] ?? 0, width: Math.max(0, item.width), height: Math.max(1, Math.abs(item.height)) })).filter((item) => item.text !== "");
  const positionedRows: Array<{ y: number; items: PositionedItem[] }> = [];
  for (const item of items) {
    const tolerance = Math.max(2.5, Math.min(7, item.height * .48)); let row = positionedRows.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (row === undefined) { row = { y: item.y, items: [] }; positionedRows.push(row); }
    row.items.push(item);
  }
  const ordered: PositionedRow[] = positionedRows.sort((a, b) => b.y - a.y).map((row) => ({ y: row.y, items: row.items.sort((a, b) => a.x - b.x) }));
  const anchors = inferColumnAnchors(ordered);
  return ordered.map((row) => {
    if (anchors.length < 2) return row.items.map((item) => item.text);
    const cells = Array.from({ length: anchors.length }, () => "");
    for (const item of row.items) {
      let column = 0;
      for (let index = 1; index < anchors.length; index += 1) { if (item.x >= (anchors[index] ?? 0) - 7) column = index; else break; }
      cells[column] = `${cells[column]}${cells[column] === "" ? "" : " "}${item.text}`;
    }
    while (cells.length > 1 && cells[cells.length - 1] === "") cells.pop();
    return cells;
  }).filter((row) => row.some((cell) => cell.trim() !== ""));
}

function inferColumnAnchors(rows: readonly PositionedRow[]): readonly number[] {
  const clusters: Array<{ x: number; rowIndexes: Set<number> }> = [];
  rows.forEach((row, rowIndex) => row.items.forEach((item) => {
    let cluster = clusters.find((candidate) => Math.abs(candidate.x - item.x) <= 9);
    if (cluster === undefined) { cluster = { x: item.x, rowIndexes: new Set() }; clusters.push(cluster); }
    cluster.x = (cluster.x * cluster.rowIndexes.size + item.x) / (cluster.rowIndexes.size + 1); cluster.rowIndexes.add(rowIndex);
  }));
  const minimumOccurrences = Math.max(2, Math.ceil(rows.length * .2));
  const repeated = clusters.filter((cluster) => cluster.rowIndexes.size >= minimumOccurrences).sort((a, b) => a.x - b.x).map((cluster) => cluster.x);
  if (repeated.length >= 2) return repeated.slice(0, 30);
  const fallback = [...new Set(rows.flatMap((row) => row.items.map((item) => Math.round(item.x / 12) * 12)))].sort((a, b) => a - b);
  return fallback.slice(0, 30);
}

interface TextItemLike { readonly str: string; readonly transform: readonly number[]; readonly width: number; readonly height: number; }
function isTextItem(value: unknown): value is TextItemLike { if (typeof value !== "object" || value === null) return false; const item = value as Partial<TextItemLike>; return typeof item.str === "string" && Array.isArray(item.transform) && typeof item.width === "number" && typeof item.height === "number"; }
async function waitForDocument(task: PDFDocumentLoadingTask): Promise<PDFDocumentProxy> { let rejected = false; task.onPassword = () => { rejected = true; void task.destroy(); }; try { return await task.promise; } catch (error) { if (rejected) throw new Error("Password-protected PDFs are not supported."); throw error; } }
function assertPdf(file: File): void { if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`); if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 100 MB limit.`); if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") throw new Error("Choose a PDF file."); }
function withoutExtension(fileName: string): string { return fileName.replace(/\.pdf$/i, "") || "extracted-table"; }
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted === true) throw new DOMException("The extraction was cancelled.", "AbortError"); }
