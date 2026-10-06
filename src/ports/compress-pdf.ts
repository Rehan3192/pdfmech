import type { PdfCompressionLevel } from "../domain/compress-pdf";

export interface CompressPdfPagePreview {
  readonly pageIndex: number;
  readonly width: number;
  readonly height: number;
  readonly thumbnail: Blob;
}

export interface CompressPdfInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly hasSignatures: boolean;
  readonly pages: readonly CompressPdfPagePreview[];
}

export interface CompressPdfProgress {
  readonly phase: "inspecting" | "rendering" | "writing" | "validating";
  readonly completedPages: number;
  readonly totalPages: number;
  readonly message: string;
}

export interface CompressPdfResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly pageCount: number;
  readonly sourceBytes: number;
  readonly outputBytes: number;
  readonly reductionPercent: number;
  readonly level: PdfCompressionLevel;
  readonly wasReduced: boolean;
}

export interface CompressPdfProcessor {
  inspect(
    file: File,
    onProgress: (progress: CompressPdfProgress) => void,
    signal?: AbortSignal,
  ): Promise<CompressPdfInspection>;
  compress(
    file: File,
    level: PdfCompressionLevel,
    onProgress: (progress: CompressPdfProgress) => void,
    signal?: AbortSignal,
  ): Promise<CompressPdfResult>;
}
