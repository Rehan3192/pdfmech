export interface ExtractPagePreview {
  readonly pageIndex: number;
  readonly width: number;
  readonly height: number;
  readonly thumbnail: Blob;
}

export interface ExtractPagesInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly hasSignatures: boolean;
  readonly pages: readonly ExtractPagePreview[];
}

export interface ExtractPagesProgress {
  readonly phase: "inspecting" | "copying" | "validating";
  readonly completedPages: number;
  readonly totalPages: number;
  readonly message: string;
}

export interface ExtractPagesResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly extractedPageCount: number;
}

export interface ExtractPagesProcessor {
  inspect(file: File, onProgress: (progress: ExtractPagesProgress) => void, signal?: AbortSignal): Promise<ExtractPagesInspection>;
  extract(file: File, pageIndexes: readonly number[], onProgress: (progress: ExtractPagesProgress) => void, signal?: AbortSignal): Promise<ExtractPagesResult>;
}
