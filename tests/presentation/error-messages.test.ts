import { describe, expect, it } from "vitest";

import { safeErrorMessage } from "../../src/presentation/error-messages";

describe("safeErrorMessage", () => {
  it("explains password-protected PDFs with an action", () => {
    expect(
      safeErrorMessage({
        code: "PDF_ENCRYPTED_UNSUPPORTED",
      }),
    ).toBe(
      "Password-protected PDFs are not supported yet. Please unlock the PDF and try again.",
    );
  });

  it("explains signed PDFs without promising signature preservation", () => {
    expect(
      safeErrorMessage({
        code: "PDF_SIGNATURE_ACK_REQUIRED",
      }),
    ).toContain("Editing signed PDFs can invalidate signatures");
  });

  it("distinguishes damaged, too-large, unsupported, and export-validation errors", () => {
    expect(safeErrorMessage({ code: "PDF_MALFORMED" })).toContain(
      "damaged or malformed",
    );
    expect(safeErrorMessage({ code: "FILE_TOO_LARGE" })).toContain(
      "larger than the local editing limit",
    );
    expect(safeErrorMessage({ code: "PDF_FEATURE_UNSUPPORTED" })).toContain(
      "features this editor does not support",
    );
    expect(safeErrorMessage({ code: "EXPORT_VALIDATION_FAILED" })).toContain(
      "download was blocked",
    );
  });

  it("falls back to ordinary error messages and unknown-safe copy", () => {
    expect(safeErrorMessage(new Error("Invalid PDF structure."))).toContain(
      "damaged or malformed",
    );
    expect(safeErrorMessage(new Error("Specific safe message."))).toBe(
      "Specific safe message.",
    );
    expect(safeErrorMessage({ code: "UNKNOWN_CODE" })).toBe(
      "This PDF could not be opened safely.",
    );
  });
});
