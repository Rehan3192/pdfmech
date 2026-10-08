import { unzipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { expect, test } from "@playwright/test";

async function makePdf(pageCount = 4): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  Array.from({ length: pageCount }, (_, index) => {
    const page = document.addPage([401 + index, 595]);
    page.drawText(`Employee record ${index + 1}`, { x: 40, y: 520, size: 18, font });
  });
  return Buffer.from(await document.save());
}

test("blocks incomplete mappings and exports a verified named ZIP", async ({ page }) => {
  const documentUploads: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") documentUploads.push(`${request.method()} ${request.url()}`);
  });
  await page.goto("/split-pdf-and-rename");
  await expect(page.getByRole("heading", { name: "Split a PDF into Multiple Files and Automatically Rename Them" })).toBeVisible();

  await page.locator('input[accept*="application/pdf"]').setInputFiles({ name: "payslips.pdf", mimeType: "application/pdf", buffer: await makePdf() });
  await expect(page.getByText("payslips.pdf", { exact: true })).toBeVisible();

  const nameInput = page.locator('input[accept*=".csv"]');
  await nameInput.setInputFiles({ name: "employees.csv", mimeType: "text/csv", buffer: Buffer.from("filename\nAlice\nBob\nCara\n") });
  await expect(page.getByText(/issue.*to resolve/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Generate 4 PDFs/ })).toBeDisabled();
  await expect(page.getByText("Group 4 needs a filename.")).toBeVisible();

  await nameInput.setInputFiles({ name: "employees.csv", mimeType: "text/csv", buffer: Buffer.from("filename\nAlice\nBob\nCara\nDan\n") });
  await expect(page.getByText("All checks passed")).toBeVisible();

  await page.getByLabel("Output filename for group 2").fill("Alice");
  await expect(page.getByText(/Groups 1 and 2 would both export/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Generate 4 PDFs/ })).toBeDisabled();
  await page.getByLabel("Output filename for group 2").fill("Bob");

  await page.getByRole("button", { name: "Generate 4 PDFs + ZIP" }).click();
  await expect(page.getByRole("heading", { name: "Batch created and verified" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download verified ZIP" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("payslips-split-pdfs.zip");
  const path = await download.path();
  const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(path!));
  const archive = unzipSync(bytes);
  expect(Object.keys(archive).sort()).toEqual(["Alice.pdf", "Bob.pdf", "Cara.pdf", "Dan.pdf", "payslips-split-manifest.csv"]);
  const bob = await PDFDocument.load(archive["Bob.pdf"]!);
  expect(bob.getPage(0).getWidth()).toBe(402);
  expect(new TextDecoder().decode(archive["payslips-split-manifest.csv"])).toContain('"Dan.pdf","4",1,verified');
  expect(documentUploads).toEqual([]);
});

test("keeps the mapping review usable on a narrow phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/split-pdf-and-rename");
  await page.locator('input[accept*="application/pdf"]').setInputFiles({ name: "mobile.pdf", mimeType: "application/pdf", buffer: await makePdf(3) });
  await expect(page.getByText("mobile.pdf", { exact: true })).toBeVisible();
  await page.locator('input[accept*=".csv"]').setInputFiles({ name: "names.txt", mimeType: "text/plain", buffer: Buffer.from("One\nTwo\nThree\n") });
  await expect(page.getByText("All checks passed")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByLabel("Output filename for group 3")).toBeVisible();
});
