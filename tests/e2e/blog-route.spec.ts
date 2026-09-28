import { expect, test } from "@playwright/test";

const post = {
  id: 42,
  slug: "make-scanned-pdf-searchable",
  date: "2026-09-28T10:00:00",
  modified: "2026-09-28T11:00:00",
  title: { rendered: "How to Make a Scanned PDF Searchable" },
  excerpt: { rendered: "A practical private OCR guide for scanned documents." },
  content: {
    rendered:
      '<h2>Why searchable text matters</h2><p onclick="alert(1)">Use OCR to find text.</p><script>window.bad = true</script><figure class="wp-block-table"><table><tbody><tr><th>Input</th><th>Output</th></tr><tr><td>Scan</td><td>Searchable PDF</td></tr></tbody></table></figure>',
  },
  _embedded: {
    "wp:term": [[{ taxonomy: "category", name: "OCR & Searchable PDFs", slug: "ocr-searchable-pdfs" }]],
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/wp-json/wp/v2/posts**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const slug = requestUrl.searchParams.get("slug");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(slug === null || slug === post.slug ? [post] : []),
    });
  });
});

test("blog archive and article use the shared PDFMech template safely", async ({ page }) => {
  await page.goto("/blog");

  await expect(page.getByRole("heading", { name: "Practical PDF guides and privacy-first tips." })).toBeVisible();
  await expect(page.getByRole("heading", { name: post.title.rendered })).toBeVisible();
  await page.getByRole("link", { name: post.title.rendered }).click();

  await expect(page).toHaveURL(new RegExp(`/blog/${post.slug}$`));
  await expect(page.getByTestId("blog-article")).toContainText("Why searchable text matters");
  await expect(page.getByTestId("blog-article").locator("table")).toContainText("Searchable PDF");
  await expect(page.getByTestId("blog-article").locator("script")).toHaveCount(0);
  await expect(page.getByTestId("blog-article").locator("[onclick]")).toHaveCount(0);
  await expect(page).toHaveTitle(`${post.title.rendered} | PDFMech`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `https://www.pdfmech.com/blog/${post.slug}`,
  );
});
