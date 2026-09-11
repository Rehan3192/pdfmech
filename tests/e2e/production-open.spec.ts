import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

test("production editor shows a first-time tutorial with skip controls", async ({
  page,
}) => {
  await page.goto("/editor");

  await expect(page.getByTestId("editor-tutorial")).toContainText(
    "Start with Open PDF",
  );
  await expect(page.getByTestId("editor-tutorial-position")).toHaveText(
    "Step 1 of 5",
  );

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("editor-tutorial")).toContainText(
    "change the font, size, color, bold style, and alignment",
  );

  await page.getByRole("button", { name: "Skip this step" }).click();
  await expect(page.getByTestId("editor-tutorial")).toContainText(
    "pick a cover color that blends",
  );

  await page.getByRole("button", { name: "Skip all steps" }).click();
  await expect(page.getByTestId("editor-tutorial")).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("editor-tutorial")).toBeHidden();
});

async function extractPageText(bytes: Uint8Array, pageNumber: number): Promise<string> {
  const task = getDocument({
    data: Uint8Array.from(bytes),
  });
  const document = await task.promise;
  try {
    const page = await document.getPage(pageNumber);
    try {
      const content = await page.getTextContent();
      return content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
    } finally {
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
}

test("production empty state opens a PDF by drag and drop", async ({ page }) => {
  await page.goto("/editor");
  await expect(page.getByTestId("production-empty")).toContainText(
    "No PDF selected",
  );
  await expect(page.getByTestId("production-empty")).toContainText(
    "Drop a PDF here",
  );
  await expect(page.getByTestId("production-empty")).toContainText(
    "Your PDF stays in this browser",
  );

  const fixtureBytes = await readFile(fixturePath);
  const dataTransfer = await page.evaluateHandle(
    ({ bytes }) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(bytes)], "dragged-local.pdf", {
          type: "application/pdf",
        }),
      );
      return transfer;
    },
    { bytes: [...fixtureBytes] },
  );

  await page
    .getByTestId("production-empty")
    .dispatchEvent("dragover", { dataTransfer });
  await expect(page.getByTestId("production-empty")).toHaveAttribute(
    "data-drag-active",
    "true",
  );
  await page
    .getByTestId("production-empty")
    .dispatchEvent("drop", { dataTransfer });

  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally at 100%.",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("4");
});

