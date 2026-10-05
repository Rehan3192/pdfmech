export interface ExtractedTextPage {
  readonly pageNumber: number;
  readonly lines: readonly string[];
}

export interface ExtractedTextDocument {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly pages: readonly ExtractedTextPage[];
  readonly characterCount: number;
}

export interface PdfComparisonOptions {
  readonly ignoreCase: boolean;
  readonly ignoreWhitespace: boolean;
}

export type DiffLineKind = "equal" | "added" | "removed";

export interface DiffLine {
  readonly kind: DiffLineKind;
  readonly text: string;
  readonly oldLineNumber: number | null;
  readonly newLineNumber: number | null;
}

export interface PdfPageComparison {
  readonly pageNumber: number;
  readonly status: "unchanged" | "changed" | "added" | "removed";
  readonly lines: readonly DiffLine[];
  readonly addedLineCount: number;
  readonly removedLineCount: number;
}

export interface PdfTextComparison {
  readonly oldDocument: ExtractedTextDocument;
  readonly newDocument: ExtractedTextDocument;
  readonly pages: readonly PdfPageComparison[];
  readonly changedPageCount: number;
  readonly unchangedPageCount: number;
  readonly addedLineCount: number;
  readonly removedLineCount: number;
}

const MAX_LCS_CELLS = 2_250_000;

export function comparePdfText(
  oldDocument: ExtractedTextDocument,
  newDocument: ExtractedTextDocument,
  options: PdfComparisonOptions,
): PdfTextComparison {
  const pageCount = Math.max(oldDocument.pageCount, newDocument.pageCount);
  const pages: PdfPageComparison[] = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const oldPage = oldDocument.pages[pageIndex];
    const newPage = newDocument.pages[pageIndex];
    if (oldPage === undefined) {
      const lines = (newPage?.lines ?? []).map((text, index) => ({
        kind: "added" as const,
        text,
        oldLineNumber: null,
        newLineNumber: index + 1,
      }));
      pages.push({ pageNumber: pageIndex + 1, status: "added", lines, addedLineCount: lines.length, removedLineCount: 0 });
      continue;
    }
    if (newPage === undefined) {
      const lines = oldPage.lines.map((text, index) => ({
        kind: "removed" as const,
        text,
        oldLineNumber: index + 1,
        newLineNumber: null,
      }));
      pages.push({ pageNumber: pageIndex + 1, status: "removed", lines, addedLineCount: 0, removedLineCount: lines.length });
      continue;
    }
    const lines = diffLines(oldPage.lines, newPage.lines, options);
    const addedLineCount = lines.filter((line) => line.kind === "added").length;
    const removedLineCount = lines.filter((line) => line.kind === "removed").length;
    pages.push({
      pageNumber: pageIndex + 1,
      status: addedLineCount === 0 && removedLineCount === 0 ? "unchanged" : "changed",
      lines,
      addedLineCount,
      removedLineCount,
    });
  }
  return {
    oldDocument,
    newDocument,
    pages,
    changedPageCount: pages.filter((page) => page.status !== "unchanged").length,
    unchangedPageCount: pages.filter((page) => page.status === "unchanged").length,
    addedLineCount: pages.reduce((total, page) => total + page.addedLineCount, 0),
    removedLineCount: pages.reduce((total, page) => total + page.removedLineCount, 0),
  };
}

export function createTextComparisonReport(comparison: PdfTextComparison): string {
  const lines = [
    "PDFMech text comparison report",
    `Older file: ${comparison.oldDocument.fileName}`,
    `Newer file: ${comparison.newDocument.fileName}`,
    `Changed pages: ${comparison.changedPageCount}`,
    `Added lines: ${comparison.addedLineCount}`,
    `Removed lines: ${comparison.removedLineCount}`,
    "",
  ];
  for (const page of comparison.pages.filter((item) => item.status !== "unchanged")) {
    lines.push(`Page ${page.pageNumber} (${page.status})`, "----------------------------------------");
    for (const line of page.lines) {
      if (line.kind === "added") lines.push(`+ ${line.text}`);
      if (line.kind === "removed") lines.push(`- ${line.text}`);
    }
    lines.push("");
  }
  if (comparison.changedPageCount === 0) lines.push("No text differences were found.");
  lines.push("Generated locally with PDFMech. Visual, image, formatting, and layout-only changes are not included.");
  return lines.join("\n");
}

function diffLines(
  oldLines: readonly string[],
  newLines: readonly string[],
  options: PdfComparisonOptions,
): readonly DiffLine[] {
  const oldComparable = oldLines.map((line) => normalizeLine(line, options));
  const newComparable = newLines.map((line) => normalizeLine(line, options));
  if (oldLines.length * newLines.length > MAX_LCS_CELLS) {
    if (oldComparable.join("\n") === newComparable.join("\n")) {
      return oldLines.map((text, index) => ({ kind: "equal", text, oldLineNumber: index + 1, newLineNumber: index + 1 }));
    }
    return [
      ...oldLines.map((text, index) => ({ kind: "removed" as const, text, oldLineNumber: index + 1, newLineNumber: null })),
      ...newLines.map((text, index) => ({ kind: "added" as const, text, oldLineNumber: null, newLineNumber: index + 1 })),
    ];
  }

  const columns = newLines.length + 1;
  const table = new Uint32Array((oldLines.length + 1) * columns);
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      const cell = oldIndex * columns + newIndex;
      table[cell] = oldComparable[oldIndex] === newComparable[newIndex]
        ? (table[(oldIndex + 1) * columns + newIndex + 1] ?? 0) + 1
        : Math.max(table[(oldIndex + 1) * columns + newIndex] ?? 0, table[oldIndex * columns + newIndex + 1] ?? 0);
    }
  }

  const result: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldComparable[oldIndex] === newComparable[newIndex]) {
      result.push({ kind: "equal", text: newLines[newIndex] ?? "", oldLineNumber: oldIndex + 1, newLineNumber: newIndex + 1 });
      oldIndex += 1;
      newIndex += 1;
    } else if ((table[(oldIndex + 1) * columns + newIndex] ?? 0) >= (table[oldIndex * columns + newIndex + 1] ?? 0)) {
      result.push({ kind: "removed", text: oldLines[oldIndex] ?? "", oldLineNumber: oldIndex + 1, newLineNumber: null });
      oldIndex += 1;
    } else {
      result.push({ kind: "added", text: newLines[newIndex] ?? "", oldLineNumber: null, newLineNumber: newIndex + 1 });
      newIndex += 1;
    }
  }
  while (oldIndex < oldLines.length) {
    result.push({ kind: "removed", text: oldLines[oldIndex] ?? "", oldLineNumber: oldIndex + 1, newLineNumber: null });
    oldIndex += 1;
  }
  while (newIndex < newLines.length) {
    result.push({ kind: "added", text: newLines[newIndex] ?? "", oldLineNumber: null, newLineNumber: newIndex + 1 });
    newIndex += 1;
  }
  return result;
}

function normalizeLine(line: string, options: PdfComparisonOptions): string {
  let value = options.ignoreWhitespace ? line.replace(/\s+/g, " ").trim() : line;
  if (options.ignoreCase) value = value.toLocaleLowerCase("en");
  return value;
}
