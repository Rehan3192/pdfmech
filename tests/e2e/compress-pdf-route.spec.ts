import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument, rgb } from "pdf-lib";

async function makeImageHeavyPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  for (let pageIndex = 0; pageIndex < 2; pageIndex += 1) {
    const page = document.addPage([612, 792]);
    for (let index = 0; index < 4_000; index += 1) {
      const seed = index + pageIndex * 97;
      page.drawRectangle({
        x: (seed * 37) % 600,
        y: (seed * 53) % 780,
        width: 4 + seed % 18,
        height: 4 + seed % 13,
        color: rgb((seed % 17) / 16, (seed % 29) / 28, (seed % 41) / 40),
        opacity: 0.7,
      });
    }
  }
  return Buffer.from(await document.save());
}

test("compresses a PDF locally and downloads a valid non-larger copy", async ({ page }) => {
  const source = await makeImageHeavyPdf();
  await page.goto("/compress-pdf");
  await expect(page.getByRole("heading", { name: "Compress PDF files online for free." })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({ name: "graphics.pdf", mimeType: "application/pdf", buffer: source });
  await expect(page.getByRole("heading", { name: "graphics.pdf" })).toBeVisible();
  await expect(page.locator(".compress-pdf-page-grid figure")).toHaveCount(2);
  await page.getByRole("button", { name: /Strong/ }).click();
  await page.getByRole("button", { name: "Compress PDF" }).click();
  await expect(page.locator(".compress-pdf-result")).toBeVisible({ timeout: 120_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("graphics-compressed.pdf");
  const path = await download.path();
  expect(path).not.toBeNull();
  const output = await readFile(path!);
  expect(output.byteLength).toBeLessThanOrEqual(source.byteLength);
  const document = await PDFDocument.load(output);
  expect(document.getPageCount()).toBe(2);
});
