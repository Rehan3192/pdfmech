export type JpgPdfPageSize = "fit" | "a4" | "letter";
export type JpgPdfOrientation = "auto" | "portrait" | "landscape";
export type JpgPdfMargin = "none" | "small" | "large";

export interface JpgPdfOptions {
  readonly pageSize: JpgPdfPageSize;
  readonly orientation: JpgPdfOrientation;
  readonly margin: JpgPdfMargin;
}

export const JPG_TO_PDF_LIMITS = {
  maxFiles: 25,
  maxFileBytes: 30 * 1024 * 1024,
  maxTotalBytes: 150 * 1024 * 1024,
  maxPixelsPerImage: 50_000_000,
} as const;

export const JPG_PDF_MARGIN_POINTS: Readonly<Record<JpgPdfMargin, number>> = {
  none: 0,
  small: 24,
  large: 48,
};

export function moveJpgItem<T>(items: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) return items;
  next.splice(toIndex, 0, item);
  return next;
}

export function jpgPdfPageDimensions(imageWidth: number, imageHeight: number, options: JpgPdfOptions): readonly [number, number] {
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) throw new Error("The JPG dimensions are not valid.");
  let width: number;
  let height: number;
  if (options.pageSize === "a4") [width, height] = [595.28, 841.89];
  else if (options.pageSize === "letter") [width, height] = [612, 792];
  else {
    const scale = Math.min(1, 792 / Math.max(imageWidth, imageHeight));
    width = Math.max(72, imageWidth * scale);
    height = Math.max(72, imageHeight * scale);
  }
  const shouldLandscape = options.orientation === "landscape" || (options.orientation === "auto" && imageWidth > imageHeight);
  const shouldPortrait = options.orientation === "portrait" || (options.orientation === "auto" && imageWidth <= imageHeight);
  if ((shouldLandscape && width < height) || (shouldPortrait && width > height)) [width, height] = [height, width];
  return [width, height];
}

export function fitJpgOnPage(imageWidth: number, imageHeight: number, pageWidth: number, pageHeight: number, margin: number) {
  const availableWidth = Math.max(1, pageWidth - margin * 2);
  const availableHeight = Math.max(1, pageHeight - margin * 2);
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height } as const;
}
