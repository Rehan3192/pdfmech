import { describe, expect, it, vi } from "vitest";

import { createLazyPdfValidator } from "../../src/infrastructure/pdfjs/lazy-validator";
import { unsafeBrand } from "../../src/shared/brand";
import type { PdfValidator } from "../../src/ports/pdf";

describe("lazy PDF validator", () => {
  it("does not load the generated PDF validator until validation is requested", async () => {
    const validate = vi.fn<PdfValidator["validate"]>().mockResolvedValue({
      ok: true,
    });
    const loadValidator = vi.fn().mockResolvedValue({ validate });
    const lazyValidator = createLazyPdfValidator(loadValidator);

    expect(loadValidator).not.toHaveBeenCalled();

    await lazyValidator.validate({
      documentId: unsafeBrand("document_test"),
      revision: 0,
      generatedBytes: new Uint8Array([1]),
      expectedPages: [],
    });

    expect(loadValidator).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledTimes(1);
  });
});
