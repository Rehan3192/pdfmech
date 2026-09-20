import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

test("add-text landing opens the real editor on the same URL with Text armed", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as Window & { capturedProductEvents?: unknown[] }).capturedProductEvents = [];
    window.addEventListener("pdfmech:product-event", (event) => {
      (window as Window & { capturedProductEvents?: unknown[] }).capturedProductEvents?.push(
        (event as CustomEvent).detail,
      );
    });
  });

  await page.goto("/add-text-to-pdf");
  await expect(
    page.getByRole("heading", { name: "Add text to a PDF online for free." }),
  ).toBeVisible();
  await expect(page.getByTestId("site-add-text-to-pdf")).toContainText(
    "not sent to PDFMech for editing",
  );

  await page.getByTestId("add-text-file-input").setInputFiles({
    name: "add-text-reference.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });

  await expect(page).toHaveURL(/\/add-text-to-pdf$/);
  await expect(page.locator(".production-shell")).toHaveAttribute(
    "data-route-action",
    "add-text",
  );
  await expect(page.getByTestId("production-status")).toContainText(
    "Text tool ready",
    { timeout: 120_000 },
  );
  await expect(
    page.getByRole("navigation", { name: "PDF editing tools" }).getByRole("button", {
      name: "Text",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");

  await page
    .getByTestId("production-overlay-layer")
    .click({ position: { x: 120, y: 140 } });
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(1);
  await expect(page.getByTestId("production-status")).toContainText(
    "Added one text box",
  );
  await expect(page).toHaveURL(/\/add-text-to-pdf$/);

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("production-dock-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("add-text-reference-edited.pdf");
  await expect(page).toHaveURL(/\/add-text-to-pdf$/);

  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as Window & { capturedProductEvents?: Array<{ event?: string }> })
          .capturedProductEvents ?? [])
          .map((event) => event.event),
      ),
    )
    .toEqual(
      expect.arrayContaining([
        "pdfmech_tool_landing_view",
        "pdfmech_pdf_selected",
        "pdfmech_editor_loaded",
        "pdfmech_edit_action",
        "pdfmech_export_clicked",
        "pdfmech_export_success",
      ]),
    );
});

test("add-text route is mobile-safe before and after opening a PDF", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/add-text-to-pdf");

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  await page.getByTestId("add-text-file-input").setInputFiles(fixturePath);
  await expect(page.getByTestId("production-status")).toContainText(
    "Text tool ready",
    { timeout: 120_000 },
  );
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "PDF editing tools" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("add-text intent survives local recovery without changing routes", async ({ page }) => {
  await page.goto("/add-text-to-pdf");
  await page.getByTestId("add-text-file-input").setInputFiles({
    name: "recover-add-text.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Text tool ready",
    { timeout: 120_000 },
  );
  await page
    .getByTestId("production-overlay-layer")
    .click({ position: { x: 100, y: 110 } });
  await expect(page.getByTestId("production-recovery-status")).toContainText(
    "Autosaved locally",
    { timeout: 30_000 },
  );
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const recoveryStoreModulePath =
            "/src/infrastructure/persistence/indexeddb-recovery-store.ts";
          const { createIndexedDbRecoveryStore } = await import(
            recoveryStoreModulePath
          );
          return (await createIndexedDbRecoveryStore().listRecoverable())[0]
            ?.documentRevision;
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(1);

  await page.reload();
  await expect(page.getByTestId("site-add-text-to-pdf")).toBeVisible();
  await page.getByRole("button", { name: "Continue a locally saved document" }).click();
  await expect(page.getByTestId("production-restore-recent")).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId("production-restore-recent").click();

  await expect(page.getByTestId("production-status")).toContainText(
    "Text tool ready",
    { timeout: 120_000 },
  );
  await expect(page).toHaveURL(/\/add-text-to-pdf$/);
  await expect(
    page.getByRole("navigation", { name: "PDF editing tools" }).getByRole("button", {
      name: "Text",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(1);
});
