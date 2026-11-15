import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.HelveticaBold);
  for (const [index, color] of [[0, rgb(.08, .48, .92)], [1, rgb(.95, .38, .18)]] as const) {
    const page = document.addPage([420, 595]);
    page.drawRectangle({ x: 42, y: 360, width: 336, height: 145, color });
    page.drawText(`PDF TO PNG PAGE ${index + 1}`, { x: 60, y: 300, size: 22, font });
  }
  return Buffer.from(await document.save());
}

test("converts selected PDF pages to PNG and packages multiple pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pdf-to-png");
  await expect(page.getByRole("heading", { name: "Convert PDF pages to PNG images." })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "visual-report.pdf", mimeType: "application/pdf", buffer: await makePdf() });
  await expect(page.getByRole("heading", { name: "visual-report.pdf" })).toBeVisible({ timeout: 120_000 });

  await page.getByLabel("Custom pages").check();
  await page.getByLabel("Pages to convert").fill("2");
  await page.getByRole("button", { name: "Convert 1 page to PNG" }).click();
  await expect(page.getByRole("heading", { name: "Your PNG image is ready" })).toBeVisible({ timeout: 120_000 });
  const singleDownloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG", exact: true }).click();
  const singleDownload = await singleDownloadPromise;
  expect(singleDownload.suggestedFilename()).toBe("visual-report-page-02.png");
  const png = await readFile((await singleDownload.path())!);
  expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  await page.getByLabel("All pages").check();
  await page.getByRole("button", { name: "Convert 2 pages to PNG" }).click();
  await expect(page.getByRole("heading", { name: "2 PNG images are ready" })).toBeVisible({ timeout: 120_000 });
  const zipDownloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG ZIP" }).click();
  const zipDownload = await zipDownloadPromise;
  const archive = unzipSync(await readFile((await zipDownload.path())!));
  expect(Object.keys(archive)).toEqual(["visual-report-page-01.png", "visual-report-page-02.png"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
