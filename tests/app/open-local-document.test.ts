import { describe, expect, it, vi } from "vitest";

import { openLocalDocument } from "../../src/app/open-local-document";
import { asPdfPoint } from "../../src/domain/primitives";
import { unsafeBrand } from "../../src/shared/brand";
import type { IdService } from "../../src/ports/ids";
import type { PdfRenderer, PdfSourceRegistry } from "../../src/ports/pdf";

const ids: IdService = {
  createDocumentId: () => unsafeBrand("doc_test"),
  createSourceId: () => unsafeBrand("source_test"),
  createPageId: (() => {
    let index = 0;
    return () => {
      index += 1;
      return unsafeBrand(`page_test_${index}`);
    };
  })(),
  createObjectId: () => unsafeBrand("object_test"),
  createAssetId: () => unsafeBrand("asset_test"),
  createFieldId: () => unsafeBrand("field_test"),
  createTransactionId: () => unsafeBrand("transaction_test"),
};

describe("openLocalDocument", () => {
  it("builds domain document state from a renderer inspection without exposing PDF library objects", async () => {
    const inspectedFiles: string[] = [];
    const registeredFiles: string[] = [];
    const renderer: PdfRenderer = {
      async inspect(source) {
        inspectedFiles.push(source.originalName);
        return {
          id: source.sourceId,
          fingerprint: "abc123",
          originalName: source.originalName,
          byteLength: source.blob.size,
          pageCount: 2,
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
            {
              sourcePageIndex: 1,
              geometry: {
                mediaBox: {
                  xMin: asPdfPoint(0),
                  yMin: asPdfPoint(0),
                  xMax: asPdfPoint(792),
                  yMax: asPdfPoint(612),
                },
                cropBox: {
                  xMin: asPdfPoint(0),
                  yMin: asPdfPoint(0),
                  xMax: asPdfPoint(792),
                  yMax: asPdfPoint(612),
                },
                intrinsicRotation: 90,
              },
            },
          ],
        };
      },
      renderPage: () => Promise.reject(new Error("not used")),
      renderThumbnail: () => Promise.reject(new Error("not used")),
      disposeSource: () => Promise.resolve(),
    };
    const sourceRegistry: PdfSourceRegistry = {
      async registerSource(source) {
        registeredFiles.push(source.originalName);
      },
      disposeSource: () => Promise.resolve(),
    };

    const file = new File(["%PDF"], "PRIVATE_NAME.pdf", {
      type: "application/pdf",
    });

    const document = await openLocalDocument(
      {
        ids,
        renderer,
        sourceRegistry,
        now: () => "2026-08-01T00:00:00.000Z",
      },
      file,
    );

    expect(registeredFiles).toEqual(["PRIVATE_NAME.pdf"]);
    expect(inspectedFiles).toEqual(["PRIVATE_NAME.pdf"]);
    expect(document.revision).toBe(0);
    expect(document.pages).toHaveLength(2);
    expect(document.pages[0]?.sourcePageIndex).toBe(0);
    expect(document.pages[1]?.geometry.intrinsicRotation).toBe(90);
    expect(Object.values(document.objects)).toEqual([]);
    expect(Object.values(document.objectOrderByPage)).toEqual([[], []]);
    expect(JSON.stringify(document)).not.toContain("PDFDocumentProxy");
  });

  it("removes registered source bytes when inspection fails", async () => {
    const sourceId = unsafeBrand<string, "SourceId">("source_test");
    const renderer: PdfRenderer = {
      inspect: () => Promise.reject(new Error("inspection failed")),
      renderPage: () => Promise.reject(new Error("not used")),
      renderThumbnail: () => Promise.reject(new Error("not used")),
      disposeSource: () => Promise.resolve(),
    };
    const sourceRegistry: PdfSourceRegistry = {
      registerSource: vi.fn<PdfSourceRegistry["registerSource"]>(),
      disposeSource: vi.fn<PdfSourceRegistry["disposeSource"]>(),
    };

    await expect(
      openLocalDocument(
        {
          ids: {
            ...ids,
            createSourceId: () => sourceId,
          },
          renderer,
          sourceRegistry,
          now: () => "2026-08-01T00:00:00.000Z",
        },
        new File(["not a pdf"], "broken.pdf", {
          type: "application/pdf",
        }),
      ),
    ).rejects.toThrow("inspection failed");

    expect(sourceRegistry.registerSource).toHaveBeenCalledTimes(1);
    expect(sourceRegistry.disposeSource).toHaveBeenCalledWith(sourceId);
  });
});
