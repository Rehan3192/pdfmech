import { assertNever, asPdfPoint } from "./primitives";
import type { Degrees, PdfPoint } from "./primitives";

export interface CanonicalPoint {
  readonly x: PdfPoint;
  readonly y: PdfPoint;
}

export interface CanonicalFrame extends CanonicalPoint {
  readonly width: PdfPoint;
  readonly height: PdfPoint;
}

export interface CanonicalPageSize {
  readonly width: PdfPoint;
  readonly height: PdfPoint;
}

export interface PdfBox {
  readonly xMin: PdfPoint;
  readonly yMin: PdfPoint;
  readonly xMax: PdfPoint;
  readonly yMax: PdfPoint;
}

export interface SourcePageGeometry {
  readonly mediaBox: PdfBox;
  readonly cropBox: PdfBox;
  readonly intrinsicRotation: Degrees;
}

export function getCropBoxSize(box: PdfBox): CanonicalPageSize {
  const width = box.xMax - box.xMin;
  const height = box.yMax - box.yMin;

  if (width <= 0 || height <= 0) {
    throw new RangeError("Crop box must have positive dimensions.");
  }

  return {
    width: asPdfPoint(width, "crop box width"),
    height: asPdfPoint(height, "crop box height"),
  };
}

export function rotatePointClockwise(
  point: CanonicalPoint,
  oldSize: CanonicalPageSize,
  rotation: Degrees,
): CanonicalPoint {
  switch (rotation) {
    case 0:
      return point;
    case 90:
      return {
        x: asPdfPoint(oldSize.height - point.y),
        y: point.x,
      };
    case 180:
      return {
        x: asPdfPoint(oldSize.width - point.x),
        y: asPdfPoint(oldSize.height - point.y),
      };
    case 270:
      return {
        x: point.y,
        y: asPdfPoint(oldSize.width - point.x),
      };
    default:
      return assertNever(rotation);
  }
}

export function rotateFrameClockwise(
  frame: CanonicalFrame,
  oldSize: CanonicalPageSize,
  rotation: Degrees,
): CanonicalFrame {
  switch (rotation) {
    case 0:
      return frame;
    case 90:
      return {
        x: asPdfPoint(oldSize.height - (frame.y + frame.height)),
        y: frame.x,
        width: frame.height,
        height: frame.width,
      };
    case 180:
      return {
        x: asPdfPoint(oldSize.width - (frame.x + frame.width)),
        y: asPdfPoint(oldSize.height - (frame.y + frame.height)),
        width: frame.width,
        height: frame.height,
      };
    case 270:
      return {
        x: frame.y,
        y: asPdfPoint(oldSize.width - (frame.x + frame.width)),
        width: frame.height,
        height: frame.width,
      };
    default:
      return assertNever(rotation);
  }
}
