import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

test("production editor supports keyboard shortcuts without hijacking text inputs", async ({
  page,
}) => {
  await page.goto("/editor");
  await page.getByTestId("production-file-input").setInputFiles({
    name: "PRIVATE_SHORTCUT_CANARY.pdf",
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
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(1);
  await expect(page.getByTestId("production-selection-state")).toHaveText(
    "Object selected",
  );

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("production-selection-state")).toHaveText(
    "No object selected",
  );
  await expect(page.getByTestId("production-delete-object")).toHaveCount(0);

  await page.getByTestId("production-overlay-text").click();
  await expect(page.getByTestId("production-delete-object")).toBeEnabled();
  await page.getByTestId("production-text-content").fill("Shortcut text");
  await page.keyboard.press("Backspace");
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(1);
  await expect(page.getByTestId("production-text-content")).toHaveValue(
    "Shortcut tex",
  );

  await page.getByTestId("production-text-content").blur();
  await page.getByTestId("production-overlay-text").click();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(0);

  await page.keyboard.press("Control+Z");
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(1);

  await page.keyboard.press("Control+Shift+Z");
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.keyboard.press("Control+S");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("PRIVATE_SHORTCUT_CANARY-edited.pdf");
});
