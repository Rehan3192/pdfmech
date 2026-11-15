export type CsvDelimiter = "," | ";" | "\t";

export interface ParsedCsv {
  readonly delimiter: CsvDelimiter;
  readonly rows: readonly (readonly string[])[];
  readonly columnCount: number;
}

const MAX_ROWS = 20_000;
const MAX_COLUMNS = 30;

export function parseCsv(text: string): ParsedCsv {
  const source = text.replace(/^\uFEFF/, "");
  const delimiter = detectCsvDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"' && field.length === 0) { quoted = true; continue; }
    if (character === delimiter) { row.push(field); field = ""; continue; }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field); field = ""; rows.push(row); row = [];
      if (rows.length > MAX_ROWS) throw new Error(`CSV files with more than ${MAX_ROWS.toLocaleString()} rows are not supported.`);
      continue;
    }
    field += character;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field);
  rows.push(row);

  while (rows.length > 0 && rows[rows.length - 1]?.every((cell) => cell.trim() === "")) rows.pop();
  if (rows.length === 0) throw new Error("The CSV does not contain any rows.");
  const columnCount = Math.max(...rows.map((value) => value.length));
  if (columnCount > MAX_COLUMNS) throw new Error(`CSV files with more than ${MAX_COLUMNS} columns are not supported.`);
  return { delimiter, rows: rows.map((value) => Array.from({ length: columnCount }, (_, index) => value[index] ?? "")), columnCount };
}

export function detectCsvDelimiter(text: string): CsvDelimiter {
  const sample = text.split(/\r?\n/).slice(0, 8).join("\n");
  const candidates: readonly CsvDelimiter[] = [",", ";", "\t"];
  let best: CsvDelimiter = ",";
  let bestScore = -1;
  for (const delimiter of candidates) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < sample.length; index += 1) {
      const character = sample[index];
      if (character === '"') {
        if (quoted && sample[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && character === delimiter) count += 1;
    }
    if (count > bestScore) { best = delimiter; bestScore = count; }
  }
  return best;
}

export function stringifyCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n");
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}
