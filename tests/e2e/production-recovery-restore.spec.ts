import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

test("production app restores a locally autosaved PDF and edit checkpoint", async ({
  page,
}) => {
  await page.goto("/editor");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("privacy-pdf-editor-recovery");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      request.onblocked = () =>
        reject(new Error("Recovery database deletion was blocked."));
    });
  });
  await page.reload();

  await page.getByTestId("production-file-input").setInputFiles({
    name: "PRIVATE_RESTORE_CANARY.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });

  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally at 100%.",
    { timeout: 120_000 },
  );
  await page.getByTestId("production-next-page").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 100%.",
    { timeout: 120_000 },
  );
  await page
    .getByTestId("production-overlay-layer")
    .click({ position: { x: 120, y: 140 } });
  await page
    .getByTestId("production-text-content")
    .fill("PRIVATE_RESTORE_TEXT_CANARY");
  await page.getByTestId("production-apply-text").click();
  await expect(page.getByTestId("production-overlay-text")).toContainText(
    "PRIVATE_RESTORE_TEXT_CANARY",
  );
  await expect(page.getByTestId("production-recovery-status")).toContainText(
    "Autosaved locally",
    { timeout: 30_000 },
  );
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const recoveryStoreModulePath =
            "/src/infrastructure/persistence/indexeddb-recovery-store.ts";
          const { createIndexedDbRecoveryStore } = await import(
            recoveryStoreModulePath
          );
          const summaries =
            await createIndexedDbRecoveryStore().listRecoverable();
          return summaries[0]?.documentRevision ?? null;
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(2);

  await page.reload();
  await expect(page.getByTestId("production-recovery-status")).toContainText(
    "1 restorable local document found.",
    { timeout: 30_000 },
  );
  await expect(page.getByTestId("production-restore-recovery")).toBeEnabled();

  await page.getByTestId("production-restore-recovery").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally at 100%.",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("4");
  await page.getByTestId("production-next-page").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 100%.",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("production-overlay-text")).toContainText(
    "PRIVATE_RESTORE_TEXT_CANARY",
  );

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("production-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("PRIVATE_RESTORE_CANARY-edited.pdf");
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  expect((await readFile(downloadedPath!)).byteLength).toBeGreaterThan(0);
});
