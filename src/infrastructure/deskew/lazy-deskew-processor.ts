import type { DeskewAdjustment, DeskewInspection, DeskewProcessor, DeskewProgress, DeskewResult } from "../../ports/deskew";

export type DeskewProcessorLoader = () => Promise<DeskewProcessor>;

async function loadBrowserDeskewProcessor(): Promise<DeskewProcessor> {
  const module = await import("./browser-deskew-processor");
  return new module.BrowserDeskewProcessor();
}

export function createLazyDeskewProcessor(
  loadProcessor: DeskewProcessorLoader = loadBrowserDeskewProcessor,
): DeskewProcessor {
  let processorPromise: Promise<DeskewProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, onProgress: (progress: DeskewProgress) => void, signal?: AbortSignal): Promise<DeskewInspection> {
      return (await getProcessor()).inspect(file, onProgress, signal);
    },
    async process(file: File, adjustments: readonly DeskewAdjustment[], onProgress: (progress: DeskewProgress) => void, signal?: AbortSignal): Promise<DeskewResult> {
      return (await getProcessor()).process(file, adjustments, onProgress, signal);
    },
  };
}

