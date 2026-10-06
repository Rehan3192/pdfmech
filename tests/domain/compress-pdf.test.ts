import { describe, expect, it } from "vitest";

import { compressionPreset, PDF_COMPRESSION_PRESETS, reductionPercent } from "../../src/domain/compress-pdf";

describe("PDF compression presets", () => {
  it("offers progressively stronger browser compression", () => {
    expect(PDF_COMPRESSION_PRESETS.map((preset) => preset.level)).toEqual(["light", "balanced", "strong"]);
    expect(compressionPreset("light").renderScale).toBeGreaterThan(compressionPreset("balanced").renderScale);
    expect(compressionPreset("balanced").jpegQuality).toBeGreaterThan(compressionPreset("strong").jpegQuality);
  });

  it("calculates a bounded whole-number reduction", () => {
    expect(reductionPercent(1_000, 610)).toBe(39);
    expect(reductionPercent(1_000, 1_200)).toBe(0);
    expect(reductionPercent(0, 0)).toBe(0);
  });
});
