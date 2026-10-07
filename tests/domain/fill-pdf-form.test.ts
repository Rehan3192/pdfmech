import { describe, expect, it } from "vitest";

import { filledPdfName, isCompletedFormValue, normalizeSelectedOptions } from "../../src/domain/fill-pdf-form";

describe("Fill PDF form domain rules", () => {
  it("creates a separate filled output name", () => {
    expect(filledPdfName("application.PDF")).toBe("application-filled.pdf");
    expect(filledPdfName(".pdf")).toBe("document-filled.pdf");
  });

  it("counts only meaningful values as completed", () => {
    expect(isCompletedFormValue("  ")).toBe(false);
    expect(isCompletedFormValue("Alex Morgan")).toBe(true);
    expect(isCompletedFormValue(false)).toBe(false);
    expect(isCompletedFormValue(true)).toBe(true);
    expect(isCompletedFormValue([])).toBe(false);
    expect(isCompletedFormValue(["Email"])).toBe(true);
  });

  it("keeps unique selections that exist in the PDF field", () => {
    expect(normalizeSelectedOptions(["Email", "Missing", "Email", "Phone"], ["Email", "Phone"])).toEqual(["Email", "Phone"]);
  });
});
