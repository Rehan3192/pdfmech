export type PdfToJpgQuality = "web" | "balanced" | "high";

export interface PdfToJpgPreset {
  readonly quality: PdfToJpgQuality;
  readonly label: string;
  readonly description: string;
  readonly renderScale: number;
  readonly jpegQuality: number;
}

export const PDF_TO_JPG_PRESETS: readonly PdfToJpgPreset[] = [
  { quality: "web", label: "Web", description: "Smaller images for sharing and websites.", renderScale: 1.15, jpegQuality: 0.72 },
  { quality: "balanced", label: "Balanced", description: "Clear pages at a practical file size.", renderScale: 1.5, jpegQuality: 0.82 },
  { quality: "high", label: "High", description: "Sharper text and graphics for detailed use.", renderScale: 2, jpegQuality: 0.92 },
] as const;

export function pdfToJpgPreset(quality: PdfToJpgQuality): PdfToJpgPreset {
  const preset = PDF_TO_JPG_PRESETS.find((item) => item.quality === quality);
  if (preset === undefined) throw new Error("Choose a valid JPG quality.");
  return preset;
}

export function parsePdfPageSelection(value: string, pageCount: number): readonly number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new RangeError("The PDF must contain at least one page.");
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error("Enter at least one page or page range.");
  const selected = new Set<number>();
  for (const part of parts) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    const start = range === null ? parsePage(part) : Number(range[1]);
    const end = range === null ? start : Number(range[2]);
    if (start < 1 || end < start || end > pageCount) throw new Error(`Page range "${part}" is outside this PDF.`);
    for (let page = start; page <= end; page += 1) selected.add(page - 1);
  }
  return [...selected].sort((left, right) => left - right);
}

export function pdfPageImageName(fileName: string, pageNumber: number, pageCount: number): string {
  const baseName = fileName.replace(/\.pdf$/i, "") || "document";
  const digits = Math.max(2, String(pageCount).length);
  return `${baseName}-page-${String(pageNumber).padStart(digits, "0")}.jpg`;
}

function parsePage(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`Page range "${value}" is not valid.`);
  return Number(value);
}
