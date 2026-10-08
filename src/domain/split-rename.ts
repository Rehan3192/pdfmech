import type { SplitPageGroup } from "./split-pdf";

export const SMART_SPLIT_MAX_OUTPUTS = 200;

export interface FilenameTable {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface SplitRenameAssignment {
  readonly groupIndex: number;
  readonly sourceRowIndex: number | null;
  readonly filename: string;
}

export interface SplitRenameIssue {
  readonly code:
    | "missing-name"
    | "duplicate-name"
    | "invalid-group"
    | "overlapping-pages"
    | "missing-pages"
    | "unused-name";
  readonly message: string;
  readonly groupIndex?: number;
  readonly sourceRowIndex?: number;
}

export interface SplitRenameValidation {
  readonly issues: readonly SplitRenameIssue[];
  readonly normalizedNames: readonly string[];
  readonly canExport: boolean;
}

export function createFixedSizeGroups(pageCount: number, pagesPerGroup: number): readonly SplitPageGroup[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new RangeError("The PDF must contain at least one page.");
  if (!Number.isInteger(pagesPerGroup) || pagesPerGroup < 1) throw new RangeError("Pages per file must be a whole number greater than zero.");
  const outputCount = Math.ceil(pageCount / pagesPerGroup);
  if (outputCount > SMART_SPLIT_MAX_OUTPUTS) {
    throw new Error(`Create no more than ${SMART_SPLIT_MAX_OUTPUTS} output files at once.`);
  }
  return Array.from({ length: outputCount }, (_, groupIndex) => {
    const start = groupIndex * pagesPerGroup;
    const end = Math.min(pageCount, start + pagesPerGroup);
    return {
      label: end - start === 1 ? String(start + 1) : `${start + 1}-${end}`,
      pageIndexes: Array.from({ length: end - start }, (__, offset) => start + offset),
    };
  });
}

export function parseFilenameTable(text: string, fileName: string, hasHeader: boolean): FilenameTable {
  if (fileName.toLocaleLowerCase("en").endsWith(".txt")) {
    const rows = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => [line]);
    if (rows.length === 0) throw new Error("The TXT file does not contain any filenames.");
    return { columns: ["Filename"], rows };
  }

  const parsed = parseCsv(text.replace(/^\uFEFF/, "")).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (parsed.length === 0) throw new Error("The CSV file does not contain any rows.");
  const widestRow = Math.max(...parsed.map((row) => row.length));
  const first = parsed[0] ?? [];
  const columns = Array.from({ length: widestRow }, (_, index) => {
    const candidate = hasHeader ? first[index]?.trim() : "";
    return candidate || `Column ${index + 1}`;
  });
  const rows = (hasHeader ? parsed.slice(1) : parsed).map((row) =>
    Array.from({ length: widestRow }, (_, index) => row[index] ?? ""),
  );
  if (rows.length === 0) throw new Error("The CSV file does not contain any filename rows.");
  return { columns, rows };
}

export function filenamesFromColumn(table: FilenameTable, columnIndex: number): readonly string[] {
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= table.columns.length) {
    throw new RangeError("Choose a valid filename column.");
  }
  return table.rows.map((row) => row[columnIndex] ?? "");
}

export function suggestFilenameColumn(table: FilenameTable): number {
  const preferred = ["filename", "file name", "output filename", "document name", "full name", "employee name", "name"];
  const normalized = table.columns.map((column) => column.trim().toLocaleLowerCase("en").replace(/[_-]+/g, " "));
  for (const candidate of preferred) {
    const exact = normalized.indexOf(candidate);
    if (exact >= 0) return exact;
  }
  const partial = normalized.findIndex((column) => column.includes("filename") || column.endsWith(" name"));
  return partial >= 0 ? partial : 0;
}

export function normalizePdfFilename(value: string): { readonly filename: string; readonly changed: boolean } {
  const original = value.trim();
  let base = original.replace(/\.pdf$/i, "");
  base = base
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) base = `${base}-document`;
  if (base.length > 120) base = base.slice(0, 120).replace(/[. ]+$/g, "");
  const filename = base === "" ? "" : `${base}.pdf`;
  return { filename, changed: filename !== original };
}

