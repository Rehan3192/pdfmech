import type {
  CanonicalFrame,
  CanonicalPageSize,
  CanonicalPoint,
} from "../domain/geometry";
import { asPdfPoint } from "../domain/primitives";

export interface CssFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportPointInput {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly pageSize: CanonicalPageSize;
}

export interface MoveFrameByViewportDeltaInput {
  readonly frame: CanonicalFrame;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly zoom: number;
  readonly pageSize: CanonicalPageSize;
}

export interface ResizeFrameByViewportDeltaInput {
  readonly frame: CanonicalFrame;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly zoom: number;
  readonly pageSize: CanonicalPageSize;
  readonly minimumWidth?: number;
  readonly minimumHeight?: number;
}

export interface DuplicateFrameInput {
  readonly frame: CanonicalFrame;
  readonly pageSize: CanonicalPageSize;
  readonly offset?: number;
}

const DEFAULT_TEXT_WIDTH = 180;
const DEFAULT_TEXT_HEIGHT = 28;
const DEFAULT_WHITEOUT_WIDTH = 180;
const DEFAULT_WHITEOUT_HEIGHT = 36;
const DEFAULT_REDACTION_WIDTH = 180;
const DEFAULT_REDACTION_HEIGHT = 36;
const DEFAULT_MINIMUM_RESIZE_WIDTH = 24;
const DEFAULT_MINIMUM_RESIZE_HEIGHT = 16;
const DEFAULT_DUPLICATE_OFFSET = 16;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function viewportPointToCanonical({
  x,
  y,
  zoom,
  pageSize,
}: ViewportPointInput): CanonicalPoint {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError("Zoom must be positive for overlay placement.");
  }

  return {
    x: asPdfPoint(clamp(x / zoom, 0, pageSize.width)),
    y: asPdfPoint(clamp(y / zoom, 0, pageSize.height)),
  };
}

export function canonicalFrameToCss(
  frame: CanonicalFrame,
  zoom: number,
): CssFrame {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError("Zoom must be positive for overlay display.");
  }

  return {
    left: frame.x * zoom,
    top: frame.y * zoom,
    width: frame.width * zoom,
    height: frame.height * zoom,
  };
}

export function moveFrameByViewportDelta({
  frame,
  deltaX,
  deltaY,
  zoom,
  pageSize,
}: MoveFrameByViewportDeltaInput): CanonicalFrame {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError("Zoom must be positive for overlay movement.");
  }

  const maximumX = Math.max(0, pageSize.width - frame.width);
  const maximumY = Math.max(0, pageSize.height - frame.height);

  return {
    ...frame,
    x: asPdfPoint(clamp(frame.x + deltaX / zoom, 0, maximumX)),
    y: asPdfPoint(clamp(frame.y + deltaY / zoom, 0, maximumY)),
  };
}

export function resizeFrameByViewportDelta({
  frame,
  deltaX,
  deltaY,
  zoom,
  pageSize,
  minimumWidth = DEFAULT_MINIMUM_RESIZE_WIDTH,
  minimumHeight = DEFAULT_MINIMUM_RESIZE_HEIGHT,
}: ResizeFrameByViewportDeltaInput): CanonicalFrame {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError("Zoom must be positive for overlay resizing.");
  }

  const maximumWidth = Math.max(0, pageSize.width - frame.x);
  const maximumHeight = Math.max(0, pageSize.height - frame.y);
  const minimumClampedWidth = Math.min(minimumWidth, maximumWidth);
  const minimumClampedHeight = Math.min(minimumHeight, maximumHeight);

  return {
    ...frame,
    width: asPdfPoint(
      clamp(frame.width + deltaX / zoom, minimumClampedWidth, maximumWidth),
    ),
    height: asPdfPoint(
      clamp(frame.height + deltaY / zoom, minimumClampedHeight, maximumHeight),
    ),
  };
}

export function createDuplicateFrame({
  frame,
  pageSize,
  offset = DEFAULT_DUPLICATE_OFFSET,
}: DuplicateFrameInput): CanonicalFrame {
  const maximumX = Math.max(0, pageSize.width - frame.width);
  const maximumY = Math.max(0, pageSize.height - frame.height);
  const nextX = clamp(frame.x + offset, 0, maximumX);
  const nextY = clamp(frame.y + offset, 0, maximumY);

  if (nextX !== frame.x || nextY !== frame.y) {
    return {
      ...frame,
      x: asPdfPoint(nextX),
      y: asPdfPoint(nextY),
    };
  }

  return {
    ...frame,
    x: asPdfPoint(clamp(frame.x - offset, 0, maximumX)),
    y: asPdfPoint(clamp(frame.y - offset, 0, maximumY)),
  };
}

export function createDefaultTextFrame(input: {
  readonly point: { readonly x: number; readonly y: number };
  readonly pageSize: CanonicalPageSize;
}): CanonicalFrame {
  const width = Math.min(DEFAULT_TEXT_WIDTH, input.pageSize.width);
  const height = Math.min(DEFAULT_TEXT_HEIGHT, input.pageSize.height);

  return {
    x: asPdfPoint(clamp(input.point.x, 0, input.pageSize.width - width)),
    y: asPdfPoint(clamp(input.point.y, 0, input.pageSize.height - height)),
    width: asPdfPoint(width),
    height: asPdfPoint(height),
  };
}

export function createDefaultWhiteoutFrame(input: {
  readonly point: { readonly x: number; readonly y: number };
  readonly pageSize: CanonicalPageSize;
}): CanonicalFrame {
  const width = Math.min(DEFAULT_WHITEOUT_WIDTH, input.pageSize.width);
  const height = Math.min(DEFAULT_WHITEOUT_HEIGHT, input.pageSize.height);

  return {
    x: asPdfPoint(clamp(input.point.x, 0, input.pageSize.width - width)),
    y: asPdfPoint(clamp(input.point.y, 0, input.pageSize.height - height)),
    width: asPdfPoint(width),
    height: asPdfPoint(height),
  };
}

export function createDefaultRedactionFrame(input: {
  readonly point: { readonly x: number; readonly y: number };
  readonly pageSize: CanonicalPageSize;
}): CanonicalFrame {
  const width = Math.min(DEFAULT_REDACTION_WIDTH, input.pageSize.width);
  const height = Math.min(DEFAULT_REDACTION_HEIGHT, input.pageSize.height);

  return {
    x: asPdfPoint(clamp(input.point.x, 0, input.pageSize.width - width)),
    y: asPdfPoint(clamp(input.point.y, 0, input.pageSize.height - height)),
    width: asPdfPoint(width),
    height: asPdfPoint(height),
  };
}
