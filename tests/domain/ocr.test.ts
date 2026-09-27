import { describe, expect, it } from "vitest";

import { normalizeOcrText, parseOcrPageRange } from "../../src/domain/ocr";

describe("OCR domain helpers", () => {
  it("parses ranges into sorted, unique zero-based page indexes", () => {
    expect(parseOcrPageRange("5, 1-3, 2, 8", 10)).toEqual([0, 1, 2, 4, 7]);
  });

  it("rejects empty, reversed, malformed, and out-of-bounds ranges", () => {
    expect(() => parseOcrPageRange("", 5)).toThrow(/Enter a page range/);
    expect(() => parseOcrPageRange("4-2", 5)).toThrow(/outside this PDF/);
    expect(() => parseOcrPageRange("1, nope", 5)).toThrow(/not valid/);
    expect(() => parseOcrPageRange("6", 5)).toThrow(/outside this PDF/);
  });

  it("normalizes OCR text for case-insensitive searching", () => {
    expect(normalizeOcrText("  INVOICE—No. 42!  ")).toBe("invoice no 42");
  });
});
