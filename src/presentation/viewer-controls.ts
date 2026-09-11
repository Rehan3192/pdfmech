export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

export type ZoomLevel = number;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export interface FitZoomInput {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly mode: "width" | "page";
}

export interface StepZoomInput {
  readonly currentZoom: ZoomLevel;
  readonly direction: "in" | "out";
}

export interface ScaleZoomInput {
  readonly currentZoom: ZoomLevel;
  readonly scaleFactor: number;
}

export function isZoomLevel(value: number): value is ZoomLevel {
  return ZOOM_LEVELS.some((level) => level === value);
}

export function parseZoomLevel(value: string, fallback: ZoomLevel): ZoomLevel {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clampZoom(parsed) : fallback;
}

export function formatZoom(level: ZoomLevel): string {
  return `${Math.round(level * 100)}%`;
}

export function calculateFitZoom(input: FitZoomInput): ZoomLevel {
  const widthZoom = input.viewportWidth / input.pageWidth;
  const pageZoom = Math.min(widthZoom, input.viewportHeight / input.pageHeight);
  const fitZoom = input.mode === "width" ? widthZoom : pageZoom;
  return clampZoom(Math.floor(fitZoom * 100) / 100);
}

export function stepZoom(input: StepZoomInput): ZoomLevel {
  const multiplier = input.direction === "in" ? 1.1 : 1 / 1.1;
  return clampZoom(Math.round(input.currentZoom * multiplier * 100) / 100);
}

export function scaleZoom(input: ScaleZoomInput): ZoomLevel {
  if (!Number.isFinite(input.scaleFactor) || input.scaleFactor <= 0) {
    return input.currentZoom;
  }

  return clampZoom(Math.round(input.currentZoom * input.scaleFactor * 100) / 100);
}

export function getZoomBounds(): { readonly min: ZoomLevel; readonly max: ZoomLevel } {
  return {
    min: MIN_ZOOM,
    max: MAX_ZOOM,
  };
}

function clampZoom(value: number): ZoomLevel {
  return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);
}

export function clampPageIndex(pageIndex: number, pageCount: number): number {
  if (pageCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(pageIndex, 0), pageCount - 1);
}

export function getAdjacentPageIndex(
  currentPageIndex: number,
  pageCount: number,
  direction: -1 | 1,
): number {
  return clampPageIndex(currentPageIndex + direction, pageCount);
}
