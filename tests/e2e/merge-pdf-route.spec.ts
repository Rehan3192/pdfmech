import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makePdf(label: string, widths: readonly number[]): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  widths.forEach((width, index) => {
    const pdfPage = document.addPage([width, 595]);
    pdfPage.drawText(`${label} page ${index + 1}`, { x: 45, y: 520, size: 18, font });
  });
  return Buffer.from(await document.save());
}

test("Merge PDF route reorders files and downloads one native PDF responsively", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/merge-pdf");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Merge PDF files online for free.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator('input[type="file"]').setInputFiles([
    { name: "alpha.pdf", mimeType: "application/pdf", buffer: await makePdf("Alpha", [401, 402]) },
    { name: "beta.pdf", mimeType: "application/pdf", buffer: await makePdf("Beta", [501]) },
  ]);
  await expect(page.getByText("2 files · 3 pages", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Move beta.pdf up" }).click();
  await expect(page.locator(".merge-file-list li").first()).toContainText("beta.pdf");

  await page.getByRole("button", { name: "Merge 2 PDFs" }).click();
  await expect(page.getByRole("heading", { name: "Your merged PDF is ready" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download merged PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("beta-merged.pdf");
  const output = await PDFDocument.load(await readFile(await download.path()));
  expect(output.getPages().map((pdfPage) => pdfPage.getWidth())).toEqual([501, 401, 402]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
