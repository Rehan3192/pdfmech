import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

test("reorder-pages landing opens the real editor with page movement ready", async ({
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

  await page.goto("/reorder-pdf-pages");
  await expect(
    page.getByRole("heading", { name: "Reorder PDF pages online for free." }),
  ).toBeVisible();
  await expect(page.getByTestId("site-reorder-pdf-pages")).toContainText(
    "processed locally in this browser",
  );

  await page.getByTestId("reorder-pages-file-input").setInputFiles({
    name: "reorder-pages-reference.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });

  await expect(page).toHaveURL(/\/reorder-pdf-pages$/);
  const editor = page.locator(".production-shell");
  await expect(editor).toHaveAttribute("data-route-mode", "pages");
  await expect(editor).toHaveAttribute("data-route-action", "reorder");
  await expect(editor).toHaveAttribute("data-pages-open", "true", {
    timeout: 120_000,
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Page reordering ready",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("4");
  await expect(page.getByTestId("production-page-list")).toBeVisible();

  await page.getByTestId("production-page-list").getByRole("button", {
    name: /Page 2/,
  }).click();
  await page.getByTestId("production-move-page-up").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Moved selected page earlier to position 1",
  );
  await expect(page.getByTestId("production-move-page-up")).toBeDisabled();
  await expect(page.getByTestId("production-move-page-down")).toBeEnabled();

  await page.getByTestId("production-move-page-down").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Moved selected page later to position 2",
  );
  await expect(page.getByTestId("production-page-strip-undo")).toBeEnabled();
  await page.getByTestId("production-page-strip-undo").click();
  await page
    .locator(".page-strip")
    .getByRole("button", { name: "Hide page thumbnails" })
    .click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("production-dock-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("reorder-pages-reference-edited.pdf");

  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as Window & { capturedProductEvents?: Array<{ event?: string }> })
          .capturedProductEvents ?? []).map((event) => event.event),
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

test("reorder-pages route is mobile-safe and exposes page movement controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/reorder-pdf-pages");

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  await page.getByTestId("reorder-pages-file-input").setInputFiles(fixturePath);
  await expect(page.getByTestId("production-status")).toContainText(
    "Page reordering ready",
    { timeout: 120_000 },
  );
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.getByTestId("production-page-list")).toBeVisible();
  await expect(page.getByTestId("production-move-page-up")).toBeVisible();
  await expect(page.getByTestId("production-move-page-down")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("reorder-pages intent and edits survive local recovery", async ({ page }) => {
  await page.goto("/reorder-pdf-pages");
  await page.getByTestId("reorder-pages-file-input").setInputFiles({
    name: "recover-reorder-pages.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Page reordering ready",
    { timeout: 120_000 },
  );
  await page.getByTestId("production-page-list").getByRole("button", {
    name: /Page 2/,
  }).click();
  await page.getByTestId("production-move-page-up").click();
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
  await expect(page.getByTestId("site-reorder-pdf-pages")).toBeVisible();
  await page.getByRole("button", { name: "Continue a locally saved document" }).click();
  await expect(page.getByTestId("production-restore-recent")).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId("production-restore-recent").click();

  await expect(page.getByTestId("production-status")).toContainText(
    "Page reordering ready",
    { timeout: 120_000 },
  );
  await expect(page).toHaveURL(/\/reorder-pdf-pages$/);
  await expect(page.locator(".production-shell")).toHaveAttribute(
    "data-pages-open",
    "true",
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("4");
});
