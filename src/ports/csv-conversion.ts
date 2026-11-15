import type { CsvDelimiter } from "../domain/csv-conversion";

export interface CsvConversionProgress { readonly message: string; readonly current?: number; readonly total?: number; }
export interface CsvInspection {
  readonly fileName: string; readonly byteLength: number; readonly delimiter: CsvDelimiter;
  readonly rows: readonly (readonly string[])[]; readonly rowCount: number; readonly columnCount: number;
}
export interface CsvPdfOptions {
  readonly pageSize: "a4" | "letter"; readonly orientation: "portrait" | "landscape";
  readonly density: "compact" | "balanced" | "large"; readonly firstRowHeader: boolean;
}
export interface CsvPdfResult { readonly blob: Blob; readonly downloadName: string; readonly outputBytes: number; readonly pageCount: number; }
export interface CsvToPdfProcessor {
  inspect(file: File, onProgress: (progress: CsvConversionProgress) => void, signal?: AbortSignal): Promise<CsvInspection>;
  convert(inspection: CsvInspection, options: CsvPdfOptions, onProgress: (progress: CsvConversionProgress) => void, signal?: AbortSignal): Promise<CsvPdfResult>;
}

export interface PdfCsvRow { readonly pageNumber: number; readonly cells: readonly string[]; }
export interface PdfCsvInspection {
  readonly fileName: string; readonly byteLength: number; readonly pageCount: number;
  readonly rows: readonly PdfCsvRow[]; readonly columnCount: number; readonly emptyPageCount: number;
}
export interface PdfCsvOptions { readonly includePageColumn: boolean; readonly removeEmptyRows: boolean; }
export interface PdfCsvResult { readonly blob: Blob; readonly downloadName: string; readonly outputBytes: number; readonly rowCount: number; readonly columnCount: number; }
export interface PdfToCsvProcessor {
  inspect(file: File, onProgress: (progress: CsvConversionProgress) => void, signal?: AbortSignal): Promise<PdfCsvInspection>;
  convert(inspection: PdfCsvInspection, options: PdfCsvOptions): PdfCsvResult;
}
