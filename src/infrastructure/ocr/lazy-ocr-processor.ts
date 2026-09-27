import type {
  OcrInspection,
  OcrProcessOptions,
  OcrProcessResult,
  OcrProcessor,
  OcrProgress,
} from "../../ports/ocr";

export type OcrProcessorLoader = () => Promise<OcrProcessor>;

async function loadBrowserOcrProcessor(): Promise<OcrProcessor> {
  const module = await import("./browser-ocr-processor");
  return new module.BrowserOcrProcessor();
}

export function createLazyOcrProcessor(
  loadProcessor: OcrProcessorLoader = loadBrowserOcrProcessor,
): OcrProcessor {
  let processorPromise: Promise<OcrProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());

  return {
    async inspect(file: File, signal?: AbortSignal): Promise<OcrInspection> {
      return (await getProcessor()).inspect(file, signal);
    },
    async process(
      file: File,
      options: OcrProcessOptions,
      onProgress: (progress: OcrProgress) => void,
      signal?: AbortSignal,
    ): Promise<OcrProcessResult> {
      return (await getProcessor()).process(
        file,
        options,
        onProgress,
        signal,
      );
    },
  };
}
