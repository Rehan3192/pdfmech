import { expect, test } from "@playwright/test";
import { degrees, PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function makeSkewedPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const page = document.addPage([420, 595]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let line = 0; line < 12; line += 1) {
    page.drawText(`Scanned document line ${line + 1} with enough text for angle analysis`, {
      x: 45,
      y: 510 - line * 30,
      size: 11,
      font,
      color: rgb(0.05, 0.08, 0.12),
      rotate: degrees(2.5),
    });
  }
  return Buffer.from(await document.save());
}

test("Deskew PDF route reviews, corrects, and downloads a scan responsively", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/deskew-pdf");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Straighten scanned PDF pages online.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('input[type="file"]').setInputFiles({ name: "crooked-scan.pdf", mimeType: "application/pdf", buffer: await makeSkewedPdf() });
  await expect(page.getByRole("heading", { name: "Review page angles" })).toBeVisible();
  await page.getByLabel("Correction angle for page 1").fill("-2.5");
  await page.getByRole("button", { name: "Create deskewed PDF" }).click();
  await expect(page.getByRole("heading", { name: "Your straightened PDF is ready" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download deskewed PDF" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("crooked-scan-deskewed.pdf");
  await expect(page.getByRole("link", { name: "Make searchable with OCR →" })).toHaveAttribute("href", "/ocr-pdf");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
