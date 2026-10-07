import type { JpgPdfOptions } from "../../domain/jpg-to-pdf";
import type { JpgInspection, JpgPdfSource, JpgToPdfProcessor, JpgToPdfProgress, JpgToPdfResult } from "../../ports/jpg-to-pdf";

export type JpgToPdfProcessorLoader = () => Promise<JpgToPdfProcessor>;

async function loadBrowserProcessor(): Promise<JpgToPdfProcessor> {
  const module = await import("./browser-jpg-to-pdf");
  return new module.BrowserJpgToPdfProcessor();
}

export function createLazyJpgToPdfProcessor(loadProcessor: JpgToPdfProcessorLoader = loadBrowserProcessor): JpgToPdfProcessor {
  let processorPromise: Promise<JpgToPdfProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, signal?: AbortSignal): Promise<JpgInspection> { return (await getProcessor()).inspect(file, signal); },
    async convert(sources: readonly JpgPdfSource[], options: JpgPdfOptions, onProgress: (progress: JpgToPdfProgress) => void, signal?: AbortSignal): Promise<JpgToPdfResult> {
      return (await getProcessor()).convert(sources, options, onProgress, signal);
    },
  };
}
