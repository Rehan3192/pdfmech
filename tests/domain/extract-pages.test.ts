import { describe, expect, it } from "vitest";

import { formatExtractPageRange, parseExtractPageRange } from "../../src/domain/extract-pages";

describe("extract PDF page ranges", () => {
  it("selects every page when the range is blank or all", () => {
    expect(parseExtractPageRange("", 4)).toEqual([0, 1, 2, 3]);
    expect(parseExtractPageRange("ALL", 3)).toEqual([0, 1, 2]);
  });

  it("parses ranges, individual pages, and duplicate selections", () => {
    expect(parseExtractPageRange("1-3, 6, 3, 9", 10)).toEqual([0, 1, 2, 5, 8]);
  });

  it("rejects malformed, reversed, and out-of-bounds selections", () => {
    expect(() => parseExtractPageRange("one", 4)).toThrow("not valid");
    expect(() => parseExtractPageRange("3-2", 4)).toThrow("outside this PDF");
    expect(() => parseExtractPageRange("5", 4)).toThrow("outside this PDF");
  });

  it("formats a selection as compact human-readable ranges", () => {
    expect(formatExtractPageRange([8, 0, 2, 1, 5, 2])).toBe("1-3, 6, 9");
    expect(formatExtractPageRange([])).toBe("");
  });
});
