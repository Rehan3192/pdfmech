import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { BrowserPdfFormFiller } from "../../src/infrastructure/pdflib/browser-pdf-form-filler";

async function createFormPdf(): Promise<File> {
  const document = await PDFDocument.create();
  const page = document.addPage([420, 595]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const form = document.getForm();
  const name = form.createTextField("applicant.fullName");
  name.addToPage(page, { x: 40, y: 500, width: 220, height: 26, font });
  const accepted = form.createCheckBox("terms.accepted");
  accepted.addToPage(page, { x: 40, y: 455, width: 18, height: 18 });
  const contact = form.createRadioGroup("contact.method");
  contact.addOptionToPage("Email", page, { x: 40, y: 415, width: 18, height: 18 });
  contact.addOptionToPage("Phone", page, { x: 100, y: 415, width: 18, height: 18 });
  const country = form.createDropdown("applicant.country");
  country.setOptions(["Pakistan", "Canada"]);
  country.addToPage(page, { x: 40, y: 360, width: 180, height: 26, font });
  const bytes = await document.save();
  return new File([new Uint8Array(bytes).buffer], "application.pdf", { type: "application/pdf" });
}

describe("BrowserPdfFormFiller", () => {
  it("inspects and fills common AcroForm fields while keeping them editable", async () => {
    const file = await createFormPdf();
    const processor = new BrowserPdfFormFiller();
    const inspection = await processor.inspect(file);
    expect(inspection).toMatchObject({ pageCount: 1, hasXfa: false, hasSignatures: false });
    expect(inspection.fields.map((field) => field.kind).sort()).toEqual(["checkbox", "dropdown", "radio", "text"]);

    const result = await processor.fill(file, {
      "applicant.fullName": "Muhammad Rehan",
      "terms.accepted": true,
      "contact.method": "Email",
      "applicant.country": ["Pakistan"],
    }, false);
    expect(result.downloadName).toBe("application-filled.pdf");
    expect(result.updatedFieldCount).toBe(4);
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    const form = output.getForm();
    expect(form.getTextField("applicant.fullName").getText()).toBe("Muhammad Rehan");
    expect(form.getCheckBox("terms.accepted").isChecked()).toBe(true);
    expect(form.getRadioGroup("contact.method").getSelected()).toBe("Email");
    expect(form.getDropdown("applicant.country").getSelected()).toEqual(["Pakistan"]);
  });

  it("can flatten the completed fields into a fixed copy", async () => {
    const result = await new BrowserPdfFormFiller().fill(await createFormPdf(), {
      "applicant.fullName": "Alex Morgan",
      "terms.accepted": true,
      "contact.method": "Phone",
      "applicant.country": ["Canada"],
    }, true);
    expect(result.flattened).toBe(true);
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(output.getForm().getFields()).toHaveLength(0);
  });
});
