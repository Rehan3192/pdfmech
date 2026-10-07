import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createPdfToolkit } from "pdfstudio";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const text of ["PRIVATE FINANCIAL REPORT", "SECOND CONFIDENTIAL PAGE"]) {
    const page = document.addPage([420, 595]);
    page.drawText(text, { x: 55, y: 430, size: 18, font });
  }
  return Buffer.from(await document.save());
}

test("creates an AES-256 PDF that rejects the wrong password", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/protect-pdf");
  await expect(page.getByRole("heading", { name: "Password protect a PDF online for free." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator('input[type="file"]').setInputFiles({ name: "private-report.pdf", mimeType: "application/pdf", buffer: await makePdf() });
  await expect(page.getByRole("heading", { name: "private-report.pdf" })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("Correct-Horse-47!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Correct-Horse-47!");
  await page.getByText("PDF permissions").click();
  await page.getByRole("checkbox", { name: /Allow copying/ }).uncheck();
  await page.getByRole("button", { name: "Protect PDF" }).click();
  await expect(page.getByRole("heading", { name: "Your protected PDF is ready" })).toBeVisible({ timeout: 120_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download protected PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("private-report-protected.pdf");
  const path = await download.path();
  expect(path).not.toBeNull();
  const output = await readFile(path!);
  const toolkit = await createPdfToolkit();
  await expect(toolkit.getInfo(output, { password: "wrong-password" })).rejects.toThrow();
  const info = await toolkit.getInfo(output, { password: "Correct-Horse-47!" });
  expect(info.pageCount).toBe(2);
  expect(info.encrypted).toBe(true);
  expect(info.encryption?.bits).toBe(256);
  expect(info.encryption?.method).toBe("AESv3");
  expect(info.encryption?.permissions.extract).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
