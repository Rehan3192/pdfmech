import type { ExtractPagesInspection, ExtractPagesProcessor, ExtractPagesProgress, ExtractPagesResult } from "../../ports/extract-pages";

export type PageExtractorLoader = () => Promise<ExtractPagesProcessor>;

async function loadBrowserPageExtractor(): Promise<ExtractPagesProcessor> {
  const module = await import("./browser-page-extractor");
  return new module.BrowserPageExtractor();
}

export function createLazyPageExtractor(loadProcessor: PageExtractorLoader = loadBrowserPageExtractor): ExtractPagesProcessor {
  let processorPromise: Promise<ExtractPagesProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, onProgress: (progress: ExtractPagesProgress) => void, signal?: AbortSignal): Promise<ExtractPagesInspection> {
      return (await getProcessor()).inspect(file, onProgress, signal);
    },
    async extract(file: File, pageIndexes: readonly number[], onProgress: (progress: ExtractPagesProgress) => void, signal?: AbortSignal): Promise<ExtractPagesResult> {
      return (await getProcessor()).extract(file, pageIndexes, onProgress, signal);
    },
  };
}
