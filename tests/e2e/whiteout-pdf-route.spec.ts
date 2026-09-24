import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

test("whiteout landing opens the real editor with the visual cover tool ready", async ({
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

  await page.goto("/whiteout-pdf");
  await expect(
    page.getByRole("heading", { name: "White out PDF content online for free." }),
  ).toBeVisible();
  await expect(page.getByTestId("site-whiteout-pdf")).toContainText(
    "Visual whiteout is not secure redaction",
  );

  await page.getByTestId("whiteout-pdf-file-input").setInputFiles({
    name: "whiteout-reference.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });

  await expect(page).toHaveURL(/\/whiteout-pdf$/);
  const editor = page.locator(".production-shell");
  await expect(editor).toHaveAttribute("data-route-mode", "whiteout");
  await expect(editor).toHaveAttribute("data-route-action", "draw");
  await expect(page.getByTestId("production-status")).toContainText(
    "Whiteout tool ready",
    { timeout: 120_000 },
  );
  await expect(
    page.locator(".mobile-editor-dock").getByRole("button", { name: "Whiteout" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page
    .getByTestId("production-overlay-layer")
    .click({ position: { x: 180, y: 220 } });
  await expect(page.getByTestId("production-overlay-whiteout")).toHaveCount(1);
  await expect(page.getByTestId("production-status")).toContainText(
    "Created one whiteout object on page 1",
  );
  await page.getByTestId("production-overlay-whiteout").click();
  await expect(page.getByTestId("production-whiteout-color")).toBeVisible();
  await page.getByTestId("production-whiteout-color").fill("#f3efe4");
  await expect(page.getByTestId("production-status")).toContainText(
    "Updated selected whiteout color",
  );
  await page.getByRole("button", { name: "Hide properties" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("production-dock-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("whiteout-reference-edited.pdf");

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

test("whiteout route is mobile-safe and opens contextual properties", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/whiteout-pdf");

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  await page.getByTestId("whiteout-pdf-file-input").setInputFiles(fixturePath);
  await expect(page.getByTestId("production-status")).toContainText(
    "Whiteout tool ready",
    { timeout: 120_000 },
  );
  await page
    .getByTestId("production-overlay-layer")
    .click({ position: { x: 100, y: 140 } });
  await expect(page.getByTestId("production-overlay-whiteout")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Whiteout Properties" })).toBeVisible();
  await expect(page.getByTestId("production-whiteout-color")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("whiteout route intent and edit survive local recovery", async ({ page }) => {
  await page.goto("/whiteout-pdf");
  await page.getByTestId("whiteout-pdf-file-input").setInputFiles({
    name: "recover-whiteout.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Whiteout tool ready",
    { timeout: 120_000 },
  );
  await page
    .getByTestId("production-overlay-layer")
    .click({ position: { x: 180, y: 220 } });
  await expect(page.getByTestId("production-overlay-whiteout")).toHaveCount(1);
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
  await expect(page.getByTestId("site-whiteout-pdf")).toBeVisible();
  await page.getByRole("button", { name: "Continue a locally saved document" }).click();
  await expect(page.getByTestId("production-restore-recent")).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId("production-restore-recent").click();

  await expect(page.getByTestId("production-status")).toContainText(
    "Whiteout tool ready",
    { timeout: 120_000 },
  );
  await expect(page).toHaveURL(/\/whiteout-pdf$/);
  await expect(page.locator(".production-shell")).toHaveAttribute(
    "data-route-mode",
    "whiteout",
  );
  await expect(page.getByTestId("production-overlay-whiteout")).toHaveCount(1);
});
