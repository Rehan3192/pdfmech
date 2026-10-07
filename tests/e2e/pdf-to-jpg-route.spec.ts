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
    page.drawText(`PDF TO JPG PAGE ${index + 1}`, { x: 60, y: 300, size: 22, font });
  }
  return Buffer.from(await document.save());
}

test("converts one page to JPG and multiple pages to a ZIP on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pdf-to-jpg");
  await expect(page.getByRole("heading", { name: "Convert PDF pages to JPG images." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator('input[type="file"]').setInputFiles({ name: "visual-report.pdf", mimeType: "application/pdf", buffer: await makePdf() });
  await expect(page.getByRole("heading", { name: "visual-report.pdf" })).toBeVisible({ timeout: 120_000 });
  await page.getByLabel("Custom pages").check();
  await page.getByLabel("Pages to convert").fill("2");
  const singleDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Convert 1 page to JPG" }).click();
  await expect(page.getByRole("heading", { name: "Your JPG image is ready" })).toBeVisible({ timeout: 120_000 });
  await page.getByRole("link", { name: "Download JPG", exact: true }).click();
  const singleDownload = await singleDownloadPromise;
  expect(singleDownload.suggestedFilename()).toBe("visual-report-page-02.jpg");
  const jpg = await readFile((await singleDownload.path())!);
  expect([...jpg.subarray(0, 2)]).toEqual([0xff, 0xd8]);

  await page.getByLabel("All pages").check();
  await page.getByRole("button", { name: "Convert 2 pages to JPG" }).click();
  await expect(page.getByRole("heading", { name: "2 JPG images are ready" })).toBeVisible({ timeout: 120_000 });
  const zipDownloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JPG ZIP" }).click();
  const zipDownload = await zipDownloadPromise;
  const archive = unzipSync(await readFile((await zipDownload.path())!));
  expect(Object.keys(archive)).toEqual(["visual-report-page-01.jpg", "visual-report-page-02.jpg"]);
  expect([...archive["visual-report-page-01.jpg"]!.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
