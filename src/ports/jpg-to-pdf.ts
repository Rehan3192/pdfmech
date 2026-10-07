import type { JpgPdfOptions } from "../domain/jpg-to-pdf";

export interface JpgInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly width: number;
  readonly height: number;
}

export interface JpgPdfSource {
  readonly file: File;
  readonly width: number;
  readonly height: number;
}

export interface JpgToPdfProgress {
  readonly phase: "inspecting" | "normalizing" | "writing" | "validating";
  readonly completed: number;
  readonly total: number;
  readonly message: string;
}

export interface JpgToPdfResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly pageCount: number;
  readonly outputBytes: number;
}

export interface JpgToPdfProcessor {
  inspect(file: File, signal?: AbortSignal): Promise<JpgInspection>;
  convert(sources: readonly JpgPdfSource[], options: JpgPdfOptions, onProgress: (progress: JpgToPdfProgress) => void, signal?: AbortSignal): Promise<JpgToPdfResult>;
}
