import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test("arranges JPG images and downloads a validated printable PDF on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/jpg-to-pdf");
  await expect(page.getByRole("heading", { name: "Convert JPG images to one PDF." })).toBeVisible();
  const images = await page.evaluate(() => {
    function createJpg(color: string, label: string): string {
      const canvas = document.createElement("canvas");
      canvas.width = 360;
      canvas.height = 240;
      const context = canvas.getContext("2d")!;
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#fff";
      context.font = "bold 64px sans-serif";
      context.fillText(label, 92, 145);
      return canvas.toDataURL("image/jpeg", .92);
    }
    return [
      { name: "blue.jpg", data: createJpg("#137ce8", "ONE") },
      { name: "orange.jpg", data: createJpg("#f26432", "TWO") },
    ];
  });
  await page.locator('input[type="file"]').setInputFiles(images.map((image) => ({ name: image.name, mimeType: "image/jpeg", buffer: Buffer.from(image.data.split(",")[1]!, "base64") })));
  await expect(page.getByRole("heading", { name: "Images ready for PDF" })).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Move orange.jpg up" }).click();
  await page.getByRole("button", { name: "A4", exact: true }).click();
  await page.getByRole("button", { name: "Landscape", exact: true }).click();
  await page.getByRole("button", { name: "Large", exact: true }).click();
  await page.getByRole("button", { name: "Create PDF with 2 pages" }).click();
  await expect(page.getByRole("heading", { name: "Your PDF is ready" })).toBeVisible({ timeout: 120_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("orange-images.pdf");
  const output = await PDFDocument.load(await readFile((await download.path())!));
  expect(output.getPageCount()).toBe(2);
  for (const pdfPage of output.getPages()) {
    expect(pdfPage.getWidth()).toBeCloseTo(841.89, 1);
    expect(pdfPage.getHeight()).toBeCloseTo(595.28, 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
