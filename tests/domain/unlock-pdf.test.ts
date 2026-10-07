import { describe, expect, it } from "vitest";

import { unlockedPdfName, validateUnlockPdfPassword } from "../../src/domain/unlock-pdf";

describe("unlock PDF rules", () => {
  it("requires a password only when the PDF requires one to open", () => {
    expect(validateUnlockPdfPassword("", true)).toContain("current PDF password");
    expect(validateUnlockPdfPassword("", false)).toBeNull();
    expect(validateUnlockPdfPassword("known-password", true)).toBeNull();
  });

  it("creates a safe unlocked download name", () => {
    expect(unlockedPdfName("statement.pdf")).toBe("statement-unlocked.pdf");
    expect(unlockedPdfName("PDF")).toBe("PDF-unlocked.pdf");
  });
});
