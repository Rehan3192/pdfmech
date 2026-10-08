import { unzipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { BrowserPdfSplitter } from "../../src/infrastructure/pdflib/browser-pdf-splitter";

async function makePdf(pageCount = 4): Promise<File> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  Array.from({ length: pageCount }, (_, index) => 401 + index).forEach((width, index) => {
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

  it("uses reviewed filenames, includes a verified manifest, and preserves source-page identity", async () => {
    const result = await new BrowserPdfSplitter().split(
      await makePdf(),
      [
        { label: "1-2", pageIndexes: [0, 1], outputName: "Ali: October" },
        { label: "3-4", pageIndexes: [2, 3], outputName: "Sara.pdf" },
      ],
      () => undefined,
      undefined,
      { includeManifest: true },
    );

    expect(result.files.map((output) => output.downloadName)).toEqual(["Ali- October.pdf", "Sara.pdf"]);
    expect(result.files[1]?.sourcePageIndexes).toEqual([2, 3]);
    expect(await result.manifestBlob?.text()).toContain('"Sara.pdf","3;4",2,verified');
    const archive = unzipSync(new Uint8Array(await result.zipBlob.arrayBuffer()));
    expect(Object.keys(archive).sort()).toEqual(["Ali- October.pdf", "Sara.pdf", "source-split-manifest.csv"]);
  });

  it("rejects filename collisions before packaging", async () => {
    await expect(new BrowserPdfSplitter().split(
      await makePdf(),
      [
        { label: "1-2", pageIndexes: [0, 1], outputName: "Employee" },
        { label: "3-4", pageIndexes: [2, 3], outputName: "employee.pdf" },
      ],
      () => undefined,
    )).rejects.toThrow("same filename");
  });

  it("never reports completion when ZIP generation fails", async () => {
    const phases: string[] = [];
    const processor = new BrowserPdfSplitter(async () => { throw new Error("ZIP generation failed"); });
    await expect(processor.split(
      await makePdf(),
      [{ label: "1-2", pageIndexes: [0, 1], outputName: "A" }, { label: "3-4", pageIndexes: [2, 3], outputName: "B" }],
      (progress) => phases.push(progress.phase),
    )).rejects.toThrow("ZIP generation failed");
    expect(phases.at(-1)).toBe("packaging");
    expect(phases).not.toContain("validating");
  });

  it("generates and verifies a 100-document named batch", async () => {
    const groups = Array.from({ length: 100 }, (_, index) => ({
      label: String(index + 1),
      pageIndexes: [index],
      outputName: `Employee-${String(index + 1).padStart(3, "0")}`,
    }));
    const result = await new BrowserPdfSplitter().split(
      await makePdf(100),
      groups,
      () => undefined,
      undefined,
      { includeManifest: true },
    );
    expect(result.outputCount).toBe(100);
    expect(result.pageCount).toBe(100);
    expect(result.files[0]?.downloadName).toBe("Employee-001.pdf");
    expect(result.files.at(-1)?.sourcePageIndexes).toEqual([99]);
    const archive = unzipSync(new Uint8Array(await result.zipBlob.arrayBuffer()));
    expect(Object.keys(archive)).toHaveLength(101);
    expect(archive["Employee-100.pdf"]?.byteLength).toBeGreaterThan(0);
  }, 20_000);
});
