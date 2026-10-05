export function parseExtractPageRange(value: string, pageCount: number): readonly number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new RangeError("The PDF must contain at least one page.");
  const normalized = value.trim().toLocaleLowerCase("en");
  if (normalized === "" || normalized === "all") return Array.from({ length: pageCount }, (_, index) => index);
  const pages = new Set<number>();
  for (const rawPart of normalized.split(",")) {
    const part = rawPart.trim();
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (range !== null) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < start || end > pageCount) throw new Error(`Page range "${part}" is outside this PDF.`);
      for (let page = start; page <= end; page += 1) pages.add(page - 1);
      continue;
    }
    if (!/^\d+$/.test(part)) throw new Error(`Page range "${part}" is not valid.`);
    const page = Number(part);
    if (page < 1 || page > pageCount) throw new Error(`Page ${page} is outside this PDF.`);
    pages.add(page - 1);
  }
  if (pages.size === 0) throw new Error("Choose at least one page to extract.");
  return [...pages].sort((left, right) => left - right);
}

export function formatExtractPageRange(pageIndexes: readonly number[]): string {
  const pages = [...new Set(pageIndexes)].sort((left, right) => left - right).map((index) => index + 1);
  if (pages.length === 0) return "";
  const ranges: string[] = [];
  let start = pages[0] ?? 1;
  let previous = start;
  for (let index = 1; index <= pages.length; index += 1) {
    const page = pages[index];
    if (page !== undefined && page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    if (page !== undefined) {
      start = page;
      previous = page;
    }
  }
  return ranges.join(", ");
}
