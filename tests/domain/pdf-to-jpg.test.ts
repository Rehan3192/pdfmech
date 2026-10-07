import { describe, expect, it } from "vitest";

import { parsePdfPageSelection, pdfPageImageName, pdfToJpgPreset } from "../../src/domain/pdf-to-jpg";

describe("PDF to JPG domain rules", () => {
  it("parses, deduplicates, and orders page selections", () => {
    expect(parsePdfPageSelection("5, 2-3, 3, 1", 6)).toEqual([0, 1, 2, 4]);
    expect(() => parsePdfPageSelection("3-2", 6)).toThrow("outside this PDF");
    expect(() => parsePdfPageSelection("7", 6)).toThrow("outside this PDF");
  });

  it("builds stable padded names and exposes quality presets", () => {
    expect(pdfPageImageName("Quarterly.Report.pdf", 3, 120)).toBe("Quarterly.Report-page-003.jpg");
    expect(pdfToJpgPreset("high").jpegQuality).toBeGreaterThan(pdfToJpgPreset("web").jpegQuality);
  });
});
