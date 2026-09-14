import { expect, test } from "@playwright/test";
import { canonicalUrl, SEO_PAGE_KEYS, SEO_PAGES } from "../../src/seo-config";

test("every public route exposes unique metadata, one H1, and a mobile-safe layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of SEO_PAGE_KEYS) {
    const config = SEO_PAGES[route];
    await page.goto(config.path);

    await expect(page).toHaveTitle(config.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      config.description,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      canonicalUrl(route),
    );
    await expect(page.locator("h1")).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
  }
});

test("unknown routes render a branded noindex page", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,follow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the PDF editor" })).toBeVisible();
});
