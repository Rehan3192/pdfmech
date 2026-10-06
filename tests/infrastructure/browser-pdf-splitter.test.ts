import { unzipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { BrowserPdfSplitter } from "../../src/infrastructure/pdflib/browser-pdf-splitter";

async function makePdf(): Promise<File> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  [401, 402, 403, 404].forEach((width, index) => {
    const page = document.addPage([width, 595]);
    page.drawText(`Source page ${index + 1}`, { x: 40, y: 520, size: 18, font });
  });
  const bytes = await document.save();
  return new File([new Uint8Array(bytes).buffer], "source.pdf", { type: "application/pdf" });
}

describe("BrowserPdfSplitter", () => {
  it("creates validated native-page PDFs and one downloadable ZIP", async () => {
    const phases: string[] = [];
    const result = await new BrowserPdfSplitter().split(
      await makePdf(),
      [{ label: "1-2", pageIndexes: [0, 1] }, { label: "4", pageIndexes: [3] }],
      (progress) => phases.push(progress.phase),
    );

    expect(result.outputCount).toBe(2);
    expect(result.pageCount).toBe(3);
    expect(result.zipDownloadName).toBe("source-split-pdfs.zip");
    expect(result.files.map((file) => file.downloadName)).toEqual(["source-pages-1-2.pdf", "source-pages-4.pdf"]);

    const first = await PDFDocument.load(await result.files[0]!.blob.arrayBuffer());
    const second = await PDFDocument.load(await result.files[1]!.blob.arrayBuffer());
    expect(first.getPages().map((page) => page.getWidth())).toEqual([401, 402]);
    expect(second.getPages().map((page) => page.getWidth())).toEqual([404]);

    const archive = unzipSync(new Uint8Array(await result.zipBlob.arrayBuffer()));
    expect(Object.keys(archive).sort()).toEqual(["source-pages-1-2.pdf", "source-pages-4.pdf"]);
    expect(phases).toContain("packaging");
    expect(phases.at(-1)).toBe("validating");
  });

  it("rejects invalid output groups", async () => {
    const processor = new BrowserPdfSplitter();
    await expect(processor.split(await makePdf(), [{ label: "1", pageIndexes: [0] }], () => undefined)).rejects.toThrow("at least two");
    await expect(processor.split(await makePdf(), [{ label: "1", pageIndexes: [0] }, { label: "5", pageIndexes: [4] }], () => undefined)).rejects.toThrow("outside this PDF");
  });
});
