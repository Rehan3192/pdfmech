import type { ProtectPdfPermissions } from "../../domain/protect-pdf";
import type { ProtectPdfInspection, ProtectPdfProcessor, ProtectPdfProgress, ProtectPdfResult } from "../../ports/protect-pdf";

export type ProtectPdfProcessorLoader = () => Promise<ProtectPdfProcessor>;

async function loadBrowserPdfProtector(): Promise<ProtectPdfProcessor> {
  const module = await import("./browser-pdf-protector");
  return new module.BrowserPdfProtector();
}

export function createLazyPdfProtector(loadProcessor: ProtectPdfProcessorLoader = loadBrowserPdfProtector): ProtectPdfProcessor {
  let processorPromise: Promise<ProtectPdfProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, onProgress: (progress: ProtectPdfProgress) => void, signal?: AbortSignal): Promise<ProtectPdfInspection> {
      return (await getProcessor()).inspect(file, onProgress, signal);
    },
    async protect(file: File, password: string, permissions: ProtectPdfPermissions, onProgress: (progress: ProtectPdfProgress) => void, signal?: AbortSignal): Promise<ProtectPdfResult> {
      return (await getProcessor()).protect(file, password, permissions, onProgress, signal);
    },
  };
}
