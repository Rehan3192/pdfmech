import { PDFDocument } from "pdf-lib";

import type {
  FlattenFormResult,
  FormFieldSummary,
  FormFlattener,
  FormInspection,
} from "../../ports/form-flattener";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 1_000;

export class BrowserFormFlattener implements FormFlattener {
  async inspect(file: File): Promise<FormInspection> {
    assertPdfFile(file);
    const document = await loadPdf(file);
    assertPageCount(document.getPageCount());
    const form = document.getForm();
    const fields = summarizeFields(form.getFields());
    return {
      fileName: file.name,
      byteLength: file.size,
      pageCount: document.getPageCount(),
      fields,
      hasXfa: form.hasXFA(),
      hasSignatures: fields.some((field) => field.type === "Signature"),
    };
  }

  async flatten(file: File): Promise<FlattenFormResult> {
    assertPdfFile(file);
    const document = await loadPdf(file);
    assertPageCount(document.getPageCount());
    const form = document.getForm();
    if (form.hasXFA()) {
      throw new Error("This PDF uses XFA forms, which this tool cannot flatten reliably.");
    }
    const fieldCount = form.getFields().length;
    if (fieldCount === 0) {
      throw new Error("No editable AcroForm fields were found in this PDF.");
    }
    try {
      form.flatten();
    } catch {
      throw new Error("Some form fields do not have a usable appearance and could not be flattened.");
    }
    const bytes = await document.save();
    const outputBytes = new Uint8Array(bytes).buffer;
    const validationDocument = await PDFDocument.load(outputBytes);
    if (validationDocument.getPageCount() !== document.getPageCount()) {
      throw new Error("The flattened PDF failed page-count validation.");
    }
    if (validationDocument.getForm().getFields().length !== 0) {
      throw new Error("The output still contains editable form fields.");
    }
    return {
      blob: new Blob([outputBytes], { type: "application/pdf" }),
      downloadName: buildDownloadName(file.name),
      flattenedFieldCount: fieldCount,
      pageCount: document.getPageCount(),
    };
  }
}

function summarizeFields(fields: ReturnType<ReturnType<PDFDocument["getForm"]>["getFields"]>): readonly FormFieldSummary[] {
  return fields.map((field) => ({
    name: field.getName(),
    type: field.constructor.name.replace(/^PDF/, "") || "Form field",
  }));
}

async function loadPdf(file: File): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await file.arrayBuffer());
  } catch {
    throw new Error(`${file.name} could not be opened. Password-protected or damaged PDFs are not supported.`);
  }
}

function assertPdfFile(file: File): void {
  if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 100 MB limit.`);
  if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error(`${file.name} is not a PDF file.`);
  }
}

function assertPageCount(pageCount: number): void {
  if (pageCount < 1) throw new Error("The PDF does not contain any pages.");
  if (pageCount > MAX_PAGE_COUNT) throw new Error(`PDFs with more than ${MAX_PAGE_COUNT} pages are not supported.`);
}

function buildDownloadName(fileName: string): string {
  return `${fileName.replace(/\.pdf$/i, "") || "document"}-flattened.pdf`;
}
