import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString,
} from "pdf-lib";

import type {
  PdfMetadataField,
  PdfMetadataInspection,
  PdfMetadataProcessor,
  PdfMetadataRemovalOptions,
  PdfMetadataRemovalResult,
} from "../../ports/metadata";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 1_000;

const STANDARD_FIELDS = [
  { key: "Title", label: "Title", read: (document: PDFDocument) => safeText(() => document.getTitle()) },
  { key: "Author", label: "Author", read: (document: PDFDocument) => safeText(() => document.getAuthor()) },
  { key: "Subject", label: "Subject", read: (document: PDFDocument) => safeText(() => document.getSubject()) },
  { key: "Keywords", label: "Keywords", read: (document: PDFDocument) => safeText(() => document.getKeywords()) },
  { key: "Creator", label: "Creator application", read: (document: PDFDocument) => safeText(() => document.getCreator()) },
  { key: "Producer", label: "PDF producer", read: (document: PDFDocument) => safeText(() => document.getProducer()) },
  { key: "CreationDate", label: "Created", read: (document: PDFDocument) => safeDate(() => document.getCreationDate()) },
  { key: "ModDate", label: "Modified", read: (document: PDFDocument) => safeDate(() => document.getModificationDate()) },
] as const;

const STANDARD_FIELD_KEYS = new Set<string>(STANDARD_FIELDS.map((field) => field.key));

export class BrowserMetadataProcessor implements PdfMetadataProcessor {
  async inspect(file: File): Promise<PdfMetadataInspection> {
    assertPdfFile(file);
    const document = await loadPdf(file);
    assertPageCount(document.getPageCount());
    return inspectDocument(document, file);
  }

  async remove(
    file: File,
    options: PdfMetadataRemovalOptions,
  ): Promise<PdfMetadataRemovalResult> {
    assertPdfFile(file);
    const document = await loadPdf(file);
    const pageCount = document.getPageCount();
    assertPageCount(pageCount);

    const selectedKeys = new Set(options.fieldKeys);
    const info = getInfoDictionary(document);
    let removedFieldCount = 0;
    if (info !== undefined) {
      for (const key of [...info.keys()]) {
        if (selectedKeys.has(key.decodeText()) && info.delete(key)) {
          removedFieldCount += 1;
        }
      }
      if (info.keys().length === 0) {
        delete document.context.trailerInfo.Info;
      }
    }

    const metadataName = PDFName.of("Metadata");
    const removedXmp = options.removeXmp && document.catalog.delete(metadataName);
    if (removedFieldCount === 0 && !removedXmp) {
      throw new Error("Select at least one metadata item to remove.");
    }

    const bytes = await document.save();
    const outputBytes = new Uint8Array(bytes).buffer;
    const validationDocument = await PDFDocument.load(outputBytes, { updateMetadata: false });
    if (validationDocument.getPageCount() !== pageCount) {
      throw new Error("The cleaned PDF failed page-count validation.");
    }
    const validationInfo = getInfoDictionary(validationDocument);
    for (const key of selectedKeys) {
      if (validationInfo?.has(PDFName.of(key))) {
        throw new Error(`The ${key} metadata field could not be removed.`);
      }
    }
    if (options.removeXmp && validationDocument.catalog.has(metadataName)) {
      throw new Error("The embedded XMP metadata packet could not be removed.");
    }

    return {
      blob: new Blob([outputBytes], { type: "application/pdf" }),
      downloadName: buildDownloadName(file.name),
      removedFieldCount,
      removedXmp,
      pageCount,
    };
  }
}

function inspectDocument(document: PDFDocument, file: File): PdfMetadataInspection {
  const standardFields: PdfMetadataField[] = STANDARD_FIELDS.flatMap((field) => {
    const value = field.read(document);
    return value === undefined
      ? []
      : [{ key: field.key, label: field.label, value, kind: "standard" as const }];
  });
  const info = getInfoDictionary(document);
  const customFields: PdfMetadataField[] = info === undefined
    ? []
    : info.entries().flatMap(([key, value]) => {
        const decodedKey = key.decodeText();
        if (STANDARD_FIELD_KEYS.has(decodedKey)) return [];
        return [{
          key: decodedKey,
          label: humanizeKey(decodedKey),
          value: decodeMetadataValue(value),
          kind: "custom" as const,
        }];
      });
  const formFields = document.getForm().getFields();
  return {
    fileName: file.name,
    byteLength: file.size,
    pageCount: document.getPageCount(),
    fields: [...standardFields, ...customFields],
    hasXmp: document.catalog.has(PDFName.of("Metadata")),
    hasSignatures: formFields.some((field) => field.constructor.name === "PDFSignature"),
  };
}

function getInfoDictionary(document: PDFDocument): PDFDict | undefined {
  return document.context.lookupMaybe(document.context.trailerInfo.Info, PDFDict);
}

function safeText(read: () => string | undefined): string | undefined {
  try {
    const value = read()?.trim();
    return value === undefined || value.length === 0 ? undefined : value;
  } catch {
    return undefined;
  }
}

function safeDate(read: () => Date | undefined): string | undefined {
  try {
    const value = read();
    return value === undefined || Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  } catch {
    return undefined;
  }
}

function decodeMetadataValue(value: unknown): string {
  if (value instanceof PDFString || value instanceof PDFHexString) {
    try {
      return value.decodeText();
    } catch {
      return "Stored value";
    }
  }
  const displayed = String(value).trim();
  return displayed.length > 0 ? displayed.slice(0, 500) : "Stored value";
}

function humanizeKey(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

async function loadPdf(file: File): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
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
  return `${fileName.replace(/\.pdf$/i, "") || "document"}-metadata-removed.pdf`;
}
