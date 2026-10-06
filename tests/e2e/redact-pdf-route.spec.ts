import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function makeSensitivePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([420, 595]);
  first.drawText("SECRET ACCOUNT 123456789", { x: 65, y: 410, size: 19, font });
  first.drawText("Confidential customer record", { x: 65, y: 370, size: 13, font });
  const second = document.addPage([420, 595]);
  second.drawText("PUBLIC PAGE CONTENT", { x: 65, y: 410, size: 19, font });
  return Buffer.from(await document.save());
}

async function extractText(bytes: Uint8Array, pageNumber: number): Promise<string> {
  const task = getDocument({ data: Uint8Array.from(bytes) });
  const document = await task.promise;
  try {
    const page = await document.getPage(pageNumber);
    try {
      const content = await page.getTextContent();
      return content.items.map((item) => "str" in item ? item.str : "").join(" ");
    } finally { page.cleanup(); }
  } finally { await task.destroy(); }
}

test("permanently redacts a marked page while preserving untouched page text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/redact-pdf");
  await expect(page.getByRole("heading", { name: "Redact PDF content securely online." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator('input[type="file"]').setInputFiles({ name: "records.pdf", mimeType: "application/pdf", buffer: await makeSensitivePdf() });
  await expect(page.getByRole("heading", { name: "records.pdf" })).toBeVisible();
  await expect(page.locator(".redact-stage img")).toBeVisible();
  const stage = page.locator(".redact-stage");
  await stage.scrollIntoViewIfNeeded();
  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * .12, bounds!.y + bounds!.height * .12);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * .88, bounds!.y + bounds!.height * .28, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".redact-area")).toHaveCount(1);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Apply 1 permanent redaction" }).click();
  await expect(page.getByRole("heading", { name: "Your permanently redacted PDF is ready" })).toBeVisible({ timeout: 120_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download redacted PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("records-redacted.pdf");
  const path = await download.path();
  expect(path).not.toBeNull();
  const output = await readFile(path!);
  expect(await extractText(output, 1)).not.toContain("SECRET ACCOUNT");
  expect(await extractText(output, 2)).toContain("PUBLIC PAGE CONTENT");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
