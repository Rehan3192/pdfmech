import type { WatermarkOptions } from "../../domain/watermark-pdf";
import type { WatermarkInspection, WatermarkPdfProcessor, WatermarkProgress, WatermarkResult } from "../../ports/watermark-pdf";

export type WatermarkProcessorLoader = () => Promise<WatermarkPdfProcessor>;
async function loadBrowserProcessor(): Promise<WatermarkPdfProcessor> { const module = await import("./browser-pdf-watermarker"); return new module.BrowserPdfWatermarker(); }
export function createLazyPdfWatermarker(loadProcessor: WatermarkProcessorLoader = loadBrowserProcessor): WatermarkPdfProcessor {
  let processorPromise: Promise<WatermarkPdfProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File, onProgress: (progress: WatermarkProgress) => void, signal?: AbortSignal): Promise<WatermarkInspection> { return (await getProcessor()).inspect(file, onProgress, signal); },
    async apply(file: File, options: WatermarkOptions, onProgress: (progress: WatermarkProgress) => void, signal?: AbortSignal): Promise<WatermarkResult> { return (await getProcessor()).apply(file, options, onProgress, signal); },
  };
}
