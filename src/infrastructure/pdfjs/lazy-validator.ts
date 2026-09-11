import type { PdfValidator, ValidationRequest, ValidationResult } from "../../ports/pdf";

export type PdfValidatorLoader = () => Promise<PdfValidator>;

async function loadGeneratedPdfValidator(): Promise<PdfValidator> {
  const module = await import("./generated-pdf-validator");
  return module.createGeneratedPdfValidator();
}

export function createLazyPdfValidator(
  loadValidator: PdfValidatorLoader = loadGeneratedPdfValidator,
): PdfValidator {
  let validatorPromise: Promise<PdfValidator> | null = null;

  function getValidator(): Promise<PdfValidator> {
    validatorPromise ??= loadValidator();
    return validatorPromise;
  }

  return {
    async validate(request: ValidationRequest): Promise<ValidationResult> {
      return (await getValidator()).validate(request);
    },
  };
}
