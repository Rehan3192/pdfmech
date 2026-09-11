import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createLazyPdfRenderer } from "../../src/infrastructure/pdfjs/lazy-renderer";
import { asPdfPoint } from "../../src/domain/primitives";
import { unsafeBrand } from "../../src/shared/brand";
import type { PdfRenderer } from "../../src/ports/pdf";

describe("lazy PDF renderer", () => {
  it("does not load the browser PDF.js adapter until a PDF operation needs it", async () => {
    const inspect = vi.fn<PdfRenderer["inspect"]>().mockResolvedValue({
      id: unsafeBrand("source_test"),
      fingerprint: "fingerprint",
      originalName: "local.pdf",
      byteLength: 4,
      pageCount: 1,
      encryption: "none",
      signatureState: "none",
      capabilities: {
        canRender: true,
        canExportOverlay: false,
        canFillSupportedForms: false,
        unsupportedReasons: [],
      },
      pages: [
        {
          sourcePageIndex: 0,
          geometry: {
            mediaBox: {
              xMin: asPdfPoint(0),
              yMin: asPdfPoint(0),
              xMax: asPdfPoint(612),
              yMax: asPdfPoint(792),
            },
            cropBox: {
              xMin: asPdfPoint(0),
              yMin: asPdfPoint(0),
              xMax: asPdfPoint(612),
              yMax: asPdfPoint(792),
            },
            intrinsicRotation: 0,
          },
        },
      ],
    });
    const renderer: PdfRenderer = {
      inspect,
      renderPage: vi.fn(),
      renderThumbnail: vi.fn(),
      disposeSource: vi.fn(),
    };
    const loadRenderer = vi.fn().mockResolvedValue(renderer);
    const lazyRenderer = createLazyPdfRenderer(loadRenderer);

    expect(loadRenderer).not.toHaveBeenCalled();

    await lazyRenderer.inspect({
      sourceId: unsafeBrand("source_test"),
      blob: new Blob(["%PDF"]),
      originalName: "local.pdf",
    });
    await lazyRenderer.inspect({
      sourceId: unsafeBrand("source_test"),
      blob: new Blob(["%PDF"]),
      originalName: "local.pdf",
    });

    expect(loadRenderer).toHaveBeenCalledTimes(1);
    expect(inspect).toHaveBeenCalledTimes(2);
  });

  it("keeps the production entry free of eager PDF.js adapter imports", async () => {
    const productionMain = await readFile(
      path.resolve("src", "production-main.tsx"),
      "utf8",
    );
    const lazyRenderer = await readFile(
      path.resolve("src", "infrastructure", "pdfjs", "lazy-renderer.ts"),
      "utf8",
    );

    expect(productionMain).not.toMatch(/browser-renderer/);
    expect(productionMain).not.toMatch(/pdfjs-dist|pdf-lib/);
    expect(lazyRenderer).toContain('import("./browser-renderer")');
    expect(lazyRenderer).not.toMatch(/from\s+["']\.\/browser-renderer["']/);
    expect(lazyRenderer).not.toMatch(/pdfjs-dist|pdf-lib/);
  });
});
