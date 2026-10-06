import type { PdfRedaction } from "../../domain/redact-pdf";
import type { RedactPdfInspection, RedactPdfProcessor, RedactPdfProgress, RedactPdfResult } from "../../ports/redact-pdf";

export type RedactPdfProcessorLoader = () => Promise<RedactPdfProcessor>;

async function loadBrowserPdfRedactor(): Promise<RedactPdfProcessor> {
  const module = await import("./browser-pdf-redactor");
  return new module.BrowserPdfRedactor();
}

export function createLazyPdfRedactor(loadProcessor: RedactPdfProcessorLoader = loadBrowserPdfRedactor): RedactPdfProcessor {
  let processorPromise: Promise<RedactPdfProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, onProgress: (progress: RedactPdfProgress) => void, signal?: AbortSignal): Promise<RedactPdfInspection> { return (await getProcessor()).inspect(file, onProgress, signal); },
    async renderPreview(file: File, pageIndex: number, signal?: AbortSignal): Promise<Blob> { return (await getProcessor()).renderPreview(file, pageIndex, signal); },
    async redact(file: File, redactions: readonly PdfRedaction[], onProgress: (progress: RedactPdfProgress) => void, signal?: AbortSignal): Promise<RedactPdfResult> { return (await getProcessor()).redact(file, redactions, onProgress, signal); },
  };
}
