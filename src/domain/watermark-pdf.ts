export type WatermarkPosition = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type WatermarkRotation = -45 | 0 | 45;

export interface WatermarkOptions {
  readonly text: string;
  readonly fontSize: number;
  readonly color: string;
  readonly opacity: number;
  readonly rotation: WatermarkRotation;
  readonly position: WatermarkPosition;
  readonly pageIndexes: readonly number[];
}

export function validateWatermarkText(value: string): string {
  const text = value.trim();
  if (text.length === 0) throw new Error("Enter watermark text.");
  if (text.length > 120) throw new Error("Watermark text must be 120 characters or fewer.");
  return text;
}

export function parseWatermarkPages(value: string, pageCount: number): readonly number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new RangeError("The PDF must contain at least one page.");
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error("Enter at least one page or page range.");
  const indexes = new Set<number>();
  for (const part of parts) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    const start = range === null ? parsePage(part) : Number(range[1]);
    const end = range === null ? start : Number(range[2]);
    if (start < 1 || end < start || end > pageCount) throw new Error(`Page range "${part}" is outside this PDF.`);
    for (let page = start; page <= end; page += 1) indexes.add(page - 1);
  }
  return [...indexes].sort((left, right) => left - right);
}

export function watermarkPlacement(pageWidth: number, pageHeight: number, textWidth: number, textHeight: number, rotation: WatermarkRotation, position: WatermarkPosition) {
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [[0, 0], [textWidth * cos, textWidth * sin], [-textHeight * sin, textHeight * cos], [textWidth * cos - textHeight * sin, textWidth * sin + textHeight * cos]] as const;
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  const margin = Math.min(36, pageWidth * .06, pageHeight * .06);
  const targetX = position === "center" ? (pageWidth - boxWidth) / 2 : position.endsWith("right") ? pageWidth - margin - boxWidth : margin;
  const targetY = position === "center" ? (pageHeight - boxHeight) / 2 : position.startsWith("top") ? pageHeight - margin - boxHeight : margin;
  return { x: targetX - minX, y: targetY - minY } as const;
}

export function parseHexColor(value: string): readonly [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error("Choose a valid six-digit watermark color.");
  return [Number.parseInt(value.slice(1, 3), 16) / 255, Number.parseInt(value.slice(3, 5), 16) / 255, Number.parseInt(value.slice(5, 7), 16) / 255];
}

function parsePage(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`Page range "${value}" is not valid.`);
  return Number(value);
}
