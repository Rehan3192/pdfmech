import { describe, expect, it } from "vitest";

import { createEveryPageGroups, describeSplitGroups, parseSplitPageGroups } from "../../src/domain/split-pdf";

describe("split PDF ranges", () => {
  it("creates one output group per page", () => {
    expect(createEveryPageGroups(3)).toEqual([
      { label: "1", pageIndexes: [0] },
      { label: "2", pageIndexes: [1] },
      { label: "3", pageIndexes: [2] },
    ]);
  });

  it("parses separate custom output ranges", () => {
    const groups = parseSplitPageGroups("1-3, 4, 6-8", 8);
    expect(groups).toEqual([
      { label: "1-3", pageIndexes: [0, 1, 2] },
      { label: "4", pageIndexes: [3] },
      { label: "6-8", pageIndexes: [5, 6, 7] },
    ]);
    expect(describeSplitGroups(groups)).toBe("1-3, 4, 6-8");
  });

  it("rejects overlapping and invalid ranges", () => {
    expect(() => parseSplitPageGroups("1-3, 3-5", 5)).toThrow("appears in more than one");
    expect(() => parseSplitPageGroups("1-3", 5)).toThrow("at least two");
    expect(() => parseSplitPageGroups("1-3, 8", 5)).toThrow("outside this PDF");
  });
});
