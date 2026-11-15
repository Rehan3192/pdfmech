export interface WordConversionProgress {
  readonly message: string;
  readonly current?: number;
  readonly total?: number;
}

export interface PdfWordPage {
  readonly pageNumber: number;
  readonly lines: readonly string[];
}

export interface PdfWordInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly characterCount: number;
  readonly pages: readonly PdfWordPage[];
}

export interface PdfWordResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly outputBytes: number;
}

export interface PdfToWordProcessor {
  inspect(file: File, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<PdfWordInspection>;
  convert(inspection: PdfWordInspection, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<PdfWordResult>;
}

export interface WordInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly html: string;
  readonly wordCount: number;
  readonly blockCount: number;
  readonly warnings: readonly string[];
}

export interface WordPdfOptions {
  readonly pageSize: "a4" | "letter";
  readonly orientation: "portrait" | "landscape";
  readonly margin: "compact" | "normal" | "wide";
}

export interface WordPdfResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly outputBytes: number;
  readonly pageCount: number;
}

export interface WordToPdfProcessor {
  inspect(file: File, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<WordInspection>;
  convert(inspection: WordInspection, options: WordPdfOptions, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<WordPdfResult>;
}