test("production viewer supports fit-width and fit-page zoom", async ({
  page,
}) => {
  await page.goto("/editor");
  await page.getByTestId("production-file-input").setInputFiles({
    name: "fit-controls.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally at 100%.",
    { timeout: 120_000 },
  );

  await page.getByTestId("production-fit-page").click();
  await expect(page.getByTestId("production-status")).toContainText(
    /Rendered page 1 locally at \d+%./,
    { timeout: 120_000 },
  );
  const fitPageSurface = await page
    .getByTestId("production-render-surface")
    .boundingBox();
  const renderPanel = await page.locator(".render-panel").boundingBox();
  expect(fitPageSurface).not.toBeNull();
  expect(renderPanel).not.toBeNull();
  expect(fitPageSurface!.width).toBeLessThanOrEqual(renderPanel!.width);
  expect(fitPageSurface!.height).toBeLessThanOrEqual(renderPanel!.height);

  await page.getByTestId("production-fit-width").click();
  await expect(page.getByTestId("production-status")).toContainText(
    /Rendered page 1 locally at \d+%./,
    { timeout: 120_000 },
  );
  const fitWidthSurface = await page
    .getByTestId("production-render-surface")
    .boundingBox();
  expect(fitWidthSurface).not.toBeNull();
  expect(fitWidthSurface!.width).toBeLessThanOrEqual(renderPanel!.width);
  expect(fitWidthSurface!.width).toBeGreaterThanOrEqual(
    fitPageSurface!.width,
  );
});

test("production app confirms before opening another PDF", async ({ page }) => {
  await page.goto("/editor");
  await page.getByTestId("production-file-input").setInputFiles({
    name: "first.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally at 100%.",
    { timeout: 120_000 },
  );

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Open another PDF?");
    expect(dialog.message()).toContain("first.pdf");
    await dialog.dismiss();
  });
  await page.getByTestId("production-file-input").setInputFiles({
    name: "second.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Kept current document open.",
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("4");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Open another PDF?");
    await dialog.accept();
  });
  await page.getByTestId("production-file-input").setInputFiles({
    name: "second.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally at 100%.",
    { timeout: 120_000 },
  );
});

test("production app confirms before clearing session and local recovery", async ({
  page,
}) => {
  await page.goto("/editor");
  await page.getByTestId("production-file-input").setInputFiles({
    name: "clear-session.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });
  await expect(page.getByTestId("production-recovery-status")).toContainText(
    "Autosaved locally",
    { timeout: 30_000 },
  );

  const savedRecoveryCount = await page.evaluate(async () => {
    const recoveryStoreModulePath =
      "/src/infrastructure/persistence/indexeddb-recovery-store.ts";
    const { createIndexedDbRecoveryStore } = await import(
      recoveryStoreModulePath
    );
    return (await createIndexedDbRecoveryStore().listRecoverable()).length;
  });
  expect(savedRecoveryCount).toBeGreaterThan(0);

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Clear this session?");
    expect(dialog.message()).toContain("clear-session.pdf");
    expect(dialog.message()).toContain("original PDF file is not changed");
    await dialog.dismiss();
  });
  await page.getByTestId("production-clear").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Kept current document open.",
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("4");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Clear this session?");
    await dialog.accept();
  });
  await page.getByTestId("production-clear").click();
  await expect(page.getByTestId("production-empty")).toContainText(
    "No PDF selected",
  );
  await expect(page.getByTestId("production-status")).toContainText(
    "Session cleared. The original PDF file was not changed.",
  );

  const recoveryCountAfterClear = await page.evaluate(async () => {
    const recoveryStoreModulePath =
      "/src/infrastructure/persistence/indexeddb-recovery-store.ts";
    const { createIndexedDbRecoveryStore } = await import(
      recoveryStoreModulePath
    );
    return (await createIndexedDbRecoveryStore().listRecoverable()).length;
  });
  expect(recoveryCountAfterClear).toBe(0);
});

