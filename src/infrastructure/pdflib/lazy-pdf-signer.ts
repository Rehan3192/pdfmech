import type { SignaturePlacement } from "../../domain/sign-pdf";
import type { SignPdfInspection, SignPdfProcessor, SignPdfProgress, SignPdfResult } from "../../ports/sign-pdf";

export type SignPdfProcessorLoader = () => Promise<SignPdfProcessor>;
async function loadBrowserProcessor(): Promise<SignPdfProcessor> { const module = await import("./browser-pdf-signer"); return new module.BrowserPdfSigner(); }
export function createLazyPdfSigner(loadProcessor: SignPdfProcessorLoader = loadBrowserProcessor): SignPdfProcessor {
  let processorPromise: Promise<SignPdfProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, onProgress: (progress: SignPdfProgress) => void, signal?: AbortSignal): Promise<SignPdfInspection> { return (await getProcessor()).inspect(file, onProgress, signal); },
    async sign(file: File, signature: Blob, aspectRatio: number, placements: readonly SignaturePlacement[], onProgress: (progress: SignPdfProgress) => void, signal?: AbortSignal): Promise<SignPdfResult> { return (await getProcessor()).sign(file, signature, aspectRatio, placements, onProgress, signal); },
  };
}
