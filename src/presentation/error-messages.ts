import type { EditorErrorCode } from "../domain/errors";

const pdfErrorMessages: Readonly<Record<EditorErrorCode, string>> = {
  FILE_TYPE_UNSUPPORTED:
    "This file type is not supported. Please choose a PDF file.",
  FILE_TOO_LARGE:
    "This PDF is larger than the local editing limit. Try a smaller PDF or split it first.",
  PAGE_COUNT_EXCEEDED:
    "This PDF has more pages than the local editor can safely handle right now.",
  PDF_MALFORMED:
    "This PDF appears to be damaged or malformed, so it could not be opened safely.",
  PDF_ENCRYPTED_UNSUPPORTED:
    "Password-protected PDFs are not supported yet. Please unlock the PDF and try again.",
  PDF_FEATURE_UNSUPPORTED:
    "This PDF uses features this editor does not support yet.",
  PDF_SIGNATURE_ACK_REQUIRED:
    "This PDF contains a digital signature. Editing signed PDFs can invalidate signatures, so signed PDFs are blocked for now.",
  RENDER_RESOURCE_LIMIT:
    "This page is too large to render safely in the browser.",
  RENDER_FAILED:
    "This PDF page could not be rendered safely. Try another PDF or a lower zoom level.",
  COMMAND_INVALID: "That edit could not be applied to this document.",
  ASSET_INVALID: "That file cannot be inserted into the PDF.",
  STORAGE_QUOTA:
    "Local browser storage is full, so recovery data could not be saved.",
  RECOVERY_CORRUPT:
    "The local recovery checkpoint failed integrity checks and cannot be restored.",
  EXPORT_FAILED:
    "The edited PDF could not be exported. Your original PDF has not been changed.",
  EXPORT_VALIDATION_FAILED:
    "The exported PDF failed validation, so the download was blocked to avoid a corrupted file.",
  WORKER_PROTOCOL_ERROR:
    "The local PDF worker returned an unexpected response. Please reload and try again.",
  OUT_OF_MEMORY_SUSPECTED:
    "The browser may not have enough memory to process this PDF safely.",
  UNEXPECTED_INTERNAL:
    "Something unexpected happened in the local editor. Please reload and try again.",
};

export function safeErrorMessage(error: unknown): string {
  const code = getEditorErrorCode(error);
  if (code !== null) {
    return pdfErrorMessages[code];
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    if (isKnownMalformedPdfMessage(error.message)) {
      return pdfErrorMessages.PDF_MALFORMED;
    }

    return error.message;
  }

  return "This PDF could not be opened safely.";
}

function isKnownMalformedPdfMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid pdf") ||
    normalized.includes("pdf structure") ||
    normalized.includes("no pdf header") ||
    normalized.includes("bad xref") ||
    normalized.includes("xref")
  );
}

function getEditorErrorCode(error: unknown): EditorErrorCode | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  ) {
    return null;
  }

  return isEditorErrorCode(error.code) ? error.code : null;
}

function isEditorErrorCode(code: string): code is EditorErrorCode {
  return code in pdfErrorMessages;
}
