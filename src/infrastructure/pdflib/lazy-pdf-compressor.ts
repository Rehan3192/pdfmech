import type { PdfCompressionLevel } from "../../domain/compress-pdf";
import type { CompressPdfInspection, CompressPdfProcessor, CompressPdfProgress, CompressPdfResult } from "../../ports/compress-pdf";

export type CompressPdfProcessorLoader = () => Promise<CompressPdfProcessor>;

async function loadBrowserPdfCompressor(): Promise<CompressPdfProcessor> {
  const module = await import("./browser-pdf-compressor");
  return new module.BrowserPdfCompressor();
}

export function createLazyPdfCompressor(loadProcessor: CompressPdfProcessorLoader = loadBrowserPdfCompressor): CompressPdfProcessor {
  let processorPromise: Promise<CompressPdfProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, onProgress: (progress: CompressPdfProgress) => void, signal?: AbortSignal): Promise<CompressPdfInspection> {
      return (await getProcessor()).inspect(file, onProgress, signal);
    },
    async compress(file: File, level: PdfCompressionLevel, onProgress: (progress: CompressPdfProgress) => void, signal?: AbortSignal): Promise<CompressPdfResult> {
      return (await getProcessor()).compress(file, level, onProgress, signal);
    },
  };
}
