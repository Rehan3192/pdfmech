import { PDFDocument, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { BrowserBatesNumberer } from "../../src/infrastructure/pdflib/browser-bates-numberer";

async function createPdf(name: string, rotations: readonly number[]): Promise<File> {
  const document = await PDFDocument.create();
  rotations.forEach((rotation) => document.addPage([300, 500]).setRotation(degrees(rotation)));
  const bytes = await document.save();
  return new File([new Uint8Array(bytes).buffer], name, { type: "application/pdf" });
}

describe("BrowserBatesNumberer", () => {
  it("inspects and continuously numbers multiple files including rotated pages", async () => {
    const first = await createPdf("first.pdf", [0, 90]);
    const second = await createPdf("second.pdf", [180, 270]);
    const numberer = new BrowserBatesNumberer();
    await expect(numberer.inspect(first)).resolves.toMatchObject({ fileName: "first.pdf", pageCount: 2, hasSignatures: false });
    const result = await numberer.process(
      [{ file: first, pageIndexes: [0, 1] }, { file: second, pageIndexes: [0, 1] }],
      { prefix: "CASE-", suffix: "", startNumber: 1, digits: 4, position: "bottom-right", fontSize: 10, color: "#121726", margin: 24 },
      () => undefined,
    );
    expect(result.numberedPageCount).toBe(4);
    expect(result.files.map((file) => [file.downloadName, file.firstLabel, file.lastLabel])).toEqual([
      ["first-bates.pdf", "CASE-0001", "CASE-0002"],
      ["second-bates.pdf", "CASE-0003", "CASE-0004"],
    ]);
    for (const output of result.files) {
      expect((await PDFDocument.load(await output.blob.arrayBuffer())).getPageCount()).toBe(2);
      expect(output.blob.size).toBeGreaterThan(500);
    }
  });
});

