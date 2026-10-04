import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { BrowserFormFlattener } from "../../src/infrastructure/pdflib/browser-form-flattener";

async function createFormPdf(): Promise<File> {
  const document = await PDFDocument.create();
  const page = document.addPage([420, 595]);
  const form = document.getForm();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const name = form.createTextField("applicant.name");
  name.setText("Alex Morgan");
  name.addToPage(page, { x: 50, y: 480, width: 220, height: 28, font, textColor: rgb(0, 0, 0) });
  const accepted = form.createCheckBox("terms.accepted");
  accepted.check();
  accepted.addToPage(page, { x: 50, y: 430, width: 20, height: 20 });
  const bytes = await document.save();
  return new File([new Uint8Array(bytes).buffer], "application.pdf", { type: "application/pdf" });
}

describe("BrowserFormFlattener", () => {
  it("detects AcroForm fields and validates a flattened output", async () => {
    const file = await createFormPdf();
    const flattener = new BrowserFormFlattener();
    const inspection = await flattener.inspect(file);
    expect(inspection).toMatchObject({ pageCount: 1, hasXfa: false, hasSignatures: false });
    expect(inspection.fields).toEqual([
      { name: "applicant.name", type: "TextField" },
      { name: "terms.accepted", type: "CheckBox" },
    ]);
    const result = await flattener.flatten(file);
    expect(result.downloadName).toBe("application-flattened.pdf");
    expect(result.flattenedFieldCount).toBe(2);
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(output.getPageCount()).toBe(1);
    expect(output.getForm().getFields()).toHaveLength(0);
  });

  it("rejects PDFs without editable form fields", async () => {
    const document = await PDFDocument.create();
    document.addPage();
    const bytes = await document.save();
    const file = new File([new Uint8Array(bytes).buffer], "plain.pdf", { type: "application/pdf" });
    await expect(new BrowserFormFlattener().flatten(file)).rejects.toThrow("No editable AcroForm fields");
  });
});

