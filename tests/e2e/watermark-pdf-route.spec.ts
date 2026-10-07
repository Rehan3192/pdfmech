import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const pageNumber of [1, 2]) {
    const page = document.addPage([420, 595]);
    page.drawRectangle({ x: 35, y: 430, width: 350, height: 95, color: rgb(.9, .95, 1) });
    page.drawText(`SOURCE PAGE ${pageNumber}`, { x: 60, y: 470, size: 25, font });
    page.drawText("Native PDF content remains in the output.", { x: 60, y: 390, size: 14, font });
  }
  return Buffer.from(await document.save());
}

test("adds a customizable watermark to selected PDF pages on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/watermark-pdf");
  await expect(page.getByRole("heading", { name: "Add a watermark to a PDF online." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const source = await makePdf();
  await page.locator('input[type="file"]').setInputFiles({ name: "review.pdf", mimeType: "application/pdf", buffer: source });
  await expect(page.getByRole("heading", { name: "review.pdf" })).toBeVisible({ timeout: 120_000 });
  await page.getByLabel("Watermark text").fill("REVIEW COPY");
  await page.getByLabel("Watermark size").fill("42");
  await page.getByLabel("Watermark opacity").fill("45");
  await page.getByRole("button", { name: "+45°" }).click();
  await page.getByRole("button", { name: "Bottom right" }).click();
  await page.getByLabel("Custom range").check();
  await page.getByLabel("Pages to watermark").fill("2");
  await expect(page.locator(".watermark-paper > span")).toHaveCount(0);
  await page.getByRole("button", { name: "Preview page 2, selected for watermark" }).click();
  await expect(page.locator(".watermark-paper > span")).toHaveText("REVIEW COPY");
  await expect(page.getByRole("button", { name: "Watermark 1 page" })).toBeEnabled();
  await page.getByRole("button", { name: "Watermark 1 page" }).click();
  await expect(page.getByRole("heading", { name: "Your watermarked PDF is ready" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("1 of 2 pages watermarked.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download watermarked PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("review-watermarked.pdf");
  const outputBytes = await readFile((await download.path())!);
  const output = await PDFDocument.load(outputBytes);
  expect(output.getPageCount()).toBe(2);
  expect(outputBytes.byteLength).toBeGreaterThan(source.byteLength);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
