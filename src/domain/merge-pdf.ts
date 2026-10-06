export interface MergeFileSummary {
  readonly byteLength: number;
  readonly pageCount: number;
}

export interface MergeTotals {
  readonly fileCount: number;
  readonly byteLength: number;
  readonly pageCount: number;
}

export const MERGE_LIMITS = {
  maxFiles: 20,
  maxFileBytes: 100 * 1024 * 1024,
  maxTotalBytes: 250 * 1024 * 1024,
  maxTotalPages: 500,
} as const;

export function calculateMergeTotals(files: readonly MergeFileSummary[]): MergeTotals {
  return files.reduce<MergeTotals>(
    (totals, file) => ({
      fileCount: totals.fileCount + 1,
      byteLength: totals.byteLength + file.byteLength,
      pageCount: totals.pageCount + file.pageCount,
    }),
    { fileCount: 0, byteLength: 0, pageCount: 0 },
  );
}

export function validateMergeFiles(files: readonly MergeFileSummary[]): MergeTotals {
  const totals = calculateMergeTotals(files);
  if (totals.fileCount < 2) throw new Error("Choose at least two PDF files to merge.");
  if (totals.fileCount > MERGE_LIMITS.maxFiles) throw new Error(`Choose no more than ${MERGE_LIMITS.maxFiles} PDF files.`);
  if (files.some((file) => file.byteLength > MERGE_LIMITS.maxFileBytes)) throw new Error("Each PDF must be 100 MB or smaller.");
  if (totals.byteLength > MERGE_LIMITS.maxTotalBytes) throw new Error("The selected PDFs exceed the 250 MB combined limit.");
  if (totals.pageCount > MERGE_LIMITS.maxTotalPages) throw new Error(`The selected PDFs exceed the ${MERGE_LIMITS.maxTotalPages}-page combined limit.`);
  return totals;
}

export function moveMergeItem<T>(items: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return items;
  if (fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) return items;
  next.splice(toIndex, 0, item);
  return next;
}
