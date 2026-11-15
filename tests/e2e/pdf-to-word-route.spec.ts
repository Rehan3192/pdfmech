import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const [index, text] of ["PROJECT OVERVIEW", "Second page body text"].entries()) {
    const page = document.addPage([612, 792]);
    page.drawText(text, { x: 60, y: 700, size: index === 0 ? 20 : 12, font });
    page.drawText(`Editable line ${index + 1}`, { x: 60, y: 670, size: 12, font });
  }
  return Buffer.from(await document.save());
}

test("converts selectable PDF text into an editable DOCX", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pdf-to-word");
  await expect(page.getByRole("heading", { name: "Convert PDF to editable Word." })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "project.pdf", mimeType: "application/pdf", buffer: await makePdf() });
  await expect(page.getByRole("heading", { name: "project.pdf" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("PROJECT OVERVIEW")).toBeVisible();
  await page.getByRole("button", { name: "Convert PDF to Word" }).click();
  await expect(page.getByRole("heading", { name: "Your Word document is ready" })).toBeVisible({ timeout: 120_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download Word file" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("project.docx");
  const archive = unzipSync(await readFile((await download.path())!));
  const xml = strFromU8(archive["word/document.xml"]!);
  expect(xml).toContain("PROJECT OVERVIEW");
  expect(xml).toContain("Second page body text");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
