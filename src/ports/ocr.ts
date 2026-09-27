import type { OcrWordBox } from "../domain/ocr";

export interface OcrInspectionPage {
  readonly pageIndex: number;
  readonly width: number;
  readonly height: number;
  readonly hasUsefulNativeText: boolean;
  readonly thumbnail: Blob | null;
}

export interface OcrInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly pages: readonly OcrInspectionPage[];
}

export type OcrProgressPhase =
  | "loading-engine"
  | "rendering-page"
  | "recognizing-text"
  | "writing-pdf"
  | "validating-output";

export interface OcrProgress {
  readonly phase: OcrProgressPhase;
  readonly pageNumber: number | null;
  readonly totalPages: number;
  readonly completedPages: number;
  readonly pageProgress: number;
  readonly overallProgress: number;
  readonly message: string;
}

export interface OcrProcessOptions {
  readonly pageIndexes: readonly number[];
  readonly language: "eng";
}

export interface OcrPageResult {
  readonly pageIndex: number;
  readonly text: string;
  readonly confidence: number | null;
  readonly words: readonly OcrWordBox[];
  readonly source: "native" | "ocr";
}

export interface OcrProcessResult {
  readonly searchablePdf: Blob;
  readonly extractedText: Blob;
  readonly pages: readonly OcrPageResult[];
  readonly processedPageCount: number;
  readonly skippedNativePageCount: number;
  readonly durationMs: number;
}

export interface OcrProcessor {
  inspect(file: File, signal?: AbortSignal): Promise<OcrInspection>;
  process(
    file: File,
    options: OcrProcessOptions,
    onProgress: (progress: OcrProgress) => void,
    signal?: AbortSignal,
  ): Promise<OcrProcessResult>;
}
