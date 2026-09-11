import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("production editor stays usable on a phone-sized touch viewport", async ({
  page,
}) => {
  await page.goto("/editor");
  await expect(page.getByTestId("production-empty")).toContainText(
    "Drop a PDF here",
  );

  await page.getByTestId("production-file-input").setInputFiles({
    name: "mobile-touch.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally at 100%.",
    { timeout: 120_000 },
  );

  await page.getByTestId("production-fit-page").tap();
  await expect(page.getByTestId("production-status")).toContainText(
    /Rendered page 1 locally at \d+%./,
    { timeout: 120_000 },
  );
  const renderPanel = await page.locator(".render-panel").boundingBox();
  const renderSurface = await page
    .getByTestId("production-render-surface")
    .boundingBox();
  expect(renderPanel).not.toBeNull();
  expect(renderSurface).not.toBeNull();
  expect(renderSurface!.width).toBeLessThanOrEqual(renderPanel!.width);
  expect(renderSurface!.height).toBeLessThanOrEqual(renderPanel!.height);

  await page
    .getByTestId("production-overlay-layer")
    .tap({ position: { x: 70, y: 90 } });
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(1);
  await expect(page.getByTestId("production-selection-state")).toHaveText(
    "Object selected",
  );

  const overlayBox = await page
    .getByTestId("production-overlay-text")
    .boundingBox();
  const resizeHandleBox = await page
    .getByTestId("production-resize-handle")
    .boundingBox();
  expect(overlayBox).not.toBeNull();
  expect(resizeHandleBox).not.toBeNull();
  expect(overlayBox!.width).toBeGreaterThanOrEqual(44);
  expect(overlayBox!.height).toBeGreaterThanOrEqual(44);
  expect(resizeHandleBox!.width).toBeGreaterThanOrEqual(34);
  expect(resizeHandleBox!.height).toBeGreaterThanOrEqual(34);

  const overlayCenter = {
    x: overlayBox!.x + overlayBox!.width / 2,
    y: overlayBox!.y + overlayBox!.height / 2,
  };
  const layerBox = await page.getByTestId("production-overlay-layer").boundingBox();
  expect(layerBox).not.toBeNull();
  await page.getByTestId("production-overlay-text").dragTo(
    page.getByTestId("production-overlay-layer"),
    {
      sourcePosition: {
        x: overlayCenter.x - overlayBox!.x,
        y: overlayCenter.y - overlayBox!.y,
      },
      targetPosition: {
        x: overlayCenter.x - layerBox!.x + 32,
        y: overlayCenter.y - layerBox!.y + 24,
      },
    },
  );
  await expect(page.getByTestId("production-status")).toContainText(
    "Moved text object",
  );
});
