import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
    const page = document.addPage([420 + pageNumber, 595]);
    page.drawText(`Extract test page ${pageNumber}`, { x: 45, y: 520, size: 18, font });
  }
  return Buffer.from(await document.save());
}

test("Extract PDF Pages route selects ranges and downloads native pages responsively", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/extract-pdf-pages");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Extract pages from a PDF online.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator('input[type="file"]').setInputFiles({
    name: "source.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(),
  });
  await expect(page.getByRole("button", { name: "Deselect page 4" })).toBeVisible();
  await page.getByLabel("Pages to extract").fill("2, 4");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Extract 2 pages" }).click();
  await expect(page.getByRole("heading", { name: "Your extracted PDF is ready" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download extracted PDF" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("source-extracted-pages.pdf");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
