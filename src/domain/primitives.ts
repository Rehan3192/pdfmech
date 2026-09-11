import type { Brand } from "../shared/brand";

export type DocumentId = Brand<string, "DocumentId">;
export type SourceId = Brand<string, "SourceId">;
export type PageId = Brand<string, "PageId">;
export type ObjectId = Brand<string, "ObjectId">;
export type AssetId = Brand<string, "AssetId">;
export type FieldId = Brand<string, "FieldId">;
export type TransactionId = Brand<string, "TransactionId">;

export type PdfPoint = Brand<number, "PdfPoint">;
export type UnitInterval = Brand<number, "UnitInterval">;
export type Degrees = 0 | 90 | 180 | 270;

export function asPdfPoint(value: number, label = "PDF point"): PdfPoint {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }

  return value as PdfPoint;
}

export function asUnitInterval(
  value: number,
  label = "unit interval",
): UnitInterval {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be between 0 and 1.`);
  }

  return value as UnitInterval;
}

export function isDegrees(value: number): value is Degrees {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

export function normalizeDegrees(value: number): Degrees {
  const normalized = ((value % 360) + 360) % 360;
  if (!isDegrees(normalized)) {
    throw new RangeError("Page rotation must be a multiple of 90 degrees.");
  }

  return normalized;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
