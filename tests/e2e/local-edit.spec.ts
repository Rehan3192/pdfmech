import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const fixturePath = join(
  process.cwd(),
  "tests",
  "fixtures",
  "representative.pdf",
);

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

test("opens, edits, zooms, validates, and downloads without leaking canaries", async ({
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

  const response = await page.goto("/spike.html");
  expect(response).not.toBeNull();
  const csp = await response!.headerValue("content-security-policy");
  expect(csp).toContain("worker-src 'self'");
  expect(csp).toContain("object-src 'none'");
  const fixture = await readFile(fixturePath);
  const originalDigest = sha256(fixture);
  await page.getByTestId("file-input").setInputFiles({
    name: "PRIVATE_FILENAME_CANARY.pdf",
    mimeType: "application/pdf",
    buffer: fixture,
  });

  await expect(page.getByTestId("page")).toBeVisible({ timeout: 120_000 });

  await page.getByTestId("text-value").fill("PRIVATE_TEXT_CANARY");
  const overlay = page.getByTestId("overlay");
  await overlay.click({ position: { x: 120, y: 130 } });
  const textEdit = page.getByTestId("edit-text");
  await expect(textEdit).toHaveCount(1);

  const before = await textEdit.evaluate((element) => ({
    left: Number.parseFloat((element as HTMLElement).style.left),
    top: Number.parseFloat((element as HTMLElement).style.top),
  }));
  await page.getByTestId("zoom").selectOption("1.5");
  await expect(page.getByTestId("status")).toContainText("150%");
  const after = await page.getByTestId("edit-text").evaluate((element) => ({
    left: Number.parseFloat((element as HTMLElement).style.left),
    top: Number.parseFloat((element as HTMLElement).style.top),
  }));
  // CSS serialization may round to one-thousandth of a pixel. This remains
  // many orders of magnitude tighter than the product's one-PDF-point limit.
  expect(after.left).toBeCloseTo(before.left * 1.5, 2);
  expect(after.top).toBeCloseTo(before.top * 1.5, 2);

  const textBounds = await page.getByTestId("edit-text").boundingBox();
  expect(textBounds).not.toBeNull();
  await page.mouse.move(textBounds!.x + 8, textBounds!.y + 8);
  await page.mouse.down();
  await page.mouse.move(textBounds!.x + 38, textBounds!.y + 26, { steps: 4 });
  await page.mouse.up();
  const dragged = await page.getByTestId("edit-text").evaluate((element) => ({
    left: Number.parseFloat((element as HTMLElement).style.left),
    top: Number.parseFloat((element as HTMLElement).style.top),
  }));
  expect(dragged.left - after.left).toBeCloseTo(30, 2);
  expect(dragged.top - after.top).toBeCloseTo(18, 2);
  await expect(page.getByTestId("status")).toContainText("Moved text");

  await page.getByTestId("whiteout-tool").click();
  await overlay.click({ position: { x: 240, y: 260 } });
  await expect(page.getByTestId("edit-whiteout")).toHaveCount(1);

  const pageButtons = page.getByRole("navigation", {
    name: "PDF pages",
  }).getByRole("button");
  await pageButtons.nth(2).click();
  await expect(page.getByTestId("status")).toContainText(/page 3/i);
  await page.getByTestId("text-tool").click();
  await overlay.click({ position: { x: 150, y: 180 } });
  await expect(page.getByTestId("edit-text")).toHaveCount(1);

  await pageButtons.nth(3).click();
  await expect(page.getByTestId("status")).toContainText(/page 4/i);
  await page.getByTestId("whiteout-tool").click();
  await overlay.click({ position: { x: 170, y: 210 } });
  await expect(page.getByTestId("edit-whiteout")).toHaveCount(1);

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("edited-local.pdf");
  await expect(page.getByTestId("status")).toContainText(
    "rendered 3 changed page",
  );

  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const downloadedBytes = await readFile(downloadedPath!);
  const parsed = await PDFDocument.load(downloadedBytes);
  expect(parsed.getPageCount()).toBe(4);
  expect(parsed.getPage(2).getRotation().angle).toBe(90);
  expect(parsed.getPage(3).getCropBox()).toEqual({
    x: 40,
    y: 80,
    width: 560,
    height: 720,
  });
  expect(sha256(await readFile(fixturePath))).toBe(originalDigest);

  const serializedRequests = JSON.stringify(requests);
  expect(serializedRequests).not.toContain("PRIVATE_FILENAME_CANARY");
  expect(serializedRequests).not.toContain("PRIVATE_TEXT_CANARY");
  expect(
    requests.filter((request) => request.body !== null),
    "No request should carry a body during the local workflow",
  ).toEqual([]);
});

test("rejects a malformed local file without offering export", async ({
  page,
}) => {
  await page.goto("/spike.html");
  await page.getByTestId("file-input").setInputFiles(
    join(process.cwd(), "tests", "fixtures", "malformed.pdf"),
  );
  await expect(page.getByTestId("status")).toHaveAttribute(
    "data-kind",
    "error",
  );
  await expect(page.getByTestId("download")).toBeDisabled();
});
