import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function createImageOnlyPdf(page: Page): Promise<Buffer> {
  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1550;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas is unavailable.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111827";
    context.font = "700 76px Arial";
    context.fillText("PRIVATE OCR TEST", 110, 240);
    context.font = "52px Arial";
    context.fillText("Invoice Number 2048", 110, 390);
    context.fillText("Searchable document", 110, 500);
    context.fillText("Processed locally in your browser", 110, 610);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  });

  const pdfDocument = await PDFDocument.create();
  const image = await pdfDocument.embedPng(Buffer.from(pngBase64, "base64"));
  const pdfPage = pdfDocument.addPage([612, 792]);
  pdfPage.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  return Buffer.from(await pdfDocument.save());
}

test("publishes the private OCR workflow on desktop and mobile", async ({ page }) => {
  await page.goto("/ocr-pdf");

  await expect(page).toHaveTitle(/OCR PDF Online Free/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Make scanned PDFs searchable.",
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .locator(".site-tools-menu > summary")
    .click();
  await expect(page.getByRole("link", { name: /OCR PDF/ }).first()).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByTestId("ocr-file-input")).toBeAttached();
  await expect(page.locator('.site-footer a[href="/ocr-pdf"]')).toHaveText(
    "OCR PDF",
  );
  await expect(page.locator('.site-footer a[href="/ocr-pdf"]')).toHaveAttribute(
    "href",
    "/ocr-pdf",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileMenu = page.getByRole("button", { name: "Menu" });
  await mobileMenu.click();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: /OCR PDF/ }),
  ).toBeVisible();
  await mobileMenu.click();
  await expect(page.getByTestId("site-ocr-pdf")).toBeVisible();
  await expect(page.getByText("Files stay on your device").first()).toBeVisible();

  const scannedPdf = await createImageOnlyPdf(page);
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByTestId("ocr-choose-file").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "mobile-scan.pdf",
    mimeType: "application/pdf",
    buffer: scannedPdf,
  });
  await expect(
    page.getByRole("heading", { name: "Ready to make it searchable." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Make PDF Searchable/ }),
  ).toBeVisible();
});

test("converts an image-only PDF into verified searchable output", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", "One full OCR pass is enough for route verification.");
  const externalRequests: string[] = [];
  const ocrAssetRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("http") && !url.startsWith("http://127.0.0.1:4173")) {
      externalRequests.push(url);
    }
    if (url.includes("/ocr/")) ocrAssetRequests.push(url);
  });
  await page.goto("/ocr-pdf");
  const scannedPdf = await createImageOnlyPdf(page);

  await page.getByTestId("ocr-file-input").setInputFiles({
    name: "private-ocr-test.pdf",
    mimeType: "application/pdf",
    buffer: scannedPdf,
  });
  await expect(
    page.getByRole("heading", { name: "Ready to make it searchable." }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Make PDF Searchable/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your PDF is searchable." }),
  ).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("1 page OCR processed")).toBeVisible();

  await page.getByPlaceholder("Search recognized text").fill("invoice");
  await expect(page.getByText(/matches/).first()).not.toHaveText("0 matches");
  await expect(
    page.getByRole("link", { name: "Download Searchable PDF" }),
  ).toHaveAttribute("download", "private-ocr-test-searchable.pdf");
  expect(externalRequests).toEqual([]);
  expect(ocrAssetRequests.some((url) => url.endsWith("/ocr/worker.min.js"))).toBe(true);
  expect(ocrAssetRequests.some((url) => url.includes("/ocr/core/"))).toBe(true);
  expect(ocrAssetRequests.some((url) => url.endsWith("/ocr/lang/eng.traineddata.gz"))).toBe(true);
});
