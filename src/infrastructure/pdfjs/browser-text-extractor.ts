import { GlobalWorkerOptions, getDocument, type PDFDocumentLoadingTask, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { ExtractedTextDocument, ExtractedTextPage } from "../../domain/pdf-compare";
import type { PdfTextExtractionProgress, PdfTextExtractor } from "../../ports/pdf-compare";

GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 300;

interface TextItemLike {
  readonly str: string;
  readonly transform: readonly number[];
  readonly width: number;
  readonly height: number;
}

interface PositionedLine {
  y: number;
  readonly items: Array<{ readonly text: string; readonly x: number; readonly width: number }>;
}

export class BrowserPdfTextExtractor implements PdfTextExtractor {
  async extract(
    file: File,
    onProgress: (progress: PdfTextExtractionProgress) => void,
    signal?: AbortSignal,
  ): Promise<ExtractedTextDocument> {
    assertPdfFile(file);
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), stopAtErrors: true, enableXfa: false });
    let viewer: PDFDocumentProxy | null = null;
    try {
      viewer = await waitForDocument(task);
      assertPageCount(viewer.numPages);
      const pages: ExtractedTextPage[] = [];
      let characterCount = 0;
      for (let pageNumber = 1; pageNumber <= viewer.numPages; pageNumber += 1) {
        throwIfAborted(signal);
        onProgress({ pageNumber, totalPages: viewer.numPages });
        const page = await viewer.getPage(pageNumber);
        try {
          const content = await page.getTextContent({ disableNormalization: false });
          const lines = buildLines(content.items);
          characterCount += lines.reduce((total, line) => total + line.length, 0);
          pages.push({ pageNumber, lines });
        } finally {
          page.cleanup();
        }
      }
      return { fileName: file.name, byteLength: file.size, pageCount: viewer.numPages, pages, characterCount };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Error && /larger|more than/.test(error.message)) throw error;
      throw new Error(`${file.name} could not be read. Password-protected, damaged, or unsupported PDFs cannot be compared.`);
    } finally {
      await task.destroy();
    }
  }
}

function buildLines(items: readonly unknown[]): readonly string[] {
  const lines: PositionedLine[] = [];
  for (const item of items) {
    if (!isTextItem(item)) continue;
    const text = item.str.replace(/\s+/g, " ").trim();
    if (text.length === 0) continue;
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    const tolerance = Math.max(2, Math.min(6, Math.abs(item.height) * 0.45));
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= tolerance);
    if (line === undefined) {
      line = { y, items: [] };
      lines.push(line);
    } else {
      line.y = (line.y * line.items.length + y) / (line.items.length + 1);
    }
    line.items.push({ text, x, width: Math.max(0, item.width) });
  }
  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) => {
      const ordered = [...line.items].sort((left, right) => left.x - right.x);
      let value = "";
      let previousEnd = Number.NEGATIVE_INFINITY;
      for (const item of ordered) {
        const needsSpace = value.length > 0 && item.x - previousEnd > 1.5;
        value += `${needsSpace ? " " : ""}${item.text}`;
        previousEnd = Math.max(previousEnd, item.x + item.width);
      }
      return value.trim();
    })
    .filter((line) => line.length > 0);
}

function isTextItem(value: unknown): value is TextItemLike {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<TextItemLike>;
  return typeof item.str === "string" && Array.isArray(item.transform) && typeof item.width === "number" && typeof item.height === "number";
}

async function waitForDocument(task: PDFDocumentLoadingTask): Promise<PDFDocumentProxy> {
  let passwordRejected = false;
  task.onPassword = () => {
    passwordRejected = true;
    void task.destroy();
  };
  try {
    return await task.promise;
  } catch (error) {
    if (passwordRejected) throw new Error("Password-protected PDFs are not supported.");
    throw error;
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new DOMException("The comparison was cancelled.", "AbortError");
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
