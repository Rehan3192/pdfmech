import type { WatermarkOptions } from "../domain/watermark-pdf";

export interface WatermarkPagePreview { readonly pageIndex: number; readonly width: number; readonly height: number; readonly thumbnail: Blob; }
export interface WatermarkInspection { readonly fileName: string; readonly byteLength: number; readonly pageCount: number; readonly hasSignatures: boolean; readonly pages: readonly WatermarkPagePreview[]; }
export interface WatermarkProgress { readonly phase: "inspecting" | "applying" | "validating"; readonly completedPages: number; readonly totalPages: number; readonly message: string; }
export interface WatermarkResult { readonly blob: Blob; readonly downloadName: string; readonly pageCount: number; readonly watermarkedPageCount: number; }
export interface WatermarkPdfProcessor {
  inspect(file: File, onProgress: (progress: WatermarkProgress) => void, signal?: AbortSignal): Promise<WatermarkInspection>;
  apply(file: File, options: WatermarkOptions, onProgress: (progress: WatermarkProgress) => void, signal?: AbortSignal): Promise<WatermarkResult>;
}
