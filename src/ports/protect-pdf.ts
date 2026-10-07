import type { ProtectPdfPermissions } from "../domain/protect-pdf";

export interface ProtectPdfInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly hasSignatures: boolean;
  readonly preview: Blob;
}

export interface ProtectPdfProgress {
  readonly phase: "inspecting" | "loading-engine" | "encrypting" | "verifying";
  readonly message: string;
}

export interface ProtectPdfResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly pageCount: number;
  readonly encryption: "AES-256";
}

export interface ProtectPdfProcessor {
  inspect(file: File, onProgress: (progress: ProtectPdfProgress) => void, signal?: AbortSignal): Promise<ProtectPdfInspection>;
  protect(
    file: File,
    password: string,
    permissions: ProtectPdfPermissions,
    onProgress: (progress: ProtectPdfProgress) => void,
    signal?: AbortSignal,
  ): Promise<ProtectPdfResult>;
}
