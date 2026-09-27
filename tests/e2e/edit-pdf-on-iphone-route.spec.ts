import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

test("iPhone guide provides a mobile-safe same-route editing workflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/edit-pdf-on-iphone");

  await expect(
    page.getByRole("heading", { name: "How to edit a PDF on iPhone in Safari." }),
  ).toBeVisible();
  await expect(page.locator(".iphone-guide-preview article")).toHaveCount(3);
  await expect(page.getByTestId("site-edit-pdf-on-iphone")).toContainText(
    "Downloads in iCloud Drive or On My iPhone",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  const structuredData = JSON.parse(
    (await page.locator("#route-structured-data").textContent()) ?? "{}",
  );
  expect(
    structuredData["@graph"].some(
      (item: { readonly "@type"?: string }) => item["@type"] === "Article",
    ),
  ).toBe(true);

  await page.getByTestId("iphone-editor-file-input").setInputFiles(fixturePath);

  await expect(page).toHaveURL(/\/edit-pdf-on-iphone$/);
  await expect(page.locator(".production-shell")).toHaveAttribute(
    "data-route-mode",
    "general",
  );
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally",
    { timeout: 120_000 },
  );
  await expect(
    page.getByRole("navigation", { name: "PDF editing tools" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});
