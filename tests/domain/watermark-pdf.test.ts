import { describe, expect, it } from "vitest";

import {
  parseHexColor,
  parseWatermarkPages,
  validateWatermarkText,
  watermarkPlacement,
} from "../../src/domain/watermark-pdf";

describe("watermark PDF domain rules", () => {
  it("parses, deduplicates, and sorts custom page ranges", () => {
    expect(parseWatermarkPages("5, 2-4, 2, 1", 6)).toEqual([0, 1, 2, 3, 4]);
    expect(() => parseWatermarkPages("2-7", 6)).toThrow("outside this PDF");
    expect(() => parseWatermarkPages("one", 6)).toThrow("not valid");
  });

  it("validates text and converts six-digit colors", () => {
    expect(validateWatermarkText("  REVIEW COPY  ")).toBe("REVIEW COPY");
    expect(parseHexColor("#ff8000")).toEqual([1, 128 / 255, 0]);
    expect(() => validateWatermarkText("   ")).toThrow("Enter watermark text");
    expect(() => parseHexColor("red")).toThrow("six-digit watermark color");
  });

  it("centers both straight and rotated watermark bounds", () => {
    expect(watermarkPlacement(600, 800, 200, 50, 0, "center")).toEqual({ x: 200, y: 375 });
    const rotated = watermarkPlacement(600, 800, 200, 50, 45, "center");
    expect(rotated.x).toBeCloseTo(247, 0);
    expect(rotated.y).toBeCloseTo(312, 0);
  });
});
