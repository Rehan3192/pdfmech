import { expect, test } from "@playwright/test";

test("website shell has clear navigation and SEO support pages", async ({
  page,
}) => {
  await page.goto("/");
  const mainNavigation = page.getByRole("navigation", { name: "Main navigation" });

  await expect(mainNavigation).toBeVisible();
  await expect(page.getByRole("link", { name: "PDFMech home" })).toBeVisible();
  await expect(page.getByTestId("site-home")).toContainText(
    "Edit your PDFs without uploading them.",
  );
  await expect(
    page
      .getByRole("heading", { name: "Edit your PDFs without uploading them." })
      .locator("..")
      .getByRole("button", { name: "Open PDF" }),
  ).toBeVisible();

  await mainNavigation.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByTestId("site-about")).toContainText(
    "Built for quick edits",
  );
  await expect(
    page.getByTestId("site-about").getByRole("button", { name: /Open PDF$/ }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Trust and legal links" })
    .getByRole("link", { name: "Privacy" })
    .click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByTestId("site-privacy")).toContainText(
    "does not require sending your PDF to an editing server",
  );
  await expect(page.getByTestId("site-privacy")).toContainText(
    "What stays local",
  );

  await mainNavigation.getByRole("link", { name: "Contact" }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByTestId("site-contact")).toContainText(
    "Avoid attaching sensitive or confidential PDFs",
  );
  await expect(
    page.getByRole("link", { name: "Email support" }),
  ).toHaveAttribute("href", "mailto:muhammadrehan3192@gmail.com");

  await expect(mainNavigation.locator(".site-tools-menu")).toHaveCount(0);
  await mainNavigation.getByRole("link", { name: "Tools" }).click();
  await expect(page).toHaveURL(/\/tools$/);
  const toolsDirectory = page.getByTestId("site-tools-directory");
  await expect(toolsDirectory.getByRole("heading", { name: "Free PDF tools that work in your browser." })).toBeVisible();
  await expect(toolsDirectory.getByRole("link", { name: /OCR PDF/ })).toHaveAttribute("href", "/ocr-pdf");

  const search = toolsDirectory.getByRole("searchbox", { name: "Search PDF tools" });
  await search.fill("merge");
  await expect(toolsDirectory.locator(".tools-directory-card")).toHaveCount(1);
  await expect(toolsDirectory.getByRole("link", { name: /Merge PDF/ })).toBeVisible();
  await search.clear();

  await toolsDirectory.getByRole("button", { name: "Organize PDF" }).click();
  await expect(toolsDirectory.getByRole("link", { name: /Extract PDF Pages/ })).toBeVisible();
  await expect(toolsDirectory.getByRole("link", { name: /OCR PDF/ })).toHaveCount(0);
  await toolsDirectory.getByRole("button", { name: "All tools" }).click();
  await toolsDirectory.locator('a[href="/editor"]').click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByTestId("production-empty")).toContainText(
    "Edit PDFs privately in your browser",
  );
});

test("marketing pages describe the current document-first editor", async ({ page }) => {
  await page.goto("/how-it-works");

  await expect(page.getByRole("heading", { name: "Floating action dock" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contextual properties sheet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "More Tools and Pages sheets" })).toBeVisible();
  await expect(page.getByTestId("site-how-it-works")).not.toContainText("Left tool rail");
  await expect(page.getByTestId("site-how-it-works")).not.toContainText("Right properties panel");
  await expect(page.getByTestId("site-how-it-works")).not.toContainText("Bottom page bar");

  await page.goto("/features");
  await expect(page.getByTestId("site-features")).toContainText("Pick from PDF");
  await expect(page.getByTestId("site-features")).not.toContainText("Redact for a redaction-style visual block");
});
