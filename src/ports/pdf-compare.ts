import type { ExtractedTextDocument } from "../domain/pdf-compare";

export interface PdfTextExtractionProgress {
  readonly pageNumber: number;
  readonly totalPages: number;
}

export interface PdfTextExtractor {
  extract(
    file: File,
    onProgress: (progress: PdfTextExtractionProgress) => void,
    signal?: AbortSignal,
  ): Promise<ExtractedTextDocument>;
}
