import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

test("private editor opens the general workspace on the same URL", async ({ page }) => {
  await page.goto("/private-pdf-editor");

  await expect(
    page.getByRole("heading", { name: "Edit PDFs privately without uploading them." }),
  ).toBeVisible();
  await expect(page.getByTestId("site-private-pdf-editor")).toContainText(
    "IndexedDB",
  );
  await expect(page.getByTestId("site-private-pdf-editor")).toContainText(
    "Network panel",
  );

  await page.getByTestId("private-editor-file-input").setInputFiles(fixturePath);

  await expect(page).toHaveURL(/\/private-pdf-editor$/);
  await expect(page.locator(".production-shell")).toHaveAttribute(
    "data-route-mode",
    "general",
  );
  await expect(page.locator(".production-shell")).toHaveAttribute(
    "data-route-action",
    "general",
  );
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally",
    { timeout: 120_000 },
  );
  await expect(
    page.getByRole("navigation", { name: "PDF editing tools" }),
  ).toBeVisible();
});

test("private editor landing and workspace stay mobile-safe", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/private-pdf-editor");

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  await page.getByTestId("private-editor-file-input").setInputFiles(fixturePath);
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally",
    { timeout: 120_000 },
  );
  await expect(page).toHaveURL(/\/private-pdf-editor$/);
  await expect(page.locator(".site-header")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});
