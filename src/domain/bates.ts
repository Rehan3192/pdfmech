export const BATES_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type BatesPosition = (typeof BATES_POSITIONS)[number];

export interface BatesSequenceSettings {
  readonly startNumber: number;
  readonly digits: number;
  readonly prefix: string;
  readonly suffix: string;
}

export function parseBatesPageRange(
  value: string,
  pageCount: number,
): readonly number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new RangeError("The PDF must contain at least one page.");
  }

  const normalized = value.trim().toLocaleLowerCase("en");
  if (normalized === "" || normalized === "all") {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const pages = new Set<number>();
  for (const rawPart of normalized.split(",")) {
    const part = rawPart.trim();
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (range !== null) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < start || end > pageCount) {
        throw new Error(`Page range "${part}" is outside this PDF.`);
      }
      for (let page = start; page <= end; page += 1) pages.add(page - 1);
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

  if (pages.size === 0) throw new Error("Choose at least one page to number.");
  return [...pages].sort((left, right) => left - right);
}

export function formatBatesLabel(
  sequenceNumber: number,
  settings: BatesSequenceSettings,
): string {
  if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber < 0) {
    throw new Error("The starting number must be a whole number of zero or more.");
  }
  if (!Number.isInteger(settings.digits) || settings.digits < 1 || settings.digits > 12) {
    throw new Error("Digits must be between 1 and 12.");
  }
  const number = String(sequenceNumber);
  if (number.length > settings.digits) {
    throw new Error(`Number ${number} does not fit in ${settings.digits} digits.`);
  }
  return `${settings.prefix}${number.padStart(settings.digits, "0")}${settings.suffix}`;
}

export function validateBatesSequence(
  selectedPageCount: number,
  settings: BatesSequenceSettings,
): { readonly first: string; readonly last: string } {
  if (!Number.isInteger(selectedPageCount) || selectedPageCount < 1) {
    throw new Error("Choose at least one page to number.");
  }
  if (settings.prefix.length > 32 || settings.suffix.length > 32) {
    throw new Error("Prefix and suffix can each contain up to 32 characters.");
  }
  const lastNumber = settings.startNumber + selectedPageCount - 1;
  if (!Number.isSafeInteger(lastNumber)) {
    throw new Error("This numbering sequence is too large.");
  }
  return {
    first: formatBatesLabel(settings.startNumber, settings),
    last: formatBatesLabel(lastNumber, settings),
  };
}

