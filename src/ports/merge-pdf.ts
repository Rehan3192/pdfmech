export interface MergePdfInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly firstPageWidth: number;
  readonly firstPageHeight: number;
  readonly thumbnail: Blob;
  readonly hasSignatures: boolean;
}

export interface MergePdfSource {
  readonly file: File;
  readonly pageCount: number;
}

export interface MergePdfProgress {
  readonly phase: "inspecting" | "copying" | "validating";
  readonly completed: number;
  readonly total: number;
  readonly message: string;
}

export interface MergePdfResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly mergedFileCount: number;
  readonly pageCount: number;
}

export interface MergePdfProcessor {
  inspect(file: File, onProgress: (progress: MergePdfProgress) => void, signal?: AbortSignal): Promise<MergePdfInspection>;
  merge(sources: readonly MergePdfSource[], onProgress: (progress: MergePdfProgress) => void, signal?: AbortSignal): Promise<MergePdfResult>;
}
