export interface SplitPageGroup {
  readonly label: string;
  readonly pageIndexes: readonly number[];
}

export const SPLIT_MAX_OUTPUTS = 100;

export function createEveryPageGroups(pageCount: number): readonly SplitPageGroup[] {
  assertPageCount(pageCount);
  if (pageCount > SPLIT_MAX_OUTPUTS) {
    throw new Error(`Splitting every page supports up to ${SPLIT_MAX_OUTPUTS} output files. Use custom ranges for this PDF.`);
  }
  return Array.from({ length: pageCount }, (_, index) => ({
    label: String(index + 1),
    pageIndexes: [index],
  }));
}

export function parseSplitPageGroups(value: string, pageCount: number): readonly SplitPageGroup[] {
  assertPageCount(pageCount);
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) throw new Error("Enter at least two page ranges separated by commas.");
  if (parts.length > SPLIT_MAX_OUTPUTS) throw new Error(`Create no more than ${SPLIT_MAX_OUTPUTS} output files at once.`);

  const usedPages = new Set<number>();
  return parts.map((part) => {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    const start = range === null ? parseSinglePage(part) : Number(range[1]);
    const end = range === null ? start : Number(range[2]);
    if (start < 1 || end < start || end > pageCount) throw new Error(`Page range "${part}" is outside this PDF.`);

    const pageIndexes: number[] = [];
    for (let page = start; page <= end; page += 1) {
      const pageIndex = page - 1;
      if (usedPages.has(pageIndex)) throw new Error(`Page ${page} appears in more than one output range.`);
      usedPages.add(pageIndex);
      pageIndexes.push(pageIndex);
    }
    return { label: start === end ? String(start) : `${start}-${end}`, pageIndexes };
  });
}

export function describeSplitGroups(groups: readonly SplitPageGroup[]): string {
  return groups.map((group) => group.label).join(", ");
}

function parseSinglePage(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`Page range "${value}" is not valid.`);
  return Number(value);
}

function assertPageCount(pageCount: number): void {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new RangeError("The PDF must contain at least one page.");
}
