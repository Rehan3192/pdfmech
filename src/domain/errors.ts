export type EditorErrorCode =
  | "FILE_TYPE_UNSUPPORTED"
  | "FILE_TOO_LARGE"
  | "PAGE_COUNT_EXCEEDED"
  | "PDF_MALFORMED"
  | "PDF_ENCRYPTED_UNSUPPORTED"
  | "PDF_FEATURE_UNSUPPORTED"
  | "PDF_SIGNATURE_ACK_REQUIRED"
  | "RENDER_RESOURCE_LIMIT"
  | "RENDER_FAILED"
  | "COMMAND_INVALID"
  | "ASSET_INVALID"
  | "STORAGE_QUOTA"
  | "RECOVERY_CORRUPT"
  | "EXPORT_FAILED"
  | "EXPORT_VALIDATION_FAILED"
  | "WORKER_PROTOCOL_ERROR"
  | "OUT_OF_MEMORY_SUSPECTED"
  | "UNEXPECTED_INTERNAL";

export interface EditorError {
  readonly code: EditorErrorCode;
  readonly retryable: boolean;
  readonly messageKey: string;
  readonly correlationId: string;
  readonly safeMetadata: Readonly<Record<string, string | number | boolean>>;
}
