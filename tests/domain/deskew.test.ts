import { describe, expect, it } from "vitest";

import { clampDeskewAngle, estimateDeskewAngle } from "../../src/domain/deskew";

describe("deskew angle analysis", () => {
  it("clamps and rounds manual corrections to quarter degrees", () => {
    expect(clampDeskewAngle(2.13)).toBe(2.25);
    expect(clampDeskewAngle(-12)).toBe(-7);
    expect(clampDeskewAngle(Number.NaN)).toBe(0);
  });

  it("finds the correction for synthetic skewed horizontal lines", () => {
    const width = 360;
    const height = 240;
    const pixels = new Uint8ClampedArray(width * height).fill(255);
    const skew = 3 * Math.PI / 180;
    for (let line = 0; line < 5; line += 1) {
      for (let x = 35; x < width - 35; x += 1) {
        const y = Math.round(45 + line * 34 + Math.tan(skew) * (x - width / 2));
        for (let thickness = -1; thickness <= 1; thickness += 1) {
          const index = (y + thickness) * width + x;
          if (index >= 0 && index < pixels.length) pixels[index] = 20;
        }
      }
    }
    expect(estimateDeskewAngle(pixels, width, height)).toBeCloseTo(-3, 0);
  });
});

