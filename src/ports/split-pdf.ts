import type { ExtractPagePreview } from "./extract-pages";
import type { SplitPageGroup } from "../domain/split-pdf";

export interface SplitPdfInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly hasSignatures: boolean;
  readonly pages: readonly ExtractPagePreview[];
}

export interface SplitPdfProgress {
  readonly phase: "inspecting" | "copying" | "validating" | "packaging";
  readonly completedPages: number;
  readonly totalPages: number;
  readonly message: string;
}

export interface SplitPdfOutput {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly label: string;
  readonly pageCount: number;
}

export interface SplitPdfResult {
  readonly files: readonly SplitPdfOutput[];
  readonly zipBlob: Blob;
  readonly zipDownloadName: string;
  readonly outputCount: number;
  readonly pageCount: number;
}

export interface SplitPdfProcessor {
  inspect(file: File, onProgress: (progress: SplitPdfProgress) => void, signal?: AbortSignal): Promise<SplitPdfInspection>;
  split(file: File, groups: readonly SplitPageGroup[], onProgress: (progress: SplitPdfProgress) => void, signal?: AbortSignal): Promise<SplitPdfResult>;
}
