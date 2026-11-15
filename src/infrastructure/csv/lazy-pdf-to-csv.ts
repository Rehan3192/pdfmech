import type { CsvConversionProgress, PdfCsvInspection, PdfCsvOptions, PdfCsvResult, PdfToCsvProcessor } from "../../ports/csv-conversion";

export function createLazyPdfToCsvProcessor(): PdfToCsvProcessor {
  let promise: Promise<PdfToCsvProcessor> | null = null;
  let resolved: PdfToCsvProcessor | null = null;
  const load = () => promise ??= import("./browser-pdf-to-csv").then(({ BrowserPdfToCsvProcessor }) => {
    resolved = new BrowserPdfToCsvProcessor();
    return resolved;
  });
  return {
    inspect: async (file: File, progress: (value: CsvConversionProgress) => void, signal?: AbortSignal): Promise<PdfCsvInspection> => (await load()).inspect(file, progress, signal),
    convert: (inspection: PdfCsvInspection, options: PdfCsvOptions): PdfCsvResult => {
      if (resolved === null) throw new Error("The PDF table extractor is not ready.");
      return resolved.convert(inspection, options);
    },
  };
}
