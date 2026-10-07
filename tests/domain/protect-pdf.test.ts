import { describe, expect, it } from "vitest";

import { assessPdfPassword, validateProtectPdfPassword } from "../../src/domain/protect-pdf";

describe("protect PDF password rules", () => {
  it("rejects short, mismatched, and excessively long passwords", () => {
    expect(validateProtectPdfPassword("short", "short")).toContain("at least 8");
    expect(validateProtectPdfPassword("long-enough", "different")).toContain("do not match");
    expect(validateProtectPdfPassword("x".repeat(128), "x".repeat(128))).toContain("127");
  });

  it("accepts a matching password and grades stronger passphrases higher", () => {
    expect(validateProtectPdfPassword("Correct-Horse-47!", "Correct-Horse-47!")).toBeNull();
    expect(assessPdfPassword("password").score).toBeLessThan(assessPdfPassword("Correct-Horse-47!").score);
    expect(assessPdfPassword("Correct-Horse-47!").label).toBe("Strong");
  });
});
