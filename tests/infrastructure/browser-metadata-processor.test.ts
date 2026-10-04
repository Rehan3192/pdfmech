import { PDFDict, PDFDocument, PDFHexString, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { BrowserMetadataProcessor } from "../../src/infrastructure/pdflib/browser-metadata-processor";

async function createMetadataPdf(): Promise<File> {
  const document = await PDFDocument.create();
  document.addPage([420, 595]);
  document.setTitle("Confidential Project");
  document.setAuthor("Alex Morgan");
  document.setSubject("Internal planning");
  document.setKeywords(["confidential", "planning"]);
  const info = document.context.lookup(document.context.trailerInfo.Info, PDFDict);
  info.set(PDFName.of("Department"), PDFHexString.fromText("Finance"));
  const xmp = document.context.stream(new TextEncoder().encode("<x:xmpmeta>private metadata</x:xmpmeta>"), {
    Type: "Metadata",
    Subtype: "XML",
  });
  document.catalog.set(PDFName.of("Metadata"), document.context.register(xmp));
  const bytes = await document.save();
  return new File([new Uint8Array(bytes).buffer], "project.pdf", { type: "application/pdf" });
}

describe("BrowserMetadataProcessor", () => {
  it("inspects standard, custom, and XMP metadata", async () => {
    const inspection = await new BrowserMetadataProcessor().inspect(await createMetadataPdf());

    expect(inspection.pageCount).toBe(1);
    expect(inspection.hasXmp).toBe(true);
    expect(inspection.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "Title", value: "Confidential Project", kind: "standard" }),
      expect.objectContaining({ key: "Author", value: "Alex Morgan", kind: "standard" }),
      expect.objectContaining({ key: "Department", value: "Finance", kind: "custom" }),
    ]));
  });

  it("removes every selected field and XMP packet while preserving pages", async () => {
    const file = await createMetadataPdf();
    const processor = new BrowserMetadataProcessor();
    const inspection = await processor.inspect(file);
    const result = await processor.remove(file, {
      fieldKeys: inspection.fields.map((field) => field.key),
      removeXmp: true,
    });

    expect(result.downloadName).toBe("project-metadata-removed.pdf");
    expect(result.removedFieldCount).toBe(inspection.fields.length);
    expect(result.removedXmp).toBe(true);
    const output = await PDFDocument.load(await result.blob.arrayBuffer(), { updateMetadata: false });
    expect(output.getPageCount()).toBe(1);
    expect(output.context.trailerInfo.Info).toBeUndefined();
    expect(output.catalog.has(PDFName.of("Metadata"))).toBe(false);
  });

  it("removes selected fields while keeping unselected metadata", async () => {
    const file = await createMetadataPdf();
    const result = await new BrowserMetadataProcessor().remove(file, {
      fieldKeys: ["Author"],
      removeXmp: false,
    });
    const output = await PDFDocument.load(await result.blob.arrayBuffer(), { updateMetadata: false });

    expect(output.getAuthor()).toBeUndefined();
    expect(output.getTitle()).toBe("Confidential Project");
    expect(output.catalog.has(PDFName.of("Metadata"))).toBe(true);
  });
});
