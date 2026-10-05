import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function makePdf(lines: readonly string[]): Promise<Buffer> {
  const document = await PDFDocument.create();
  const page = document.addPage([420, 595]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, index) => page.drawText(line, { x: 45, y: 520 - index * 28, size: 12, font, color: rgb(.05, .08, .12) }));
  return Buffer.from(await document.save());
}

test("Compare PDF route finds text changes and downloads a report responsively", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/compare-pdf");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Compare two PDF files online.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const inputs = page.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles({ name: "contract-old.pdf", mimeType: "application/pdf", buffer: await makePdf(["Service Agreement", "Payment is due within 30 days.", "Governing law remains unchanged."]) });
  await inputs.nth(1).setInputFiles({ name: "contract-new.pdf", mimeType: "application/pdf", buffer: await makePdf(["Service Agreement", "Payment is due within 15 days.", "Governing law remains unchanged."]) });
  await page.getByRole("button", { name: "Compare PDF text" }).click();
  await expect(page.getByRole("heading", { name: "1 changed page found" })).toBeVisible();
  await expect(page.getByText("Payment is due within 30 days.", { exact: true })).toBeVisible();
  await expect(page.getByText("Payment is due within 15 days.", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download report" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("contract-new-comparison.txt");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
