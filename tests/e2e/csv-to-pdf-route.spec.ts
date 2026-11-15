import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test("converts quoted CSV data into a valid local PDF", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/csv-to-pdf");

  await expect(page.getByRole("heading", { name: "Convert CSV tables to PDF." })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "sales-report.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      'Customer,Amount,Notes\n"Acme, Inc.",1200,"Paid in full"\nNorthwind,850,"Includes ""rush"" fee"\n',
      "utf8",
    ),
  });

  await expect(page.getByRole("heading", { name: "sales-report.csv" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Acme, Inc." })).toBeVisible();
  await page.getByRole("button", { name: "Convert CSV to PDF" }).click();
  await expect(page.getByRole("heading", { name: "Your PDF is ready" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sales-report.pdf");
  const document = await PDFDocument.load(await readFile((await download.path())!));
  expect(document.getPageCount()).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
