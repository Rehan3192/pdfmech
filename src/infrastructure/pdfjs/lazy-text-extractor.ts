import type { ExtractedTextDocument } from "../../domain/pdf-compare";
import type { PdfTextExtractionProgress, PdfTextExtractor } from "../../ports/pdf-compare";

export type PdfTextExtractorLoader = () => Promise<PdfTextExtractor>;

async function loadBrowserTextExtractor(): Promise<PdfTextExtractor> {
  const module = await import("./browser-text-extractor");
  return new module.BrowserPdfTextExtractor();
}

export function createLazyPdfTextExtractor(
  loadExtractor: PdfTextExtractorLoader = loadBrowserTextExtractor,
): PdfTextExtractor {
  let extractorPromise: Promise<PdfTextExtractor> | null = null;
  const getExtractor = () => (extractorPromise ??= loadExtractor());
  return {
    async extract(
      file: File,
      onProgress: (progress: PdfTextExtractionProgress) => void,
      signal?: AbortSignal,
    ): Promise<ExtractedTextDocument> {
      return (await getExtractor()).extract(file, onProgress, signal);
    },
  };
}
