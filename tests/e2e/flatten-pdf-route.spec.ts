import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makeFormPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const page = document.addPage([420, 595]);
  const form = document.getForm();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const name = form.createTextField("customer.name");
  name.setText("PDFMech Test");
  name.addToPage(page, { x: 45, y: 500, width: 240, height: 30, font });
  const approved = form.createCheckBox("request.approved");
  approved.check();
  approved.addToPage(page, { x: 45, y: 450, width: 20, height: 20 });
  return Buffer.from(await document.save());
}

test("Flatten PDF route inspects, flattens, and downloads a form responsively", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/flatten-pdf");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Flatten PDF forms online for free.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('input[type="file"]').setInputFiles({ name: "filled-form.pdf", mimeType: "application/pdf", buffer: await makeFormPdf() });
  await expect(page.getByRole("heading", { name: "2 editable fields found" })).toBeVisible();
  await expect(page.getByText("customer.name", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Flatten 2 fields" }).click();
  await page.getByRole("link", { name: "Download flattened PDF" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("filled-form-flattened.pdf");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
