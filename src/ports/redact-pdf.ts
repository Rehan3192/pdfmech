import type { PdfRedaction } from "../domain/redact-pdf";

export interface RedactPdfPagePreview {
  readonly pageIndex: number;
  readonly width: number;
  readonly height: number;
  readonly thumbnail: Blob;
}

export interface RedactPdfInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly hasSignatures: boolean;
  readonly pages: readonly RedactPdfPagePreview[];
}

export interface RedactPdfProgress {
  readonly phase: "inspecting" | "previewing" | "rendering" | "copying" | "writing" | "validating";
  readonly completedPages: number;
  readonly totalPages: number;
  readonly message: string;
}

export interface RedactPdfResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly pageCount: number;
  readonly redactionCount: number;
  readonly redactedPageCount: number;
  readonly preservedPageCount: number;
}

export interface RedactPdfProcessor {
  inspect(file: File, onProgress: (progress: RedactPdfProgress) => void, signal?: AbortSignal): Promise<RedactPdfInspection>;
  renderPreview(file: File, pageIndex: number, signal?: AbortSignal): Promise<Blob>;
  redact(file: File, redactions: readonly PdfRedaction[], onProgress: (progress: RedactPdfProgress) => void, signal?: AbortSignal): Promise<RedactPdfResult>;
}
