export type FillableFieldKind = "text" | "checkbox" | "radio" | "dropdown" | "option-list";

export type FormFieldValue = string | boolean | readonly string[];

export const FILL_PDF_LIMITS = {
  maxFileBytes: 100 * 1024 * 1024,
  maxPages: 1_000,
  maxFields: 2_000,
} as const;

export function filledPdfName(fileName: string): string {
  return `${fileName.replace(/\.pdf$/i, "") || "document"}-filled.pdf`;
}

export function isCompletedFormValue(value: FormFieldValue): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().length > 0;
  return value.length > 0;
}

export function normalizeSelectedOptions(value: readonly string[], options: readonly string[]): readonly string[] {
  const allowed = new Set(options);
  return [...new Set(value.filter((item) => allowed.has(item)))];
}
