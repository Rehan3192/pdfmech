export interface UnlockPdfInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly requiresPassword: boolean;
}

export interface UnlockPdfProgress {
  readonly phase: "loading-engine" | "inspecting" | "decrypting" | "verifying";
  readonly message: string;
}

export interface UnlockPdfResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly pageCount: number;
}

export interface UnlockPdfProcessor {
  inspect(file: File, onProgress: (progress: UnlockPdfProgress) => void, signal?: AbortSignal): Promise<UnlockPdfInspection>;
  unlock(file: File, password: string, onProgress: (progress: UnlockPdfProgress) => void, signal?: AbortSignal): Promise<UnlockPdfResult>;
}
