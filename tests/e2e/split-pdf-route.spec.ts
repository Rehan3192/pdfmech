import { unzipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { expect, test } from "@playwright/test";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  [401, 402, 403, 404].forEach((width, index) => {
    const page = document.addPage([width, 595]);
    page.drawText(`Split source page ${index + 1}`, { x: 40, y: 520, size: 18, font });
  });
  return Buffer.from(await document.save());
}

test("splits a PDF into custom ranges and downloads a valid ZIP", async ({ page }) => {
  await page.goto("/split-pdf");
  await expect(page.getByRole("heading", { name: "Split PDF pages online for free." })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({ name: "chapters.pdf", mimeType: "application/pdf", buffer: await makePdf() });
  await expect(page.getByRole("heading", { name: "chapters.pdf" })).toBeVisible();
  await expect(page.locator(".split-page-grid figure")).toHaveCount(4);

  await page.getByRole("button", { name: /Custom ranges/ }).click();
  await page.getByLabel("Output ranges").fill("1-2, 3-4");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".split-summary")).toContainText("2Output PDFs");
  await page.getByRole("button", { name: "Create 2 split PDFs" }).click();
  await expect(page.getByRole("heading", { name: "Your split PDFs are ready" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download all as ZIP" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("chapters-split-pdfs.zip");
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(path!));
  const archive = unzipSync(bytes);
  expect(Object.keys(archive).sort()).toEqual(["chapters-pages-1-2.pdf", "chapters-pages-3-4.pdf"]);
  const first = await PDFDocument.load(archive["chapters-pages-1-2.pdf"]!);
  const second = await PDFDocument.load(archive["chapters-pages-3-4.pdf"]!);
  expect(first.getPages().map((item) => item.getWidth())).toEqual([401, 402]);
  expect(second.getPages().map((item) => item.getWidth())).toEqual([403, 404]);
});
