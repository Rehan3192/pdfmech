export type PdfCompressionLevel = "light" | "balanced" | "strong";

export interface PdfCompressionPreset {
  readonly level: PdfCompressionLevel;
  readonly label: string;
  readonly description: string;
  readonly renderScale: number;
  readonly jpegQuality: number;
}

export const PDF_COMPRESSION_PRESETS: readonly PdfCompressionPreset[] = [
  {
    level: "light",
    label: "Light",
    description: "Sharper pages with a smaller reduction.",
    renderScale: 2,
    jpegQuality: 0.88,
  },
  {
    level: "balanced",
    label: "Balanced",
    description: "Recommended for sharing and email.",
    renderScale: 1.5,
    jpegQuality: 0.78,
  },
  {
    level: "strong",
    label: "Strong",
    description: "Smallest files with softer page detail.",
    renderScale: 1.15,
    jpegQuality: 0.65,
  },
] as const;

export function compressionPreset(level: PdfCompressionLevel): PdfCompressionPreset {
  const preset = PDF_COMPRESSION_PRESETS.find((item) => item.level === level);
  if (preset === undefined) throw new Error("Choose a valid PDF compression level.");
  return preset;
}

export function reductionPercent(sourceBytes: number, outputBytes: number): number {
  if (!Number.isFinite(sourceBytes) || sourceBytes <= 0 || !Number.isFinite(outputBytes) || outputBytes < 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - outputBytes / sourceBytes) * 100)));
}
