import { describe, expect, it } from "vitest";

import { formatBatesLabel, parseBatesPageRange, validateBatesSequence } from "../../src/domain/bates";

describe("Bates numbering rules", () => {
  it("parses all pages, ranges, duplicates, and individual pages", () => {
    expect(parseBatesPageRange("all", 4)).toEqual([0, 1, 2, 3]);
    expect(parseBatesPageRange("1-3, 3, 5", 5)).toEqual([0, 1, 2, 4]);
  });

  it("rejects reversed and out-of-bounds ranges", () => {
    expect(() => parseBatesPageRange("4-2", 5)).toThrow("outside this PDF");
    expect(() => parseBatesPageRange("6", 5)).toThrow("outside this PDF");
  });

  it("formats fixed-width labels and validates sequence overflow", () => {
    const settings = { prefix: "CASE-", suffix: "-A", startNumber: 8, digits: 4 };
    expect(formatBatesLabel(8, settings)).toBe("CASE-0008-A");
    expect(validateBatesSequence(3, settings)).toEqual({ first: "CASE-0008-A", last: "CASE-0010-A" });
    expect(() => validateBatesSequence(2, { ...settings, startNumber: 9999 })).toThrow("does not fit");
  });
});

