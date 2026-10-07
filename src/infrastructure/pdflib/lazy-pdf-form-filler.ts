import type { FormFieldValue } from "../../domain/fill-pdf-form";
import type { FillPdfFormInspection, FillPdfFormProcessor, FillPdfFormResult } from "../../ports/fill-pdf-form";

export type PdfFormFillerLoader = () => Promise<FillPdfFormProcessor>;

async function loadBrowserPdfFormFiller(): Promise<FillPdfFormProcessor> {
  const module = await import("./browser-pdf-form-filler");
  return new module.BrowserPdfFormFiller();
}

export function createLazyPdfFormFiller(loadFiller: PdfFormFillerLoader = loadBrowserPdfFormFiller): FillPdfFormProcessor {
  let fillerPromise: Promise<FillPdfFormProcessor> | null = null;
  const getFiller = () => (fillerPromise ??= loadFiller());
  return {
    async inspect(file: File): Promise<FillPdfFormInspection> {
      return (await getFiller()).inspect(file);
    },
    async fill(file: File, values: Readonly<Record<string, FormFieldValue>>, flatten: boolean): Promise<FillPdfFormResult> {
      return (await getFiller()).fill(file, values, flatten);
    },
  };
}
