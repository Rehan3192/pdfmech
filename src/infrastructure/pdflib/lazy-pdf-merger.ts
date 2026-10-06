import type { MergePdfInspection, MergePdfProcessor, MergePdfProgress, MergePdfResult, MergePdfSource } from "../../ports/merge-pdf";

export type PdfMergerLoader = () => Promise<MergePdfProcessor>;

async function loadBrowserPdfMerger(): Promise<MergePdfProcessor> {
  const module = await import("./browser-pdf-merger");
  return new module.BrowserPdfMerger();
}

export function createLazyPdfMerger(loadProcessor: PdfMergerLoader = loadBrowserPdfMerger): MergePdfProcessor {
  let processorPromise: Promise<MergePdfProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, onProgress: (progress: MergePdfProgress) => void, signal?: AbortSignal): Promise<MergePdfInspection> {
      return (await getProcessor()).inspect(file, onProgress, signal);
    },
    async merge(sources: readonly MergePdfSource[], onProgress: (progress: MergePdfProgress) => void, signal?: AbortSignal): Promise<MergePdfResult> {
      return (await getProcessor()).merge(sources, onProgress, signal);
    },
  };
}
