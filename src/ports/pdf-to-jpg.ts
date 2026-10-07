import type { PdfToJpgQuality } from "../domain/pdf-to-jpg";

export interface PdfToJpgPagePreview {
  readonly pageIndex: number;
  readonly width: number;
  readonly height: number;
  readonly thumbnail: Blob;
}

export interface PdfToJpgInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly pages: readonly PdfToJpgPagePreview[];
}

export interface PdfToJpgProgress {
  readonly phase: "inspecting" | "rendering" | "packaging";
  readonly completedPages: number;
  readonly totalPages: number;
  readonly message: string;
}

export interface PdfToJpgResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly imageCount: number;
  readonly outputBytes: number;
  readonly isZip: boolean;
  readonly quality: PdfToJpgQuality;
}

export interface PdfToJpgProcessor {
  inspect(file: File, onProgress: (progress: PdfToJpgProgress) => void, signal?: AbortSignal): Promise<PdfToJpgInspection>;
  convert(file: File, pageIndexes: readonly number[], quality: PdfToJpgQuality, onProgress: (progress: PdfToJpgProgress) => void, signal?: AbortSignal): Promise<PdfToJpgResult>;
}
