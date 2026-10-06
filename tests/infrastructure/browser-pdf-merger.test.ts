import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { BrowserPdfMerger } from "../../src/infrastructure/pdflib/browser-pdf-merger";

async function makePdf(name: string, widths: readonly number[]): Promise<File> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  widths.forEach((width, index) => {
    const page = document.addPage([width, 595]);
    page.drawText(`${name} page ${index + 1}`, { x: 40, y: 520, size: 18, font });
  });
  const bytes = await document.save();
  return new File([new Uint8Array(bytes).buffer], name, { type: "application/pdf" });
}

describe("BrowserPdfMerger", () => {
  it("copies native pages in the chosen file and page order", async () => {
    const first = await makePdf("first.pdf", [401, 402]);
    const second = await makePdf("second.pdf", [501, 502, 503]);
    const phases: string[] = [];
    const result = await new BrowserPdfMerger().merge(
      [{ file: second, pageCount: 3 }, { file: first, pageCount: 2 }],
      (progress) => phases.push(progress.phase),
    );
    const output = await PDFDocument.load(await result.blob.arrayBuffer());

    expect(result.downloadName).toBe("second-merged.pdf");
    expect(result.mergedFileCount).toBe(2);
    expect(result.pageCount).toBe(5);
    expect(output.getPages().map((page) => page.getWidth())).toEqual([501, 502, 503, 401, 402]);
    expect(phases.at(-1)).toBe("validating");
  });

  it("rejects a source whose page count changed after inspection", async () => {
    const file = await makePdf("changed.pdf", [400, 401]);
    const other = await makePdf("other.pdf", [500]);
    await expect(new BrowserPdfMerger().merge([{ file, pageCount: 1 }, { file: other, pageCount: 1 }], () => undefined)).rejects.toThrow("changed after it was selected");
  });
});
