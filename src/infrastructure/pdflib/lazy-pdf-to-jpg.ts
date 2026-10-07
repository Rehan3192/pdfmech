import type { PdfToJpgQuality } from "../../domain/pdf-to-jpg";
import type { PdfToJpgInspection, PdfToJpgProcessor, PdfToJpgProgress, PdfToJpgResult } from "../../ports/pdf-to-jpg";

export type PdfToJpgProcessorLoader = () => Promise<PdfToJpgProcessor>;

async function loadBrowserProcessor(): Promise<PdfToJpgProcessor> {
  const module = await import("./browser-pdf-to-jpg");
  return new module.BrowserPdfToJpgProcessor();
}

export function createLazyPdfToJpgProcessor(loadProcessor: PdfToJpgProcessorLoader = loadBrowserProcessor): PdfToJpgProcessor {
  let processorPromise: Promise<PdfToJpgProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, onProgress: (progress: PdfToJpgProgress) => void, signal?: AbortSignal): Promise<PdfToJpgInspection> {
      return (await getProcessor()).inspect(file, onProgress, signal);
    },
    async convert(file: File, pageIndexes: readonly number[], quality: PdfToJpgQuality, onProgress: (progress: PdfToJpgProgress) => void, signal?: AbortSignal): Promise<PdfToJpgResult> {
      return (await getProcessor()).convert(file, pageIndexes, quality, onProgress, signal);
    },
  };
}
