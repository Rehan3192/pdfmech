import "regenerator-runtime/runtime.js";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import liberationSansBoldUrl from "pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url";
import liberationSansRegularUrl from "pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url";

import { parseCsv } from "../../domain/csv-conversion";
import type { CsvConversionProgress, CsvInspection, CsvPdfOptions, CsvPdfResult, CsvToPdfProcessor } from "../../ports/csv-conversion";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const DENSITY = { compact: { size: 7, padding: 3 }, balanced: { size: 8.5, padding: 4 }, large: { size: 10, padding: 5 } } as const;

export class BrowserCsvToPdfProcessor implements CsvToPdfProcessor {
  async inspect(file: File, onProgress: (progress: CsvConversionProgress) => void, signal?: AbortSignal): Promise<CsvInspection> {
    assertCsv(file); throwIfAborted(signal); onProgress({ message: "Reading the CSV table" });
    const parsed = parseCsv(await file.text());
    return { fileName: file.name, byteLength: file.size, delimiter: parsed.delimiter, rows: parsed.rows, rowCount: parsed.rows.length, columnCount: parsed.columnCount };
  }

  async convert(inspection: CsvInspection, options: CsvPdfOptions, onProgress: (progress: CsvConversionProgress) => void, signal?: AbortSignal): Promise<CsvPdfResult> {
    throwIfAborted(signal); onProgress({ message: "Preparing the table layout" });
    const document = await PDFDocument.create(); document.registerFontkit(fontkit);
    const [regular, bold] = await Promise.all([embedFont(document, liberationSansRegularUrl), embedFont(document, liberationSansBoldUrl)]);
    const base = PAGE_SIZES[options.pageSize]; const [width, height] = options.orientation === "portrait" ? base : [base[1], base[0]];
    const margin = 30; const tableWidth = width - margin * 2; const columnWidth = tableWidth / inspection.columnCount;
    const style = DENSITY[options.density]; const maxLines = options.density === "large" ? 5 : 7;
    let page = document.addPage([width, height]); let y = height - margin;
    const drawRow = (row: readonly string[], isHeader: boolean): void => {
      const font = isHeader ? bold : regular;
      const cells = row.map((value) => wrapCell(supportedText(value, font), font, style.size, columnWidth - style.padding * 2, maxLines));
      const rowHeight = Math.max(style.size * 1.35 + style.padding * 2, ...cells.map((lines) => lines.length * style.size * 1.25 + style.padding * 2));
      if (y - rowHeight < margin) {
        page = document.addPage([width, height]); y = height - margin;
        if (options.firstRowHeader && !isHeader) drawRow(inspection.rows[0] ?? [], true);
      }
      if (isHeader) page.drawRectangle({ x: margin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: rgb(.89, .95, .99) });
      row.forEach((_, columnIndex) => {
        const x = margin + columnIndex * columnWidth;
        page.drawRectangle({ x, y: y - rowHeight, width: columnWidth, height: rowHeight, borderColor: rgb(.72, .8, .86), borderWidth: .6 });
        cells[columnIndex]?.forEach((line, lineIndex) => page.drawText(line, { x: x + style.padding, y: y - style.padding - style.size - lineIndex * style.size * 1.25, size: style.size, font, color: rgb(.06, .13, .2) }));
      });
      y -= rowHeight;
    };
    for (const [index, row] of inspection.rows.entries()) {
      throwIfAborted(signal); drawRow(row, options.firstRowHeader && index === 0);
      if (index % 50 === 0 || index === inspection.rowCount - 1) onProgress({ message: `Formatting row ${index + 1} of ${inspection.rowCount}`, current: index + 1, total: inspection.rowCount });
    }
    document.setCreator("PDFMech"); document.setProducer("PDFMech browser-local CSV to PDF converter"); document.setTitle(withoutExtension(inspection.fileName));
    const bytes = await document.save({ useObjectStreams: true }); const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
    return { blob, downloadName: `${withoutExtension(inspection.fileName)}.pdf`, outputBytes: blob.size, pageCount: document.getPageCount() };
  }
}

async function embedFont(document: PDFDocument, url: string): Promise<PDFFont> { const response = await fetch(url); if (!response.ok) throw new Error("The local table font could not be loaded."); return document.embedFont(new Uint8Array(await response.arrayBuffer()), { subset: true }); }
function wrapCell(value: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): readonly string[] { const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean); if (words.length === 0) return [""]; const lines: string[] = []; let current = ""; for (const word of words) { const candidate = current === "" ? word : `${current} ${word}`; if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { current = candidate; continue; } if (current !== "") lines.push(current); current = fitWord(word, font, size, maxWidth); if (lines.length >= maxLines - 1) break; } if (current !== "" && lines.length < maxLines) lines.push(current); if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) lines[maxLines - 1] = `${(lines[maxLines - 1] ?? "").slice(0, -1)}…`; return lines; }
function fitWord(word: string, font: PDFFont, size: number, maxWidth: number): string { let value = ""; for (const character of word) { if (font.widthOfTextAtSize(value + character, size) > maxWidth) break; value += character; } return value || "?"; }
function supportedText(value: string, font: PDFFont): string { const supported = new Set(font.getCharacterSet()); return [...value].map((character) => supported.has(character.codePointAt(0) ?? 0) ? character : "?").join(""); }
function assertCsv(file: File): void { if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`); if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 10 MB limit.`); if (!file.name.toLocaleLowerCase("en").endsWith(".csv") && file.type !== "text/csv") throw new Error("Choose a CSV file."); }
function withoutExtension(fileName: string): string { return fileName.replace(/\.csv$/i, "") || "converted-table"; }
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted === true) throw new DOMException("The conversion was cancelled.", "AbortError"); }
