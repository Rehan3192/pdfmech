import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makeFormPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const page = document.addPage([420, 595]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const form = document.getForm();
  const name = form.createTextField("applicant.fullName");
  name.addToPage(page, { x: 45, y: 500, width: 240, height: 30, font });
  const accepted = form.createCheckBox("terms.accepted");
  accepted.addToPage(page, { x: 45, y: 450, width: 20, height: 20 });
  const contact = form.createRadioGroup("contact.method");
  contact.addOptionToPage("Email", page, { x: 45, y: 405, width: 20, height: 20 });
  contact.addOptionToPage("Phone", page, { x: 110, y: 405, width: 20, height: 20 });
  const country = form.createDropdown("applicant.country");
  country.setOptions(["Pakistan", "Canada"]);
  country.addToPage(page, { x: 45, y: 350, width: 180, height: 28, font });
  return Buffer.from(await document.save());
}

test("fills and downloads an editable PDF form responsively", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fill-pdf-form");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fill PDF forms online for free.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const source = await makeFormPdf();
  await page.locator('input[type="file"]').setInputFiles({ name: "application.pdf", mimeType: "application/pdf", buffer: source });
  await expect(page.getByRole("heading", { name: "Complete your PDF form" })).toBeVisible();
  await page.locator(".fill-form-field").filter({ hasText: "Full Name" }).locator('input[type="text"]').fill("Muhammad Rehan");
  await page.locator(".fill-form-field").filter({ hasText: "Terms Accepted" }).locator('input[type="checkbox"]').check({ force: true });
  await page.locator(".fill-form-field").filter({ hasText: "Contact Method" }).getByLabel("Email", { exact: true }).check();
  await page.locator(".fill-form-field").filter({ hasText: "Applicant Country" }).locator("select").selectOption("Pakistan");
  await expect(page.getByText("4 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Save completed PDF (4 fields)" }).click();
  await expect(page.getByRole("heading", { name: "Your completed PDF is ready" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download filled PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("application-filled.pdf");
  const bytes = await readFile((await download.path())!);
  const output = await PDFDocument.load(bytes);
  expect(output.getForm().getTextField("applicant.fullName").getText()).toBe("Muhammad Rehan");
  expect(output.getForm().getCheckBox("terms.accepted").isChecked()).toBe(true);
  expect(output.getForm().getRadioGroup("contact.method").getSelected()).toBe("Email");
  expect(output.getForm().getDropdown("applicant.country").getSelected()).toEqual(["Pakistan"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
