import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { cpus, freemem, platform, release, totalmem } from "node:os";
import { performance as nodePerformance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const fixture = (...parts: string[]): string =>
  join(process.cwd(), "tests", "fixtures", ...parts);

async function addTextAndDownload(
  page: import("@playwright/test").Page,
  path: string,
): Promise<Buffer> {
  await page.goto("/spike.html");
  await page.getByTestId("file-input").setInputFiles(path);
  await expect(page.getByTestId("status")).toContainText(/opened .* locally/i, {
    timeout: 120_000,
  });
  await page.getByTestId("overlay").click({ position: { x: 120, y: 140 } });
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download").click();
  const download = await downloadPromise;
  await expect(page.getByTestId("status")).toContainText(/validated/i, {
    timeout: 120_000,
  });
  const pathOnDisk = await download.path();
  if (pathOnDisk === null) {
    throw new Error("Playwright did not expose the downloaded PDF path.");
  }
  return readFile(pathOnDisk);
}

async function whitePixelBounds(
  page: import("@playwright/test").Page,
): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  return page.locator("canvas").evaluate((canvasElement) => {
    const canvas = canvasElement as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("Canvas 2D context is unavailable.");
    }
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const red = pixels.data[offset] ?? 0;
        const green = pixels.data[offset + 1] ?? 0;
        const blue = pixels.data[offset + 2] ?? 0;
        if (red >= 250 && green >= 250 && blue >= 250) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0 || maxY < 0) {
      throw new Error("No white pixels found.");
    }
    const cssScale = canvas.width / canvas.getBoundingClientRect().width;
    return {
      x: minX / cssScale,
      y: minY / cssScale,
      width: (maxX - minX + 1) / cssScale,
      height: (maxY - minY + 1) / cssScale,
    };
  });
}

async function qpdfCheck(
  bytes: Buffer,
  temporaryPath: string,
): Promise<void> {
  const qpdf = process.env.QPDF_BIN;
  if (!qpdf) {
    throw new Error("QPDF_BIN is required for corpus browser tests.");
  }
  await writeFile(temporaryPath, bytes);
  const check = spawnSync(qpdf, ["--check", temporaryPath], {
    encoding: "utf8",
    timeout: 120_000,
  });
  expect(
    check.status,
    `QPDF output:\n${check.stdout}\n${check.stderr}`,
  ).toBe(0);
}

test("preserves supported forms and metadata while exporting an overlay", async ({
  page,
}, testInfo) => {
  const downloadedBytes = await addTextAndDownload(
    page,
    fixture("features.pdf"),
  );
  const parsed = await PDFDocument.load(downloadedBytes);
  expect(parsed.getTitle()).toBe("Feature preservation fixture");
  expect(parsed.getAuthor()).toBe("Purpose-built test fixture");
  expect(parsed.getSubject()).toBe(
    "AcroForm, metadata, attachment, and annotation coverage",
  );
  const form = parsed.getForm();
  expect(form.getTextField("profile.name").getText()).toBe("Original Name");
  expect(form.getCheckBox("profile.consent").isChecked()).toBe(true);
  expect(form.getDropdown("profile.role").getSelected()).toEqual([
    "Freelancer",
  ]);
  const exportedPath = testInfo.outputPath("features-exported.pdf");
  await qpdfCheck(downloadedBytes, exportedPath);
  const qpdf = process.env.QPDF_BIN;
  if (!qpdf) {
    throw new Error("QPDF_BIN is required.");
  }
  const attachments = spawnSync(qpdf, ["--list-attachments", exportedPath], {
    encoding: "utf8",
  });
  expect(attachments.status).toBe(0);
  expect(attachments.stdout).toContain("fixture.txt");
});

test("rejects encrypted and over-page-limit documents explicitly", async ({
  page,
}) => {
  await page.goto("/spike.html");
  await page
    .getByTestId("file-input")
    .setInputFiles(fixture("generated", "encrypted-aes256.pdf"));
  await expect(page.getByTestId("status")).toContainText(
    /password-protected PDFs are not supported/i,
  );
  await expect(page.getByTestId("download")).toBeDisabled();

  await page
    .getByTestId("file-input")
    .setInputFiles(fixture("generated", "page-boundary-501.pdf"));
  await expect(page.getByTestId("status")).toContainText(
    /more than 500 pages/i,
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("download")).toBeDisabled();
});

test("blocks signed and XFA documents with specific safety messages", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/spike.html");
  await page
    .getByTestId("file-input")
    .setInputFiles(fixture("external", "signed-node-signpdf.pdf"));
  await expect(page.getByTestId("status")).toContainText(
    /digitally signed PDFs are blocked/i,
  );
  await expect(page.getByTestId("download")).toBeDisabled();

  await page
    .getByTestId("file-input")
    .setInputFiles(fixture("external", "xfa-pdfjs.pdf"));
  await expect(page.getByTestId("status")).toContainText(
    /XFA forms are not supported/i,
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("download")).toBeDisabled();
});