export function createInitialAssignments(groups: readonly SplitPageGroup[], names: readonly string[]): readonly SplitRenameAssignment[] {
  return groups.map((_, groupIndex) => ({
    groupIndex,
    sourceRowIndex: groupIndex < names.length ? groupIndex : null,
    filename: groupIndex < names.length ? names[groupIndex] ?? "" : "",
  }));
}

export function validateSplitRenamePlan(input: {
  readonly groups: readonly SplitPageGroup[];
  readonly assignments: readonly SplitRenameAssignment[];
  readonly importedNameCount: number;
  readonly ignoredRowIndexes: ReadonlySet<number>;
  readonly pageCount: number;
}): SplitRenameValidation {
  const { groups, assignments, importedNameCount, ignoredRowIndexes, pageCount } = input;
  const issues: SplitRenameIssue[] = [];
  const usedPages = new Set<number>();
  const usedRows = new Set<number>();

  groups.forEach((group, groupIndex) => {
    if (group.pageIndexes.length === 0) {
      issues.push({ code: "invalid-group", groupIndex, message: `Group ${groupIndex + 1} has no source pages.` });
    }
    group.pageIndexes.forEach((pageIndex) => {
      if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount) {
        issues.push({ code: "invalid-group", groupIndex, message: `Group ${groupIndex + 1} contains a page outside this PDF.` });
      } else if (usedPages.has(pageIndex)) {
        issues.push({ code: "overlapping-pages", groupIndex, message: `Page ${pageIndex + 1} appears in more than one group.` });
      } else {
        usedPages.add(pageIndex);
      }
    });
  });
  if (usedPages.size !== pageCount) {
    issues.push({ code: "missing-pages", message: `${pageCount - usedPages.size} source page${pageCount - usedPages.size === 1 ? " is" : "s are"} not assigned to an output.` });
  }

  const normalizedNames = assignments.map((assignment, groupIndex) => {
    if (assignment.groupIndex !== groupIndex) {
      issues.push({ code: "invalid-group", groupIndex, message: `Group ${groupIndex + 1} has an invalid mapping.` });
    }
    if (assignment.sourceRowIndex !== null) {
      if (assignment.sourceRowIndex < 0 || assignment.sourceRowIndex >= importedNameCount || usedRows.has(assignment.sourceRowIndex)) {
        issues.push({ code: "invalid-group", groupIndex, message: `Group ${groupIndex + 1} has an invalid or repeated filename-row assignment.` });
      } else {
        usedRows.add(assignment.sourceRowIndex);
      }
    }
    const normalized = normalizePdfFilename(assignment.filename).filename;
    if (normalized === "") {
      issues.push({ code: "missing-name", groupIndex, message: `Group ${groupIndex + 1} needs a filename.` });
    }
    return normalized;
  });

  const firstByName = new Map<string, number>();
  normalizedNames.forEach((name, groupIndex) => {
    if (name === "") return;
    const key = name.toLocaleLowerCase("en");
    const first = firstByName.get(key);
    if (first === undefined) firstByName.set(key, groupIndex);
    else issues.push({ code: "duplicate-name", groupIndex, message: `Groups ${first + 1} and ${groupIndex + 1} would both export as ${name}.` });
  });

  for (let rowIndex = 0; rowIndex < importedNameCount; rowIndex += 1) {
    if (!usedRows.has(rowIndex) && !ignoredRowIndexes.has(rowIndex)) {
      issues.push({ code: "unused-name", sourceRowIndex: rowIndex, message: `Imported row ${rowIndex + 1} is not assigned or explicitly ignored.` });
    }
  }

  return { issues, normalizedNames, canExport: groups.length > 0 && assignments.length === groups.length && issues.length === 0 };
}

function parseCsv(value: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? "";
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("The CSV contains an unfinished quoted value.");
  if (cell !== "" || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}
