import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  document.addPage([420, 595]);
  document.addPage([595, 420]);
  return Buffer.from(await document.save());
}

test("Bates route numbers a local PDF and remains responsive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bates-numbering-pdf");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add Bates numbers to PDFs privately.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('input[type="file"]').setInputFiles({ name: "case-file.pdf", mimeType: "application/pdf", buffer: await makePdf() });
  await expect(page.getByText("case-file.pdf")).toBeVisible();
  await page.getByLabel("Pages to number in case-file.pdf").fill("1-2");
  await page.getByLabel("Bates number color").fill("#e11d48");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add Bates numbers to 2 pages" }).click();
  await page.getByRole("link", { name: "Download PDF" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("case-file-bates.pdf");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
