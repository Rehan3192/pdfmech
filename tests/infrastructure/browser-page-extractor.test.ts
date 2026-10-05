import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { BrowserPageExtractor } from "../../src/infrastructure/pdflib/browser-page-extractor";

async function createFourPagePdf(): Promise<File> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
    const page = document.addPage([400 + pageNumber, 590 + pageNumber]);
    page.drawText(`Source page ${pageNumber}`, { x: 40, y: 520, size: 18, font });
  }
  const bytes = await document.save();
  return new File([new Uint8Array(bytes).buffer], "source.pdf", { type: "application/pdf" });
}

describe("BrowserPageExtractor", () => {
  it("copies selected native pages into a validated PDF in source order", async () => {
    const progress: string[] = [];
    const result = await new BrowserPageExtractor().extract(
      await createFourPagePdf(),
      [3, 1, 1],
      (update) => progress.push(update.phase),
    );
    const output = await PDFDocument.load(await result.blob.arrayBuffer());

    expect(result.downloadName).toBe("source-extracted-pages.pdf");
    expect(result.extractedPageCount).toBe(2);
    expect(output.getPageCount()).toBe(2);
    expect(output.getPages().map((page) => page.getWidth())).toEqual([402, 404]);
    expect(progress).toContain("copying");
    expect(progress.at(-1)).toBe("validating");
  });

  it("rejects empty and out-of-bounds selections", async () => {
    const file = await createFourPagePdf();
    const processor = new BrowserPageExtractor();
    await expect(processor.extract(file, [], () => undefined)).rejects.toThrow("Choose at least one page");
    await expect(processor.extract(file, [4], () => undefined)).rejects.toThrow("outside this PDF");
  });
});
