import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createPdfToolkit } from "pdfstudio";

const PASSWORD = "Known-Password-47!";

async function makeLockedPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const text of ["LOCKED REPORT PAGE ONE", "LOCKED REPORT PAGE TWO"]) {
    const page = document.addPage([420, 595]);
    page.drawText(text, { x: 55, y: 430, size: 18, font });
  }
  const toolkit = await createPdfToolkit();
  const locked = await toolkit.lock(await document.save(), {
    userPassword: PASSWORD,
    ownerPassword: "Separate-Owner-Password-92!",
    keyLength: 256,
  });
  return Buffer.from(locked);
}

test("rejects a wrong password and downloads a verified unencrypted PDF", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/unlock-pdf");
  await expect(page.getByRole("heading", { name: "Unlock a PDF online for free." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator('input[type="file"]').setInputFiles({ name: "locked-report.pdf", mimeType: "application/pdf", buffer: await makeLockedPdf() });
  await expect(page.getByRole("heading", { name: "locked-report.pdf" })).toBeVisible({ timeout: 120_000 });
  await page.getByLabel("Current PDF password").fill("wrong-password");
  await page.getByRole("button", { name: "Unlock PDF" }).click();
  await expect(page.getByRole("alert")).toContainText("did not unlock", { timeout: 120_000 });

  await page.getByLabel("Current PDF password").fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock PDF" }).click();
  await expect(page.getByRole("heading", { name: "Your unlocked PDF is ready" })).toBeVisible({ timeout: 120_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download unlocked PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("locked-report-unlocked.pdf");
  const path = await download.path();
  expect(path).not.toBeNull();
  const output = await readFile(path!);
  const toolkit = await createPdfToolkit();
  const info = await toolkit.getInfo(output);
  expect(info.encrypted).toBe(false);
  expect(info.pageCount).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
