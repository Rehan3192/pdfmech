import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makeTablePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([612, 792]);
  for (const [rowIndex, row] of [
    ["Customer", "Amount", "Status"],
    ["Acme", "1200", "Paid"],
    ["Northwind", "850", "Pending"],
  ].entries()) {
    const y = 720 - rowIndex * 28;
    row.forEach((value, columnIndex) => {
      const x = [60, 250, 390][columnIndex] ?? 60;
      page.drawText(value, { x, y, size: 12, font });
    });
  }
  return Buffer.from(await document.save());
}

test("extracts aligned selectable PDF text into CSV", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pdf-to-csv");

  await expect(page.getByRole("heading", { name: "Extract PDF tables to CSV." })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "invoices.pdf",
    mimeType: "application/pdf",
    buffer: await makeTablePdf(),
  });

  await expect(page.getByRole("heading", { name: "invoices.pdf" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("cell", { name: "Northwind" })).toBeVisible();
  await page.getByLabel("Add page-number column").check();
  await page.getByRole("button", { name: "Create CSV" }).click();
  await expect(page.getByRole("heading", { name: "Your CSV is ready" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("invoices.csv");
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain("Page,Column 1,Column 2,Column 3");
  expect(csv).toContain("1,Acme,1200,Paid");
  expect(csv).toContain("1,Northwind,850,Pending");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
