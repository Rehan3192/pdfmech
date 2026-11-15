import type { WordConversionProgress, WordInspection, WordPdfOptions, WordPdfResult, WordToPdfProcessor } from "../../ports/word-conversion";

export function createLazyWordToPdfProcessor(): WordToPdfProcessor {
  let processorPromise: Promise<WordToPdfProcessor> | null = null;
  const load = () => processorPromise ??= import("./browser-word-to-pdf").then(({ BrowserWordToPdfProcessor }) => new BrowserWordToPdfProcessor());
  return {
    inspect: async (file: File, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<WordInspection> => (await load()).inspect(file, onProgress, signal),
    convert: async (inspection: WordInspection, options: WordPdfOptions, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<WordPdfResult> => (await load()).convert(inspection, options, onProgress, signal),
  };
}
