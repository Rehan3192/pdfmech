import { describe, expect, it } from "vitest";

import { fitJpgOnPage, jpgPdfPageDimensions, moveJpgItem } from "../../src/domain/jpg-to-pdf";

describe("JPG to PDF domain rules", () => {
  it("moves images without mutating the source order", () => {
    const source = ["one", "two", "three"];
    expect(moveJpgItem(source, 2, 0)).toEqual(["three", "one", "two"]);
    expect(source).toEqual(["one", "two", "three"]);
  });

  it("creates printable pages and proportionally contains images", () => {
    const [width, height] = jpgPdfPageDimensions(1600, 900, { pageSize: "a4", orientation: "landscape", margin: "large" });
    expect(width).toBeCloseTo(841.89, 1);
    expect(height).toBeCloseTo(595.28, 1);
    const placement = fitJpgOnPage(1600, 900, width, height, 48);
    expect(placement.width / placement.height).toBeCloseTo(1600 / 900, 5);
    expect(placement.x).toBeGreaterThanOrEqual(48);
    expect(placement.y).toBeGreaterThanOrEqual(48);
  });
});
