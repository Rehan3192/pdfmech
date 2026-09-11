import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { EditorError } from "../../domain/errors";
import type {
  PdfValidator,
  ValidationRequest,
  ValidationResult,
} from "../../ports/pdf";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
} from "pdfjs-dist/types/src/display/api";

const MAX_GENERATED_FILE_BYTES = 100 * 1024 * 1024;

interface PdfJsModule {
  readonly GlobalWorkerOptions?: {
    workerSrc: string;
  };
  getDocument(parameters: {
    readonly data: Uint8Array;
    readonly stopAtErrors?: boolean;
    readonly enableXfa?: boolean;
  }): PDFDocumentLoadingTask;
}

export type PdfJsLoader = () => Promise<PdfJsModule>;

async function loadBrowserPdfJs(): Promise<PdfJsModule> {
  const module = await import("pdfjs-dist");
  module.GlobalWorkerOptions.workerSrc = workerUrl;
  return module;
}

export function createGeneratedPdfValidator(
  loadPdfJs: PdfJsLoader = loadBrowserPdfJs,
): PdfValidator {
  return {
    async validate(request: ValidationRequest): Promise<ValidationResult> {
      if (request.generatedBytes.byteLength === 0) {
        return {
          ok: false,
          error: createValidationError(request, "export.validation.empty"),
        };
      }

      if (request.generatedBytes.byteLength > MAX_GENERATED_FILE_BYTES) {
        return {
          ok: false,
          error: createValidationError(request, "export.validation.too_large"),
        };
      }

      let task: PDFDocumentLoadingTask | null = null;
      try {
        const pdfJs = await loadPdfJs();
        task = pdfJs.getDocument({
          data: Uint8Array.from(request.generatedBytes),
          stopAtErrors: true,
          enableXfa: false,
        });
        const document = await task.promise;
        await assertReadableDocument(document, request);
        return { ok: true };
      } catch (error) {
        if (isValidationEditorError(error)) {
          return {
            ok: false,
            error,
          };
        }

        return {
          ok: false,
          error: createValidationError(request, "export.validation.failed"),
        };
      } finally {
        await task?.destroy();
      }
    },
  };
}

function isValidationEditorError(error: unknown): error is EditorError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EXPORT_VALIDATION_FAILED"
  );
}

async function assertReadableDocument(
  document: PDFDocumentProxy,
  request: ValidationRequest,
): Promise<void> {
  if (document.numPages <= 0) {
    throw createValidationError(request, "export.validation.no_pages");
  }

  if (document.numPages !== request.expectedPages.length) {
    throw createValidationError(request, "export.validation.page_count");
  }

  for (
    let pageNumber = 1;
    pageNumber <= request.expectedPages.length;
    pageNumber += 1
  ) {
    const expectedPage = request.expectedPages[pageNumber - 1];
    if (expectedPage === undefined) {
      throw createValidationError(request, "export.validation.page_count");
    }

    const page = await document.getPage(pageNumber);
    try {
      const viewport = page.getViewport({ scale: 1 });
      if (
        Math.round(viewport.width) !== Math.round(expectedPage.width) ||
        Math.round(viewport.height) !== Math.round(expectedPage.height)
      ) {
        throw createValidationError(request, "export.validation.page_size");
      }

      if (viewport.rotation !== expectedPage.rotation) {
        throw createValidationError(request, "export.validation.page_rotation");
      }
    } finally {
      page.cleanup();
    }
  }
}

function createValidationError(
  request: ValidationRequest,
  messageKey: string,
): EditorError {
  return {
    code: "EXPORT_VALIDATION_FAILED",
    retryable: false,
    messageKey,
    correlationId: createCorrelationId(),
    safeMetadata: {
      byteLength: request.generatedBytes.byteLength,
      revision: request.revision,
      expectedPageCount: request.expectedPages.length,
    },
  };
}

function createCorrelationId(): string {
  const randomUUID = globalThis.crypto?.randomUUID?.();
  if (randomUUID !== undefined) {
    return `export_validation_${randomUUID}`;
  }

  return `export_validation_${Date.now().toString(36)}`;
}
