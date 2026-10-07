import type { SignaturePlacement } from "../domain/sign-pdf";

export interface SignPagePreview { readonly pageIndex: number; readonly width: number; readonly height: number; readonly thumbnail: Blob; }
export interface SignPdfInspection { readonly fileName: string; readonly byteLength: number; readonly pageCount: number; readonly hasSignatures: boolean; readonly pages: readonly SignPagePreview[]; }
export interface SignPdfProgress { readonly phase: "inspecting" | "signing" | "validating"; readonly completed: number; readonly total: number; readonly message: string; }
export interface SignPdfResult { readonly blob: Blob; readonly downloadName: string; readonly pageCount: number; readonly signatureCount: number; }
export interface SignPdfProcessor {
  inspect(file: File, onProgress: (progress: SignPdfProgress) => void, signal?: AbortSignal): Promise<SignPdfInspection>;
  sign(file: File, signature: Blob, aspectRatio: number, placements: readonly SignaturePlacement[], onProgress: (progress: SignPdfProgress) => void, signal?: AbortSignal): Promise<SignPdfResult>;
}
