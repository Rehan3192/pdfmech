import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

import { BrowserPdfTextExtractor } from "../pdfjs/browser-text-extractor";
import type { PdfToWordProcessor, PdfWordInspection, PdfWordResult, WordConversionProgress } from "../../ports/word-conversion";

const extractor = new BrowserPdfTextExtractor();

export class BrowserPdfToWordProcessor implements PdfToWordProcessor {
  async inspect(file: File, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<PdfWordInspection> {
    const extracted = await extractor.extract(
      file,
      ({ pageNumber, totalPages }) => onProgress({ message: `Reading page ${pageNumber} of ${totalPages}`, current: pageNumber, total: totalPages }),
      signal,
    );
    return extracted;
  }

  async convert(inspection: PdfWordInspection, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<PdfWordResult> {
    throwIfAborted(signal);
    if (inspection.characterCount === 0) {
      throw new Error("This PDF has no selectable text. Run OCR PDF first, then convert the searchable copy to Word.");
    }
    onProgress({ message: "Building editable Word paragraphs" });
    const children: Paragraph[] = [];
    for (const [pageIndex, page] of inspection.pages.entries()) {
      throwIfAborted(signal);
      const lines = page.lines.length > 0 ? page.lines : [""];
      lines.forEach((line, lineIndex) => {
        const heading = inferHeading(line);
        children.push(new Paragraph({
          pageBreakBefore: pageIndex > 0 && lineIndex === 0,
          ...(heading === undefined ? {} : { heading }),
          spacing: { after: heading === undefined ? 100 : 180, line: 276 },
          children: [new TextRun({ text: line, bold: heading !== undefined })],
        }));
      });
      onProgress({ message: `Preparing page ${page.pageNumber} of ${inspection.pageCount}`, current: page.pageNumber, total: inspection.pageCount });
    }
    const document = new Document({
      creator: "PDFMech",
      title: withoutExtension(inspection.fileName),
      description: "Editable document created locally from selectable PDF text.",
      sections: [{
        properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
        children,
      }],
    });
    throwIfAborted(signal);
    onProgress({ message: "Packaging the DOCX file" });
    const blob = await Packer.toBlob(document);
    return { blob, downloadName: `${withoutExtension(inspection.fileName)}.docx`, outputBytes: blob.size };
  }
}

function inferHeading(line: string): typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2 | undefined {
  const value = line.trim();
  if (value.length < 4 || value.length > 100) return undefined;
  if (/^\d+(?:\.\d+)*[.)]?\s+\S/.test(value)) return HeadingLevel.HEADING_2;
  const letters = value.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 4 && value === value.toLocaleUpperCase()) return HeadingLevel.HEADING_1;
  return undefined;
}

function withoutExtension(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "") || "converted-document";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new DOMException("The conversion was cancelled.", "AbortError");
}
