import {
  PDFButton,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  type PDFField,
  StandardFonts,
} from "pdf-lib";

import {
  FILL_PDF_LIMITS,
  filledPdfName,
  normalizeSelectedOptions,
  type FormFieldValue,
} from "../../domain/fill-pdf-form";
import type {
  FillableFormField,
  FillPdfFormInspection,
  FillPdfFormProcessor,
  FillPdfFormResult,
} from "../../ports/fill-pdf-form";

export class BrowserPdfFormFiller implements FillPdfFormProcessor {
  async inspect(file: File): Promise<FillPdfFormInspection> {
    assertPdfFile(file);
    const document = await loadPdf(file);
    assertDocumentLimits(document);
    const form = document.getForm();
    const fields = form.getFields().map(summarizeField);
    return {
      fileName: file.name,
      byteLength: file.size,
      pageCount: document.getPageCount(),
      fields,
      hasXfa: form.hasXFA(),
      hasSignatures: fields.some((field) => field.typeLabel === "Signature"),
    };
  }

  async fill(
    file: File,
    values: Readonly<Record<string, FormFieldValue>>,
    flatten: boolean,
  ): Promise<FillPdfFormResult> {
    assertPdfFile(file);
    const document = await loadPdf(file);
    assertDocumentLimits(document);
    const form = document.getForm();
    if (form.hasXFA()) throw new Error("This PDF uses an XFA form, which this tool cannot fill reliably.");

    let updatedFieldCount = 0;
    for (const field of form.getFields()) {
      if (field.isReadOnly() || !(field.getName() in values)) continue;
      if (applyValue(field, values[field.getName()]!)) updatedFieldCount += 1;
    }
    if (updatedFieldCount === 0) throw new Error("No supported editable form fields were available to save.");

    try {
      const font = await document.embedFont(StandardFonts.Helvetica);
      form.updateFieldAppearances(font);
      if (flatten) form.flatten();
    } catch {
      throw new Error("One or more field values could not be rendered. Try basic Latin text or leave the unsupported field unchanged.");
    }

    const outputBytes = new Uint8Array(await document.save({ updateFieldAppearances: false })).buffer;
    const validation = await PDFDocument.load(outputBytes);
    if (validation.getPageCount() !== document.getPageCount()) throw new Error("The completed PDF failed page-count validation.");
    if (flatten && validation.getForm().getFields().length !== 0) throw new Error("The completed PDF still contains editable fields after flattening.");

    return {
      blob: new Blob([outputBytes], { type: "application/pdf" }),
      downloadName: filledPdfName(file.name),
      pageCount: document.getPageCount(),
      updatedFieldCount,
      flattened: flatten,
    };
  }
}

function summarizeField(field: PDFField): FillableFormField {
  const common = {
    name: field.getName(),
    label: humanizeFieldName(field.getName()),
    readOnly: field.isReadOnly(),
    multiline: false,
    maxLength: null,
    options: [] as readonly string[],
  };
  if (field instanceof PDFTextField) {
    return { ...common, kind: "text", value: field.getText() ?? "", multiline: field.isMultiline(), maxLength: field.getMaxLength() ?? null, typeLabel: field.isMultiline() ? "Multiline text" : "Text" };
  }
  if (field instanceof PDFCheckBox) return { ...common, kind: "checkbox", value: field.isChecked(), typeLabel: "Checkbox" };
  if (field instanceof PDFRadioGroup) return { ...common, kind: "radio", value: field.getSelected() ?? "", options: field.getOptions(), typeLabel: "Radio group" };
  if (field instanceof PDFDropdown) return { ...common, kind: "dropdown", value: field.getSelected(), options: field.getOptions(), typeLabel: "Dropdown" };
  if (field instanceof PDFOptionList) return { ...common, kind: "option-list", value: field.getSelected(), options: field.getOptions(), typeLabel: "List box" };
  if (field instanceof PDFSignature) return { ...common, kind: "unsupported", value: "", readOnly: true, typeLabel: "Signature" };
  if (field instanceof PDFButton) return { ...common, kind: "unsupported", value: "", readOnly: true, typeLabel: "Button" };
  return { ...common, kind: "unsupported", value: "", readOnly: true, typeLabel: field.constructor.name.replace(/^PDF/, "") || "Unsupported" };
}

function applyValue(field: PDFField, value: FormFieldValue): boolean {
  if (field instanceof PDFTextField && typeof value === "string") {
    field.setText(value);
    return true;
  }
  if (field instanceof PDFCheckBox && typeof value === "boolean") {
    if (value) field.check(); else field.uncheck();
    return true;
  }
  if (field instanceof PDFRadioGroup && typeof value === "string") {
    if (value === "") field.clear(); else if (field.getOptions().includes(value)) field.select(value); else throw new Error(`${field.getName()} has an invalid option.`);
    return true;
  }
  if (field instanceof PDFDropdown && Array.isArray(value)) {
    const selected = normalizeSelectedOptions(value, field.getOptions());
    if (selected.length === 0) field.clear(); else field.select([...selected]);
    return true;
  }
  if (field instanceof PDFOptionList && Array.isArray(value)) {
    const selected = normalizeSelectedOptions(value, field.getOptions());
    if (selected.length === 0) field.clear(); else field.select([...selected]);
    return true;
  }
  return false;
}

function humanizeFieldName(name: string): string {
  const label = name.replace(/[._-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();
  return label.length > 0 ? label.replace(/^./, (character) => character.toUpperCase()) : "Unnamed field";
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
  if (file.size > FILL_PDF_LIMITS.maxFileBytes) throw new Error(`${file.name} is larger than the 100 MB limit.`);
  if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") throw new Error(`${file.name} is not a PDF file.`);
}

function assertDocumentLimits(document: PDFDocument): void {
  const pageCount = document.getPageCount();
  if (pageCount < 1) throw new Error("The PDF does not contain any pages.");
  if (pageCount > FILL_PDF_LIMITS.maxPages) throw new Error(`PDFs with more than ${FILL_PDF_LIMITS.maxPages} pages are not supported.`);
  if (document.getForm().getFields().length > FILL_PDF_LIMITS.maxFields) throw new Error(`PDFs with more than ${FILL_PDF_LIMITS.maxFields} form fields are not supported.`);
}
