import type { PdfToWordProcessor, PdfWordInspection, PdfWordResult, WordConversionProgress } from "../../ports/word-conversion";

export function createLazyPdfToWordProcessor(): PdfToWordProcessor {
  let processorPromise: Promise<PdfToWordProcessor> | null = null;
  const load = () => processorPromise ??= import("./browser-pdf-to-word").then(({ BrowserPdfToWordProcessor }) => new BrowserPdfToWordProcessor());
  return {
    inspect: async (file: File, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<PdfWordInspection> => (await load()).inspect(file, onProgress, signal),
    convert: async (inspection: PdfWordInspection, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<PdfWordResult> => (await load()).convert(inspection, onProgress, signal),
  };
}