test("exports whiteout placement within one point on unrotated and rotated pages", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const expectWithinOnePoint = (actual: number, expected: number): void => {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
  };
  await page.goto("/spike.html");
  await page
    .getByTestId("file-input")
    .setInputFiles(fixture("coordinate-gray.pdf"));
  await expect(page.getByTestId("status")).toContainText(/opened 2 pages/i, {
    timeout: 30_000,
  });
  await page.getByTestId("whiteout-tool").click();
  await page
    .getByTestId("overlay")
    .click({ position: { x: 80, y: 90 } });

  const pageButtons = page
    .getByRole("navigation", { name: "PDF pages" })
    .getByRole("button");
  await pageButtons.nth(1).click();
  await expect(page.getByTestId("status")).toContainText(
    /page 2 rendered locally/i,
  );
  await page
    .getByTestId("overlay")
    .click({ position: { x: 100, y: 110 } });

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download").click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (downloadedPath === null) {
    throw new Error("Downloaded coordinate fixture is unavailable.");
  }

  await page.getByTestId("file-input").setInputFiles(downloadedPath);
  await expect(page.getByTestId("status")).toContainText(/opened 2 pages/i, {
    timeout: 30_000,
  });
  const firstBounds = await whitePixelBounds(page);
  expectWithinOnePoint(firstBounds.x, 80);
  expectWithinOnePoint(firstBounds.y, 90);
  expectWithinOnePoint(firstBounds.width, 150);
  expectWithinOnePoint(firstBounds.height, 28);

  const outputPageButtons = page
    .getByRole("navigation", { name: "PDF pages" })
    .getByRole("button");
  await outputPageButtons.nth(1).click();
  await expect(page.getByTestId("status")).toContainText(
    /page 2 rendered locally/i,
  );
  const secondBounds = await whitePixelBounds(page);
  expectWithinOnePoint(secondBounds.x, 100);
  expectWithinOnePoint(secondBounds.y, 110);
  expectWithinOnePoint(secondBounds.width, 150);
  expectWithinOnePoint(secondBounds.height, 28);
});

test("rejects unsafe page dimensions and files over 100 MB before editing", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Boundary allocation test runs once.");
  test.setTimeout(180_000);
  await page.goto("/spike.html");
  await page
    .getByTestId("file-input")
    .setInputFiles(fixture("generated", "oversized-page.pdf"));
  await expect(page.getByTestId("status")).toContainText(
    /dimensions exceed the safe rendering limit/i,
  );
  await expect(page.getByTestId("download")).toBeDisabled();

  await page
    .getByTestId("file-input")
    .setInputFiles(fixture("generated", "over-100mb.pdf"));
  await expect(page.getByTestId("status")).toContainText(
    /larger than 100 MB/i,
  );
  await expect(page.getByTestId("download")).toBeDisabled();
});

test("exports a linearized input as structurally valid while recording linearization loss", async ({
  page,
}, testInfo) => {
  const downloadedBytes = await addTextAndDownload(
    page,
    fixture("generated", "linearized.pdf"),
  );
  const outputPath = testInfo.outputPath("linearized-exported.pdf");
  await qpdfCheck(downloadedBytes, outputPath);
  const qpdf = process.env.QPDF_BIN;
  if (!qpdf) {
    throw new Error("QPDF_BIN is required.");
  }
  const check = spawnSync(qpdf, ["--check-linearization", outputPath], {
    encoding: "utf8",
  });
  expect(`${check.stdout}\n${check.stderr}`).toContain("is not linearized");
});

test("measures medium and large local workflows", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== "chromium", "Performance evidence uses one engine.");
  test.setTimeout(300_000);

  const measurements = [];
  for (const item of [
    { name: "performance-25p-20m.pdf", pages: 25 },
    { name: "performance-100p-50m.pdf", pages: 100 },
  ]) {
    await page.goto("/spike.html");
    const startedOpen = nodePerformance.now();
    await page
      .getByTestId("file-input")
      .setInputFiles(fixture("generated", item.name));
    await expect(page.getByTestId("status")).toContainText(
      new RegExp(`Opened ${item.pages} pages locally`, "i"),
      { timeout: 180_000 },
    );
    const openMilliseconds = nodePerformance.now() - startedOpen;
    await page.getByTestId("overlay").click({ position: { x: 120, y: 140 } });

    const startedExport = nodePerformance.now();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("download").click();
    await downloadPromise;
    await expect(page.getByTestId("status")).toContainText(/validated/i, {
      timeout: 180_000,
    });
    const exportMilliseconds = nodePerformance.now() - startedExport;

    const heap = await page.evaluate(() => {
      const memory = (
        window.performance as Performance & {
          memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
        }
      ).memory;
      return memory
        ? {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
          }
        : null;
    });
    const bytes = (await readFile(fixture("generated", item.name))).byteLength;
    measurements.push({
      name: item.name,
      bytes,
      pages: item.pages,
      openMilliseconds: Math.round(openMilliseconds),
      exportAndValidationMilliseconds: Math.round(exportMilliseconds),
      mainRealmHeap: heap,
    });
  }

  const evidenceDirectory = join(process.cwd(), "tests", "evidence");
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    join(evidenceDirectory, "performance-latest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        caveat:
          "Playwright elapsed time and Chromium main-realm heap do not include every worker/native allocation.",
        environment: {
          platform: platform(),
          release: release(),
          cpuModel: cpus()[0]?.model ?? "unknown",
          logicalCpuCount: cpus().length,
          totalMemoryBytes: totalmem(),
          freeMemoryBytesAtReport: freemem(),
        },
        measurements,
      },
      null,
      2,
    )}\n`,
  );
  expect(measurements).toHaveLength(2);
  await testInfo.attach("performance-evidence", {
    body: JSON.stringify(measurements, null, 2),
    contentType: "application/json",
  });
});
