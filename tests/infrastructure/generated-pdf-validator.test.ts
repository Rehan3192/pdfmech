import { PDFDocument, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { createGeneratedPdfValidator } from "../../src/infrastructure/pdfjs/generated-pdf-validator";
import { unsafeBrand } from "../../src/shared/brand";
import type { ValidationRequest } from "../../src/ports/pdf";
import type { PdfJsLoader } from "../../src/infrastructure/pdfjs/generated-pdf-validator";

const loadNodePdfJs: PdfJsLoader = async () =>
  import("pdfjs-dist/legacy/build/pdf.mjs");

function createValidationRequest(
  generatedBytes: Uint8Array,
  input?: Partial<Pick<ValidationRequest, "expectedPages">>,
): ValidationRequest {
  return {
    documentId: unsafeBrand("document_validation_test"),
    revision: 7,
    generatedBytes,
    expectedPages:
      input?.expectedPages ??
      [
        {
          sourcePageIndex: 0,
          width: 612,
          height: 792,
          rotation: 0,
        },
      ],
  };
}

async function createValidPdfBytes(input?: {
  readonly pageCount?: number;
  readonly rotation?: 0 | 90 | 180 | 270;
}): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const pageCount = input?.pageCount ?? 1;
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([612, 792]);
    if (input?.rotation !== undefined) {
      page.setRotation(degrees(input.rotation));
    }
  }
  return new Uint8Array(await document.save());
}

describe("createGeneratedPdfValidator", () => {
  it("accepts readable generated PDF bytes", async () => {
    const validator = createGeneratedPdfValidator(loadNodePdfJs);

    await expect(
      validator.validate(createValidationRequest(await createValidPdfBytes())),
    ).resolves.toEqual({ ok: true });
  }, 15_000);

  it("rejects empty generated PDF bytes with a safe error", async () => {
    const validator = createGeneratedPdfValidator(loadNodePdfJs);

    const result = await validator.validate(
      createValidationRequest(new Uint8Array()),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "EXPORT_VALIDATION_FAILED",
        retryable: false,
        messageKey: "export.validation.empty",
        safeMetadata: {
          byteLength: 0,
          revision: 7,
          expectedPageCount: 1,
        },
      },
    });

    if (!result.ok) {
      expect(result.error.correlationId).toMatch(/^export_validation_/);
    }
  });

  it("rejects malformed generated PDF bytes with a safe error", async () => {
    const validator = createGeneratedPdfValidator(loadNodePdfJs);

    const result = await validator.validate(
      createValidationRequest(new TextEncoder().encode("not a pdf")),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "EXPORT_VALIDATION_FAILED",
        retryable: false,
        messageKey: "export.validation.failed",
        safeMetadata: {
          byteLength: 9,
          revision: 7,
          expectedPageCount: 1,
        },
      },
    });

    if (!result.ok) {
      expect(result.error.correlationId).toMatch(/^export_validation_/);
      expect(JSON.stringify(result.error)).not.toContain("not a pdf");
    }
  });

  it("rejects generated PDFs with the wrong page count", async () => {
    const validator = createGeneratedPdfValidator(loadNodePdfJs);

    const result = await validator.validate(
      createValidationRequest(await createValidPdfBytes({ pageCount: 2 })),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "EXPORT_VALIDATION_FAILED",
        messageKey: "export.validation.page_count",
      },
    });
  }, 15_000);

  it("rejects generated PDFs with the wrong page rotation", async () => {
    const validator = createGeneratedPdfValidator(loadNodePdfJs);

    const result = await validator.validate(
      createValidationRequest(await createValidPdfBytes({ rotation: 90 })),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "EXPORT_VALIDATION_FAILED",
        messageKey: "export.validation.page_size",
      },
    });
  }, 15_000);

  it("accepts generated PDFs whose expected page rotation and dimensions match", async () => {
    const validator = createGeneratedPdfValidator(loadNodePdfJs);

    await expect(
      validator.validate(
        createValidationRequest(await createValidPdfBytes({ rotation: 90 }), {
          expectedPages: [
            {
              sourcePageIndex: 0,
              width: 792,
              height: 612,
              rotation: 90,
            },
          ],
        }),
      ),
    ).resolves.toEqual({ ok: true });
  }, 15_000);
});
