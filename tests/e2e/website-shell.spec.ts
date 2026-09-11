import { expect, test } from "@playwright/test";

test("website shell has clear navigation and SEO support pages", async ({
  page,
}) => {
  await page.goto("/");
  const mainNavigation = page.getByRole("navigation", { name: "Main navigation" });

  await expect(mainNavigation).toBeVisible();
  await expect(page.getByRole("link", { name: "PDFMech home" })).toBeVisible();
  await expect(page.getByTestId("site-home")).toContainText(
    "Fix your PDFs without uploading them.",
  );
  await expect(
    page
      .getByRole("heading", { name: "Fix your PDFs without uploading them." })
      .locator("..")
      .getByRole("button", { name: "Open PDF" }),
  ).toBeVisible();

  await mainNavigation.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByTestId("site-about")).toContainText(
    "Built for quick edits",
  );
  await expect(
    page.getByTestId("site-about").getByRole("button", { name: "Open PDF" }),
  ).toBeVisible();

  await mainNavigation.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByTestId("site-privacy")).toContainText(
    "does not upload your PDF to an editing server",
  );
  await expect(page.getByTestId("site-privacy")).toContainText(
    "What stays local",
  );

  await mainNavigation.getByRole("link", { name: "Contact" }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByTestId("site-contact")).toContainText(
    "Please do not send sensitive documents",
  );
  await expect(
    page.getByRole("link", { name: "Email support" }),
  ).toHaveAttribute("href", "mailto:muhammadrehan3192@gmail.com");

  await mainNavigation.getByRole("link", { name: "PDF Editor", exact: true }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByTestId("production-empty")).toContainText(
    "No PDF selected",
  );
});
