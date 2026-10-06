export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
}

export interface PdfRedaction {
  readonly id: string;
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function createNormalizedRedaction(
  id: string,
  pageIndex: number,
  start: NormalizedPoint,
  end: NormalizedPoint,
): PdfRedaction | null {
  if (!Number.isInteger(pageIndex) || pageIndex < 0) return null;
  const startX = clampUnit(start.x);
  const startY = clampUnit(start.y);
  const endX = clampUnit(end.x);
  const endY = clampUnit(end.y);
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  if (width < 0.008 || height < 0.008) return null;
  return { id, pageIndex, x, y, width, height };
}

export function isValidRedaction(redaction: PdfRedaction, pageCount: number): boolean {
  return Number.isInteger(redaction.pageIndex) &&
    redaction.pageIndex >= 0 &&
    redaction.pageIndex < pageCount &&
    redaction.x >= 0 && redaction.y >= 0 &&
    redaction.width > 0 && redaction.height > 0 &&
    redaction.x + redaction.width <= 1.000001 &&
    redaction.y + redaction.height <= 1.000001;
}

export function redactedPageCount(redactions: readonly PdfRedaction[]): number {
  return new Set(redactions.map((redaction) => redaction.pageIndex)).size;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
