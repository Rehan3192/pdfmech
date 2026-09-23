import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

test("rotate-pages landing opens the real editor with rotation ready", async ({
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

  await page.goto("/rotate-pdf-pages");
  await expect(
    page.getByRole("heading", { name: "Rotate PDF pages online for free." }),
  ).toBeVisible();
  await expect(page.getByTestId("site-rotate-pdf-pages")).toContainText(
    "processed locally in this browser",
  );

  await page.getByTestId("rotate-pages-file-input").setInputFiles({
    name: "rotate-pages-reference.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });

  await expect(page).toHaveURL(/\/rotate-pdf-pages$/);
  const editor = page.locator(".production-shell");
  await expect(editor).toHaveAttribute("data-route-mode", "pages");
  await expect(editor).toHaveAttribute("data-route-action", "rotate");
  await expect(editor).toHaveAttribute("data-pages-open", "true", {
    timeout: 120_000,
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Page rotation ready",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("4");
  await expect(page.getByTestId("production-page-list")).toBeVisible();

  await page.getByTestId("production-page-list").getByRole("button", {
    name: /Page 2/,
  }).click();
  await page.getByTestId("production-page-strip-rotate").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rotated page 2 clockwise",
  );
  await expect(page.getByTestId("production-page-strip-undo")).toBeEnabled();

  await page.getByTestId("production-page-strip-rotate").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rotated page 2 clockwise",
  );
  await page.getByTestId("production-page-strip-undo").click();
  await page
    .locator(".page-strip")
    .getByRole("button", { name: "Hide page thumbnails" })
    .click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("production-dock-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("rotate-pages-reference-edited.pdf");

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

test("rotate-pages route is mobile-safe and exposes page rotation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/rotate-pdf-pages");

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  await page.getByTestId("rotate-pages-file-input").setInputFiles(fixturePath);
  await expect(page.getByTestId("production-status")).toContainText(
    "Page rotation ready",
    { timeout: 120_000 },
  );
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.getByTestId("production-page-list")).toBeVisible();
  await expect(page.getByTestId("production-page-strip-rotate")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("rotate-pages intent and edit survive local recovery", async ({ page }) => {
  await page.goto("/rotate-pdf-pages");
  await page.getByTestId("rotate-pages-file-input").setInputFiles({
    name: "recover-rotate-pages.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Page rotation ready",
    { timeout: 120_000 },
  );
  await page.getByTestId("production-page-strip-rotate").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rotated page 1 clockwise",
  );
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
  await expect(page.getByTestId("site-rotate-pdf-pages")).toBeVisible();
  await page.getByRole("button", { name: "Continue a locally saved document" }).click();
  await expect(page.getByTestId("production-restore-recent")).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId("production-restore-recent").click();

  await expect(page.getByTestId("production-status")).toContainText(
    "Page rotation ready",
    { timeout: 120_000 },
  );
  await expect(page).toHaveURL(/\/rotate-pdf-pages$/);
  await expect(page.locator(".production-shell")).toHaveAttribute(
    "data-pages-open",
    "true",
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("4");
});
