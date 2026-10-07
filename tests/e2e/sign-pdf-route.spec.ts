import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const pageNumber of [1, 2]) {
    const page = document.addPage([420, 595]);
    page.drawText(`AGREEMENT PAGE ${pageNumber}`, { x: 55, y: 505, size: 22, font });
    page.drawText("Signature: __________________________", { x: 55, y: 95, size: 14, font });
  }
  return Buffer.from(await document.save());
}

test("creates and places a typed signature on multiple PDF pages on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sign-pdf");
  await expect(page.getByRole("heading", { name: "Sign a PDF online for free." })).toBeVisible();
  const source = await makePdf();
  await page.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({ name: "agreement.pdf", mimeType: "application/pdf", buffer: source });
  await expect(page.getByRole("heading", { name: "agreement.pdf" })).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Type", exact: true }).click();
  await page.getByLabel("Signature text").fill("Muhammad Rehan");
  await page.getByRole("button", { name: "Use typed signature" }).click();
  await expect(page.getByAltText("Current signature preview")).toBeVisible();
  await page.getByRole("button", { name: "Add to page 1" }).click();
  await page.getByLabel("Selected signature size").fill("42");
  const placedSignature = page.locator(".sign-placement").first();
  await placedSignature.scrollIntoViewIfNeeded();
  const beforeLeft = await placedSignature.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
  const placementBox = await placedSignature.boundingBox();
  expect(placementBox).not.toBeNull();
  await page.mouse.move(placementBox!.x + placementBox!.width / 2, placementBox!.y + placementBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(placementBox!.x + placementBox!.width / 2 + 25, placementBox!.y + placementBox!.height / 2 + 10);
  await page.mouse.up();
  await expect.poll(async () => placedSignature.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left))).toBeGreaterThan(beforeLeft);
  await page.locator(".sign-page-strip > button").nth(1).click();
  await page.getByRole("button", { name: "Add to page 2" }).click();
  await expect(page.getByText("2", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Sign PDF with 2 signatures" }).click();
  await expect(page.getByRole("heading", { name: "Your signed PDF is ready" })).toBeVisible({ timeout: 120_000 });
  const pendingDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download signed PDF" }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe("agreement-signed.pdf");
  const outputBytes = await readFile((await download.path())!);
  const output = await PDFDocument.load(outputBytes);
  expect(output.getPageCount()).toBe(2);
  expect(outputBytes.byteLength).toBeGreaterThan(source.byteLength);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
