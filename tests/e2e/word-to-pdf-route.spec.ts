import { readFile } from "node:fs/promises";

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function makeDocx(): Promise<Buffer> {
  const document = new Document({ sections: [{ children: [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Quarterly report")] }),
    new Paragraph("This document was converted locally in the browser."),
    new Paragraph({ text: "First action item", bullet: { level: 0 } }),
  ] }] });
  return Buffer.from(await Packer.toBuffer(document));
}

test("converts a DOCX document into a valid PDF", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/word-to-pdf");
  await expect(page.getByRole("heading", { name: "Convert Word to PDF in your browser." })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "report.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await makeDocx() });
  await expect(page.getByRole("heading", { name: "report.docx" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Quarterly report/)).toBeVisible();
  await page.getByRole("button", { name: "Landscape" }).click();
  await page.getByRole("button", { name: "Convert Word to PDF" }).click();
  await expect(page.getByRole("heading", { name: "Your PDF is ready" })).toBeVisible({ timeout: 120_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("report.pdf");
  const output = await PDFDocument.load(await readFile((await download.path())!));
  expect(output.getPageCount()).toBeGreaterThanOrEqual(1);
  expect(output.getPage(0).getWidth()).toBeGreaterThan(output.getPage(0).getHeight());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