test("production app opens a local PDF through the new vertical slice without leaking canaries", async ({
  page,
}) => {
  const requests: Array<{
    url: string;
    headers: Record<string, string>;
    body: string | null;
  }> = [];
  page.on("request", (request) => {
    requests.push({
      url: request.url(),
      headers: request.headers(),
      body: request.postData(),
    });
  });

  const response = await page.goto("/editor");
  expect(response).not.toBeNull();
  expect(await response!.headerValue("content-security-policy")).toContain(
    "object-src 'none'",
  );
  await expect(page.getByTestId("production-recovery-status")).toContainText(
    /Local recovery|local recovery checkpoint/,
  );
  await expect(page.getByTestId("production-limits-card")).toContainText(
    "100 MB",
  );
  await expect(page.getByTestId("production-limits-card")).toContainText(
    "500 pages",
  );

  await page.getByTestId("production-file-input").setInputFiles({
    name: "PRIVATE_FILENAME_CANARY.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(fixturePath),
  });

  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally at 100%.",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("4");
  await expect(page.getByTestId("production-recovery-status")).toContainText(
    "Autosaved locally",
    { timeout: 30_000 },
  );
  const savedSourceAfterOpen = await page.evaluate(async () => {
    const recoveryStoreModulePath =
      "/src/infrastructure/persistence/indexeddb-recovery-store.ts";
    const { createIndexedDbRecoveryStore } = await import(
      recoveryStoreModulePath
    );
    const summaries = await createIndexedDbRecoveryStore().listRecoverable();
    const checkpoint =
      summaries[0] === undefined
        ? null
        : await createIndexedDbRecoveryStore().load(summaries[0].documentId);
    const sourceId = checkpoint?.sourceManifest[0]?.sourceId;
    const source =
      sourceId === undefined
        ? null
        : await createIndexedDbRecoveryStore().loadSourceBlob(sourceId);

    return source === null
      ? null
      : {
          byteLength: source.byteLength,
          blobSize: source.blob.size,
          originalName: source.originalName,
        };
  });
  expect(savedSourceAfterOpen).toEqual({
    byteLength: 1709,
    blobSize: 1709,
    originalName: "PRIVATE_FILENAME_CANARY.pdf",
  });
  await expect(page.getByTestId("production-download")).toBeEnabled();
  await expect(page.getByTestId("production-undo")).toBeDisabled();
  await expect(page.getByTestId("production-redo")).toBeDisabled();
  await expect(page.getByTestId("production-page-position")).toHaveText(
    "Page 1 of 4",
  );
  await expect(page.getByTestId("production-page-list").locator("li")).toHaveCount(
    4,
  );
  await expect(page.getByTestId("production-page-canvas")).toBeVisible();
  const canvasStats = await page
    .getByTestId("production-page-canvas")
    .evaluate((canvasElement) => {
      const canvas = canvasElement as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (context === null) {
        throw new Error("Canvas context is unavailable.");
      }

      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonWhitePixels = 0;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const red = pixels[offset] ?? 255;
        const green = pixels[offset + 1] ?? 255;
        const blue = pixels[offset + 2] ?? 255;
        const alpha = pixels[offset + 3] ?? 0;
        if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) {
          nonWhitePixels += 1;
        }
      }

      return {
        width: canvas.width,
        height: canvas.height,
        nonWhitePixels,
      };
    });
  expect(canvasStats.width).toBeGreaterThan(0);
  expect(canvasStats.height).toBeGreaterThan(0);
  expect(canvasStats.nonWhitePixels).toBeGreaterThan(100);

  await expect(page.getByTestId("production-prev-page")).toBeDisabled();
  await page.getByTestId("production-next-page").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 100%.",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("production-page-position")).toHaveText(
    "Page 2 of 4",
  );
  await expect(
    page.getByTestId("production-page-list").locator("button").nth(1),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("production-move-page-earlier")).toBeEnabled();
  await expect(page.getByTestId("production-move-page-later")).toBeEnabled();
  await expect(page.getByTestId("production-rotate-page")).toBeEnabled();
  await expect(page.getByTestId("production-delete-page")).toBeEnabled();
  const pageTwoSize = await page
    .getByTestId("production-page-canvas")
    .evaluate((canvasElement) => {
      const canvas = canvasElement as HTMLCanvasElement;
      return { width: canvas.width, height: canvas.height };
    });
  await page.getByTestId("production-rotate-page").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 100%.",
    { timeout: 120_000 },
  );
  const rotatedPageTwoSize = await page
    .getByTestId("production-page-canvas")
    .evaluate((canvasElement) => {
      const canvas = canvasElement as HTMLCanvasElement;
      return { width: canvas.width, height: canvas.height };
    });
  expect(rotatedPageTwoSize.width).toBe(pageTwoSize.height);
  expect(rotatedPageTwoSize.height).toBe(pageTwoSize.width);
  await page.getByTestId("production-undo").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 100%.",
    { timeout: 120_000 },
  );
  const unrotatedPageTwoSize = await page
    .getByTestId("production-page-canvas")
    .evaluate((canvasElement) => {
      const canvas = canvasElement as HTMLCanvasElement;
      return { width: canvas.width, height: canvas.height };
    });
  expect(unrotatedPageTwoSize).toEqual(pageTwoSize);
  await page.getByTestId("production-redo").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 100%.",
    { timeout: 120_000 },
  );
  await page.getByTestId("production-undo").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 100%.",
    { timeout: 120_000 },
  );
  await page.getByTestId("production-move-page-earlier").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally at 100%.",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("production-page-position")).toHaveText(
    "Page 1 of 4",
  );
  await expect(page.getByTestId("production-move-page-earlier")).toBeDisabled();
  await page.getByTestId("production-undo").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 1 locally at 100%.",
    { timeout: 120_000 },
  );
  await page.getByTestId("production-next-page").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 100%.",
    { timeout: 120_000 },
  );
  await page.getByTestId("production-delete-page").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 100%.",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("3");
  await expect(page.getByTestId("production-page-position")).toHaveText(
    "Page 2 of 3",
  );
  await expect(page.getByTestId("production-page-list").locator("li")).toHaveCount(
    3,
  );
  await page.getByTestId("production-undo").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 100%.",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("production-page-count")).toHaveText("4");
  await expect(page.getByTestId("production-page-position")).toHaveText(
    "Page 2 of 4",
  );
  await page
    .getByTestId("production-overlay-layer")
    .click({ position: { x: 120, y: 140 } });
  await expect(page.getByTestId("production-status")).toContainText(
    "Created text object on page 2 at 120.0, 140.0 pt.",
  );
  await expect(page.getByTestId("production-selection-state")).toHaveText(
    "Object selected",
  );
  await expect(page.getByTestId("production-delete-object")).toBeEnabled();
  await expect(page.getByTestId("production-text-content")).toHaveValue("Text");
  await expect(page.getByTestId("production-apply-text")).toBeDisabled();
  await expect(page.getByTestId("production-undo")).toBeEnabled();
  await expect(page.getByTestId("production-redo")).toBeDisabled();
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
    .toBeGreaterThanOrEqual(1);
  await page.getByTestId("production-undo").click();
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(0);
  await expect(page.getByTestId("production-selection-state")).toHaveText(
    "No object selected",
  );
  await expect(page.getByTestId("production-undo")).toBeDisabled();
  await expect(page.getByTestId("production-redo")).toBeEnabled();
  await page.getByTestId("production-redo").click();
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(1);
  await expect(page.getByTestId("production-undo")).toBeEnabled();
  await expect(page.getByTestId("production-redo")).toBeDisabled();
  await page.getByTestId("production-overlay-text").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Selected text object.",
  );
  await page
    .getByTestId("production-text-content")
    .fill("PRIVATE_TEXT_CANARY \u041f\u0440\u0438\u0432\u0435\u0442, \u043c\u0438\u0440!");
  await expect(page.getByTestId("production-apply-text")).toBeEnabled();
  await page.getByTestId("production-apply-text").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Updated selected text object.",
  );
  await expect(page.getByTestId("production-overlay-text")).toContainText(
    "PRIVATE_TEXT_CANARY \u041f\u0440\u0438\u0432\u0435\u0442, \u043c\u0438\u0440!",
  );
  await page.getByTestId("production-undo").click();
  await expect(page.getByTestId("production-overlay-text")).toContainText("Text");
  await expect(page.getByTestId("production-redo")).toBeEnabled();
  await page.getByTestId("production-redo").click();
  await expect(page.getByTestId("production-overlay-text")).toContainText(
    "PRIVATE_TEXT_CANARY \u041f\u0440\u0438\u0432\u0435\u0442, \u043c\u0438\u0440!",
  );
  await expect(page.getByTestId("production-apply-text")).toBeDisabled();
  await expect(page.getByTestId("production-apply-appearance")).toBeDisabled();
  await page.getByTestId("production-text-font-family").selectOption("arial");
  await page.getByTestId("production-text-bold").check();
  await page.getByTestId("production-text-font-size").fill("2");
  await page.getByTestId("production-text-color").fill("#ff0033");
  await page.getByTestId("production-text-alignment").selectOption("center");
  await expect(page.getByTestId("production-apply-appearance")).toBeEnabled();
  await page.getByTestId("production-apply-appearance").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Updated selected text appearance.",
  );
  await expect(page.getByTestId("production-apply-appearance")).toBeDisabled();
  const styledOverlay = await page
    .getByTestId("production-overlay-text")
    .evaluate((element) => {
      const style = window.getComputedStyle(element as HTMLElement);
      return {
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: Number.parseFloat(style.fontSize),
        color: style.color,
        textAlign: style.textAlign,
        background: style.backgroundColor,
      };
    });
  expect(styledOverlay.fontFamily.toLowerCase()).toContain("arial");
  expect(Number(styledOverlay.fontWeight)).toBeGreaterThanOrEqual(700);
  expect(styledOverlay.fontSize).toBeCloseTo(2, 2);
  expect(styledOverlay.color).toBe("rgb(255, 0, 51)");
  expect(styledOverlay.textAlign).toBe("center");
  expect(styledOverlay.background).toBe("rgba(0, 0, 0, 0)");
  const overlayAt100 = await page
    .getByTestId("production-overlay-text")
    .evaluate((element) => {
      const htmlElement = element as HTMLElement;
      return {
        left: Number.parseFloat(htmlElement.style.left),
        top: Number.parseFloat(htmlElement.style.top),
        width: Number.parseFloat(htmlElement.style.width),
      };
    });
  await expect(page.getByTestId("production-duplicate-object")).toBeEnabled();
  await page.getByTestId("production-duplicate-object").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Duplicated selected object at 136.0, 156.0 pt.",
  );
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(2);
  const duplicatedOverlayAt100 = await page
    .getByTestId("production-overlay-text")
    .nth(1)
    .evaluate((element) => {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      return {
        text: htmlElement.textContent ?? "",
        selected: htmlElement.dataset.selected,
        left: Number.parseFloat(htmlElement.style.left),
        top: Number.parseFloat(htmlElement.style.top),
        width: Number.parseFloat(htmlElement.style.width),
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: Number.parseFloat(style.fontSize),
        color: style.color,
        textAlign: style.textAlign,
      };
    });
  expect(duplicatedOverlayAt100.text).toContain(
    "PRIVATE_TEXT_CANARY edited text",
  );
  expect(duplicatedOverlayAt100.selected).toBe("true");
  expect(duplicatedOverlayAt100.left).toBeCloseTo(overlayAt100.left + 16, 2);
  expect(duplicatedOverlayAt100.top).toBeCloseTo(overlayAt100.top + 16, 2);
  expect(duplicatedOverlayAt100.width).toBeCloseTo(overlayAt100.width, 2);
  expect(duplicatedOverlayAt100.fontFamily.toLowerCase()).toContain("arial");
  expect(Number(duplicatedOverlayAt100.fontWeight)).toBeGreaterThanOrEqual(700);
  expect(duplicatedOverlayAt100.fontSize).toBeCloseTo(2, 2);
  expect(duplicatedOverlayAt100.color).toBe("rgb(255, 0, 51)");
  expect(duplicatedOverlayAt100.textAlign).toBe("center");

  await page.getByTestId("production-zoom").selectOption("1.5");
  await expect(page.getByTestId("production-status")).toContainText(
    "Rendered page 2 locally at 150%.",
    { timeout: 120_000 },
  );
  const zoomedPageTwoSize = await page
    .getByTestId("production-page-canvas")
    .evaluate((canvasElement) => {
      const canvas = canvasElement as HTMLCanvasElement;
      return { width: canvas.width, height: canvas.height };
    });
  expect(zoomedPageTwoSize.width).toBeGreaterThan(pageTwoSize.width);
  expect(zoomedPageTwoSize.height).toBeGreaterThan(pageTwoSize.height);
  const overlayAt150 = await page
    .getByTestId("production-overlay-text")
    .nth(1)
    .evaluate((element) => {
      const htmlElement = element as HTMLElement;
      return {
        left: Number.parseFloat(htmlElement.style.left),
        top: Number.parseFloat(htmlElement.style.top),
        width: Number.parseFloat(htmlElement.style.width),
      };
    });
  expect(overlayAt150.left).toBeCloseTo(duplicatedOverlayAt100.left * 1.5, 2);
  expect(overlayAt150.top).toBeCloseTo(duplicatedOverlayAt100.top * 1.5, 2);
  expect(overlayAt150.width).toBeCloseTo(
    duplicatedOverlayAt100.width * 1.5,
    2,
  );
  await page.getByTestId("production-overlay-text").nth(1).click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Selected text object.",
  );
  const overlayBox = await page
    .getByTestId("production-overlay-text")
    .nth(1)
    .boundingBox();
  expect(overlayBox).not.toBeNull();
  await page.mouse.move(overlayBox!.x + 12, overlayBox!.y + 12);
  await page.mouse.down();
  await page.mouse.move(overlayBox!.x + 72, overlayBox!.y + 42);
  await page.mouse.up();
  await expect(page.getByTestId("production-status")).toContainText(
    "Moved text object to 176.0, 176.0 pt.",
  );
  const overlayAfterDrag = await page
    .getByTestId("production-overlay-text")
    .nth(1)
    .evaluate((element) => {
      const htmlElement = element as HTMLElement;
      return {
        left: Number.parseFloat(htmlElement.style.left),
        top: Number.parseFloat(htmlElement.style.top),
        width: Number.parseFloat(htmlElement.style.width),
        height: Number.parseFloat(htmlElement.style.height),
      };
    });
  expect(overlayAfterDrag.left).toBeCloseTo(overlayAt150.left + 60, 2);
  expect(overlayAfterDrag.top).toBeCloseTo(overlayAt150.top + 30, 2);
  const resizeHandleBox = await page
    .getByTestId("production-resize-handle")
    .boundingBox();
  expect(resizeHandleBox).not.toBeNull();
  await page.getByTestId("production-resize-handle").hover();
  const hoveredResizeHandleBox = await page
    .getByTestId("production-resize-handle")
    .boundingBox();
  expect(hoveredResizeHandleBox).not.toBeNull();
  const resizeHandleCenter = {
    x: hoveredResizeHandleBox!.x + hoveredResizeHandleBox!.width / 2,
    y: hoveredResizeHandleBox!.y + hoveredResizeHandleBox!.height / 2,
  };
  await page.mouse.down();
  await page.mouse.move(resizeHandleCenter.x + 60, resizeHandleCenter.y + 30);
  await page.mouse.up();
  await expect(page.getByTestId("production-status")).toContainText(
    "Resized text object to 220.0 x 48.0 pt.",
  );
  const overlayAfterResize = await page
    .getByTestId("production-overlay-text")
    .nth(1)
    .evaluate((element) => {
      const htmlElement = element as HTMLElement;
      return {
        left: Number.parseFloat(htmlElement.style.left),
        top: Number.parseFloat(htmlElement.style.top),
        width: Number.parseFloat(htmlElement.style.width),
        height: Number.parseFloat(htmlElement.style.height),
      };
    });
  expect(overlayAfterResize.left).toBeCloseTo(overlayAfterDrag.left, 2);
  expect(overlayAfterResize.top).toBeCloseTo(overlayAfterDrag.top, 2);
  expect(overlayAfterResize.width).toBeCloseTo(overlayAfterDrag.width + 60, 2);
  expect(overlayAfterResize.height).toBeCloseTo(overlayAfterDrag.height + 30, 1);
  await page.getByTestId("production-delete-object").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Deleted selected object.",
  );
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(1);
  await expect(page.getByTestId("production-overlay-whiteout")).toHaveCount(0);
  await expect(page.getByTestId("production-selection-state")).toHaveText(
    "No object selected",
  );
  await expect(page.getByTestId("production-delete-object")).toHaveCount(0);
  await expect(page.getByTestId("production-whiteout-warning")).toHaveCount(0);
  await page.getByTestId("production-creation-tool").selectOption("whiteout");
  await expect(page.getByTestId("production-whiteout-warning")).toContainText(
    "Whiteout visually covers content only. It is not secure redaction.",
  );
  await page
    .getByTestId("production-overlay-layer")
    .click({ position: { x: 300, y: 330 } });
  await expect(page.getByTestId("production-status")).toContainText(
    "Created whiteout object on page 2 at 200.0, 220.0 pt.",
  );
  await expect(page.getByTestId("production-selection-state")).toHaveText(
    "Object selected",
  );
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(1);
  await expect(page.getByTestId("production-overlay-whiteout")).toHaveCount(1);
  await expect(page.getByTestId("production-text-content")).toBeDisabled();
  const whiteoutAt150 = await page
    .getByTestId("production-overlay-whiteout")
    .evaluate((element) => {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      return {
        text: htmlElement.textContent ?? "",
        selected: htmlElement.dataset.selected,
        left: Number.parseFloat(htmlElement.style.left),
        top: Number.parseFloat(htmlElement.style.top),
        width: Number.parseFloat(htmlElement.style.width),
        height: Number.parseFloat(htmlElement.style.height),
        background: style.backgroundColor,
        borderColor: style.borderColor,
      };
    });
  expect(whiteoutAt150.text).toBe("");
  expect(whiteoutAt150.selected).toBe("true");
  expect(whiteoutAt150.left).toBeCloseTo(300, 2);
  expect(whiteoutAt150.top).toBeCloseTo(330, 2);
  expect(whiteoutAt150.width).toBeCloseTo(270, 2);
  expect(whiteoutAt150.height).toBeCloseTo(54, 2);
  expect(whiteoutAt150.background).toBe("rgb(255, 255, 255)");
  expect(whiteoutAt150.borderColor).toBe("rgba(0, 0, 0, 0)");
  await page.getByTestId("production-whiteout-color").fill("#f3efe4");
  await expect(page.getByTestId("production-status")).toContainText(
    "Updated selected whiteout color.",
  );
  const recoloredWhiteout = await page
    .getByTestId("production-overlay-whiteout")
    .evaluate((element) => {
      const style = window.getComputedStyle(element as HTMLElement);
      return {
        background: style.backgroundColor,
        borderColor: style.borderColor,
      };
    });
  expect(recoloredWhiteout.background).toBe("rgb(243, 239, 228)");
  expect(recoloredWhiteout.borderColor).toBe("rgba(0, 0, 0, 0)");
  const whiteoutBox = await page
    .getByTestId("production-overlay-whiteout")
    .boundingBox();
  expect(whiteoutBox).not.toBeNull();
  const whiteoutCenter = {
    x: whiteoutBox!.x + whiteoutBox!.width / 2,
    y: whiteoutBox!.y + whiteoutBox!.height / 2,
  };
  const overlayLayerBox = await page
    .getByTestId("production-overlay-layer")
    .boundingBox();
  expect(overlayLayerBox).not.toBeNull();
  await page.getByTestId("production-overlay-whiteout").dragTo(
    page.getByTestId("production-overlay-layer"),
    {
      sourcePosition: {
        x: whiteoutCenter.x - whiteoutBox!.x,
        y: whiteoutCenter.y - whiteoutBox!.y,
      },
      targetPosition: {
        x: whiteoutCenter.x - overlayLayerBox!.x + 60,
        y: whiteoutCenter.y - overlayLayerBox!.y + 30,
      },
    },
  );
  await expect(page.getByTestId("production-status")).toContainText(
    "Moved whiteout object",
  );
  const whiteoutAfterDrag = await page
    .getByTestId("production-overlay-whiteout")
    .evaluate((element) => {
      const htmlElement = element as HTMLElement;
      return {
        left: Number.parseFloat(htmlElement.style.left),
        top: Number.parseFloat(htmlElement.style.top),
        width: Number.parseFloat(htmlElement.style.width),
        height: Number.parseFloat(htmlElement.style.height),
      };
    });
  expect(whiteoutAfterDrag.left).toBeGreaterThan(whiteoutAt150.left + 50);
  expect(whiteoutAfterDrag.top).toBeGreaterThan(whiteoutAt150.top + 20);
  await page.getByTestId("production-resize-handle").scrollIntoViewIfNeeded();
  const whiteoutResizeHandleBox = await page
    .getByTestId("production-resize-handle")
    .boundingBox();
  expect(whiteoutResizeHandleBox).not.toBeNull();
  await page.getByTestId("production-resize-handle").hover();
  const hoveredWhiteoutResizeHandleBox = await page
    .getByTestId("production-resize-handle")
    .boundingBox();
  expect(hoveredWhiteoutResizeHandleBox).not.toBeNull();
  const whiteoutResizeHandleCenter = {
    x:
      hoveredWhiteoutResizeHandleBox!.x +
      hoveredWhiteoutResizeHandleBox!.width / 2,
    y:
      hoveredWhiteoutResizeHandleBox!.y +
      hoveredWhiteoutResizeHandleBox!.height / 2,
  };
  await page.mouse.down();
  await page.mouse.move(
    whiteoutResizeHandleCenter.x + 60,
    whiteoutResizeHandleCenter.y + 30,
  );
  await page.mouse.up();
  await expect(page.getByTestId("production-status")).toContainText(
    "Resized whiteout object to 220.0 x 56.0 pt.",
  );
  const whiteoutAfterResize = await page
    .getByTestId("production-overlay-whiteout")
    .evaluate((element) => {
      const htmlElement = element as HTMLElement;
      return {
        width: Number.parseFloat(htmlElement.style.width),
        height: Number.parseFloat(htmlElement.style.height),
      };
    });
  expect(whiteoutAfterResize.width).toBeCloseTo(
    whiteoutAfterDrag.width + 60,
    2,
  );
  expect(whiteoutAfterResize.height).toBeCloseTo(
    whiteoutAfterDrag.height + 30,
    1,
  );
  await page.getByTestId("production-delete-object").click();
  await expect(page.getByTestId("production-status")).toContainText(
    "Deleted selected object.",
  );
  await expect(page.getByTestId("production-overlay-text")).toHaveCount(1);
  await expect(page.getByTestId("production-overlay-whiteout")).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("production-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "PRIVATE_FILENAME_CANARY-edited.pdf",
  );
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const downloadedBytes = await readFile(downloadedPath!);
  expect(downloadedBytes.byteLength).toBeGreaterThan(0);
  const downloadedPageTwoText = await extractPageText(
    new Uint8Array(downloadedBytes),
    2,
  );
  expect(downloadedPageTwoText.replace(/\s+/g, " ")).toContain(
    "PRIVATE_TEXT_CANARY \u041f\u0440\u0438\u0432\u0435\u0442, \u043c\u0438\u0440!",
  );
  await expect(page.getByTestId("production-status")).toContainText(
    "Download ready locally as PRIVATE_FILENAME_CANARY-edited.pdf",
  );

  const serializedRequests = JSON.stringify(requests);
  expect(serializedRequests).not.toContain("PRIVATE_FILENAME_CANARY");
  expect(serializedRequests).not.toContain("PRIVATE_TEXT_CANARY");
  expect(serializedRequests).not.toContain("ff0033");
  expect(requests.filter((request) => request.body !== null)).toEqual([]);
});

test("production app explains malformed PDFs with safe actionable copy", async ({
  page,
}) => {
  await page.goto("/editor");
  await page.getByTestId("production-file-input").setInputFiles(
    join(process.cwd(), "tests", "fixtures", "malformed.pdf"),
  );

  await expect(page.getByTestId("production-status")).toHaveAttribute(
    "data-kind",
    "error",
  );
  await expect(page.getByTestId("production-status")).toContainText(
    "damaged or malformed",
  );
  await expect(page.getByTestId("production-download")).toBeDisabled();
});
