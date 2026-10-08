import { expect, test } from "@playwright/test";

const toolLaunches = [
  ["/add-text-to-pdf", ".tool-route-upload"],
  ["/delete-pdf-pages", ".tool-route-upload"],
  ["/reorder-pdf-pages", ".tool-route-upload"],
  ["/rotate-pdf-pages", ".tool-route-upload"],
  ["/whiteout-pdf", ".tool-route-upload"],
  ["/ocr-pdf", ".ocr-upload-card"],
  ["/bates-numbering-pdf", ".bates-drop-zone"],
  ["/flatten-pdf", ".flatten-drop-zone"],
  ["/fill-pdf-form", ".fill-form-drop-zone"],
  ["/deskew-pdf", ".deskew-drop-zone"],
  ["/remove-pdf-metadata", ".metadata-drop-zone"],
  ["/compare-pdf", ".compare-drop-zone"],
  ["/extract-pdf-pages", ".extract-drop-zone"],
  ["/merge-pdf", ".merge-drop-zone"],
  ["/split-pdf", ".split-drop-zone"],
  ["/split-pdf-and-rename", ".split-rename-drop"],
  ["/compress-pdf", ".compress-pdf-drop"],
  ["/redact-pdf", ".redact-pdf-drop"],
  ["/protect-pdf", ".protect-pdf-drop"],
  ["/unlock-pdf", ".unlock-pdf-drop"],
  ["/pdf-to-jpg", ".pdf-jpg-drop"],
  ["/jpg-to-pdf", ".jpg-pdf-drop"],
  ["/watermark-pdf", ".watermark-drop"],
  ["/sign-pdf", ".sign-pdf-drop"],
] as const;

test("every PDF tool exposes its file action in the first desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const [route, selector] of toolLaunches) {
    await page.goto(route);
    const heading = page.locator("h1").first();
    const launch = page.locator(selector).first();
    await expect(heading, `${route} heading`).toBeVisible();
    await expect(launch, `${route} file action`).toBeVisible();

    const headingSize = await heading.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(headingSize, `${route} heading size`).toBeLessThanOrEqual(51);

    const box = await launch.boundingBox();
    expect(box, `${route} file action bounds`).not.toBeNull();
    expect(box!.y + Math.min(box!.height / 2, 140), `${route} file action position`).toBeLessThan(900);
  }
});

test("mobile tool pages put the upload action before supporting copy", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [route, selector] of [
    ["/add-text-to-pdf", ".tool-route-upload"],
    ["/split-pdf-and-rename", ".split-rename-drop"],
  ] as const) {
    await page.goto(route);
    const launch = page.locator(selector).first();
    await expect(launch).toBeVisible();
    const box = await launch.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y, `${route} mobile file action position`).toBeLessThan(844);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
