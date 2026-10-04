import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function makeMetadataPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  document.addPage([420, 595]);
  document.setTitle("Quarterly Plan");
  document.setAuthor("Private Author");
  document.setSubject("Board review");
  document.setKeywords(["private", "quarterly"]);
  return Buffer.from(await document.save());
}

test("PDF metadata route inspects, removes, and downloads responsively", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/remove-pdf-metadata");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("View and remove PDF metadata online.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('input[type="file"]').setInputFiles({ name: "private-plan.pdf", mimeType: "application/pdf", buffer: await makeMetadataPdf() });
  await expect(page.getByRole("heading", { name: /removable items?/ })).toBeVisible();
  await expect(page.getByText("Quarterly Plan", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Private Author", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Remove all detected metadata" }).click();
  await expect(page.getByRole("heading", { name: "Your cleaned PDF is ready" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download cleaned PDF" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("private-plan-metadata-removed.pdf");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
