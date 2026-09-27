export interface OcrWordBox {
  readonly text: string;
  readonly confidence: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export function parseOcrPageRange(
  value: string,
  pageCount: number,
): readonly number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new RangeError("The PDF must contain at least one page.");
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error("Enter a page range such as 1-5, 8, 12.");
  }

  const pages = new Set<number>();
  for (const rawPart of normalized.split(",")) {
    const part = rawPart.trim();
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (rangeMatch !== null) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end < start || end > pageCount) {
        throw new Error(`Page range "${part}" is outside this PDF.`);
      }
      for (let page = start; page <= end; page += 1) {
        pages.add(page - 1);
      }
      continue;
    }

    if (!/^\d+$/.test(part)) {
      throw new Error(`Page range "${part}" is not valid.`);
    }
    const page = Number(part);
    if (page < 1 || page > pageCount) {
      throw new Error(`Page ${page} is outside this PDF.`);
    }
    pages.add(page - 1);
  }

  return [...pages].sort((left, right) => left - right);
}

export function normalizeOcrText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
