import { degrees, PDFDocument, rgb, StandardFonts, type PDFPage } from "pdf-lib";

import { formatBatesLabel, validateBatesSequence } from "../../domain/bates";
import type {
  BatesInspection,
  BatesNumberer,
  BatesOutputFile,
  BatesProcessOptions,
  BatesProcessResult,
  BatesProgress,
  BatesFileRequest,
} from "../../ports/bates";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 1_000;

export class BrowserBatesNumberer implements BatesNumberer {
  async inspect(file: File): Promise<BatesInspection> {
    assertPdfFile(file);
    const document = await loadPdf(file);
    assertPageCount(document.getPageCount());
    return {
      fileName: file.name,
      byteLength: file.size,
      pageCount: document.getPageCount(),
      hasSignatures: hasSignatureFields(document),
    };
  }

  async process(
    files: readonly BatesFileRequest[],
    options: BatesProcessOptions,
    onProgress: (progress: BatesProgress) => void,
  ): Promise<BatesProcessResult> {
    if (files.length === 0) throw new Error("Choose at least one PDF.");
    if (!Number.isFinite(options.fontSize) || options.fontSize < 6 || options.fontSize > 36) {
      throw new Error("Font size must be between 6 and 36 points.");
    }
    if (!Number.isFinite(options.margin) || options.margin < 6 || options.margin > 144) {
      throw new Error("Margin must be between 6 and 144 points.");
    }
    const selectedPageCount = files.reduce((total, item) => total + item.pageIndexes.length, 0);
    validateBatesSequence(selectedPageCount, options);
    const color = parseHexColor(options.color);
    const output: BatesOutputFile[] = [];
    let nextNumber = options.startNumber;

    for (const [fileIndex, request] of files.entries()) {
      onProgress({
        completedFiles: fileIndex,
        totalFiles: files.length,
        currentFileName: request.file.name,
      });
      assertPdfFile(request.file);
      const document = await loadPdf(request.file);
      assertPageCount(document.getPageCount());
      const font = await document.embedFont(StandardFonts.Helvetica);
      const firstNumber = nextNumber;

      for (const pageIndex of request.pageIndexes) {
        if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= document.getPageCount()) {
          throw new Error(`A selected page is outside ${request.file.name}.`);
        }
        const label = formatBatesLabel(nextNumber, options);
        const width = font.widthOfTextAtSize(label, options.fontSize);
        drawLabel(document.getPage(pageIndex), label, width, options, color);
        nextNumber += 1;
      }

      const bytes = await document.save();
      const lastNumber = nextNumber - 1;
      output.push({
        sourceName: request.file.name,
        downloadName: buildDownloadName(request.file.name),
        blob: new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" }),
        numberedPageCount: request.pageIndexes.length,
        firstLabel: formatBatesLabel(firstNumber, options),
        lastLabel: formatBatesLabel(lastNumber, options),
      });
    }

    return { files: output, numberedPageCount: selectedPageCount };
  }
}

async function loadPdf(file: File): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await file.arrayBuffer());
  } catch {
    throw new Error(`${file.name} could not be opened. Password-protected or damaged PDFs are not supported.`);
  }
}

function assertPdfFile(file: File): void {
  if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 100 MB limit.`);
  if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error(`${file.name} is not a PDF file.`);
  }
}

function assertPageCount(pageCount: number): void {
  if (pageCount < 1) throw new Error("The PDF does not contain any pages.");
  if (pageCount > MAX_PAGE_COUNT) throw new Error(`PDFs with more than ${MAX_PAGE_COUNT} pages are not supported.`);
}

function hasSignatureFields(document: PDFDocument): boolean {
  try {
    return document.getForm().getFields().some((field) =>
      field.constructor.name.toLocaleLowerCase("en").includes("signature"),
    );
  } catch {
    return false;
  }
}

function parseHexColor(value: string): { readonly red: number; readonly green: number; readonly blue: number } {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (match === null || match[1] === undefined) throw new Error("Choose a valid six-digit color.");
  const number = Number.parseInt(match[1], 16);
  return {
    red: ((number >> 16) & 255) / 255,
    green: ((number >> 8) & 255) / 255,
    blue: (number & 255) / 255,
  };
}

function drawLabel(
  page: PDFPage,
  text: string,
  textWidth: number,
  options: BatesProcessOptions,
  color: { readonly red: number; readonly green: number; readonly blue: number },
): void {
  const rotation = normalizeRotation(page.getRotation().angle);
  const { width, height } = page.getSize();
  const displayWidth = rotation === 90 || rotation === 270 ? height : width;
  const displayHeight = rotation === 90 || rotation === 270 ? width : height;
  const horizontal = options.position.split("-")[1];
  const vertical = options.position.startsWith("top") ? "top" : "bottom";
  const displayX = horizontal === "left"
    ? options.margin
    : horizontal === "right"
      ? displayWidth - options.margin - textWidth
      : (displayWidth - textWidth) / 2;
  const displayY = vertical === "top"
    ? displayHeight - options.margin - options.fontSize
    : options.margin;
  const coordinates = mapDisplayToPage(displayX, displayY, width, height, rotation);

  page.drawText(text, {
    x: coordinates.x,
    y: coordinates.y,
    size: options.fontSize,
    color: rgb(color.red, color.green, color.blue),
    rotate: degrees(rotation),
  });
}

function normalizeRotation(value: number): 0 | 90 | 180 | 270 {
  const normalized = ((value % 360) + 360) % 360;
  if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  throw new Error("A page uses an unsupported rotation angle.");
}

function mapDisplayToPage(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
): { readonly x: number; readonly y: number } {
  if (rotation === 90) return { x: width - y, y: x };
  if (rotation === 180) return { x: width - x, y: height - y };
  if (rotation === 270) return { x: y, y: height - x };
  return { x, y };
}

function buildDownloadName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "") || "document";
  return `${base}-bates.pdf`;
}
