import { describe, expect, it } from "vitest";

import { calculateMergeTotals, moveMergeItem, validateMergeFiles } from "../../src/domain/merge-pdf";

describe("merge PDF planning", () => {
  it("calculates combined files, bytes, and pages", () => {
    expect(calculateMergeTotals([{ byteLength: 120, pageCount: 2 }, { byteLength: 80, pageCount: 3 }])).toEqual({
      fileCount: 2,
      byteLength: 200,
      pageCount: 5,
    });
  });

  it("requires at least two files and enforces combined page limits", () => {
    expect(() => validateMergeFiles([{ byteLength: 100, pageCount: 1 }])).toThrow("at least two");
    expect(() => validateMergeFiles([{ byteLength: 100, pageCount: 300 }, { byteLength: 100, pageCount: 201 }])).toThrow("500-page");
  });

  it("moves a file without mutating the original order", () => {
    const original = ["one", "two", "three"];
    expect(moveMergeItem(original, 2, 0)).toEqual(["three", "one", "two"]);
    expect(original).toEqual(["one", "two", "three"]);
  });
});
