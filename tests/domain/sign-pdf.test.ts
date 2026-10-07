import { describe, expect, it } from "vitest";

import { clampSignaturePlacement, signatureHeightRatio, validateSignaturePlacements } from "../../src/domain/sign-pdf";

describe("sign PDF domain rules", () => {
  it("converts signature width into the correct page-relative height", () => {
    expect(signatureHeightRatio(.4, 3, 600, 800)).toBeCloseTo(.1);
  });

  it("clamps signatures inside the page", () => {
    expect(clampSignaturePlacement({ id: "one", pageIndex: 0, x: .9, y: .98, width: .4 }, 3, 600, 800)).toEqual({ id: "one", pageIndex: 0, x: .6, y: .9, width: .4 });
  });

  it("rejects missing and out-of-document placements", () => {
    expect(() => validateSignaturePlacements([], 2)).toThrow("Add at least one signature");
    expect(() => validateSignaturePlacements([{ id: "bad", pageIndex: 2, x: 0, y: 0, width: .3 }], 2)).toThrow("outside this PDF");
  });
});
