import type { UnlockPdfInspection, UnlockPdfProcessor, UnlockPdfProgress, UnlockPdfResult } from "../../ports/unlock-pdf";

export type UnlockPdfProcessorLoader = () => Promise<UnlockPdfProcessor>;

async function loadBrowserPdfUnlocker(): Promise<UnlockPdfProcessor> {
  const module = await import("./browser-pdf-unlocker");
  return new module.BrowserPdfUnlocker();
}

export function createLazyPdfUnlocker(loadProcessor: UnlockPdfProcessorLoader = loadBrowserPdfUnlocker): UnlockPdfProcessor {
  let processorPromise: Promise<UnlockPdfProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, onProgress: (progress: UnlockPdfProgress) => void, signal?: AbortSignal): Promise<UnlockPdfInspection> {
      return (await getProcessor()).inspect(file, onProgress, signal);
    },
    async unlock(file: File, password: string, onProgress: (progress: UnlockPdfProgress) => void, signal?: AbortSignal): Promise<UnlockPdfResult> {
      return (await getProcessor()).unlock(file, password, onProgress, signal);
    },
  };
}
