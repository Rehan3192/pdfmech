import { describe, expect, it, vi } from "vitest";

import { renderDocumentPage } from "../../src/app/render-document-page";
import { createEmptyEditorDocument } from "../../src/domain/document";
import { asPdfPoint } from "../../src/domain/primitives";
import { unsafeBrand } from "../../src/shared/brand";
import type { EditorDocument, PageInstance } from "../../src/domain/document";
import type { PdfRenderer } from "../../src/ports/pdf";

function createDocumentWithPage(): EditorDocument {
  const page: PageInstance = {
    id: unsafeBrand("page_test"),
    sourceId: unsafeBrand("source_test"),
    sourcePageIndex: 3,
    userRotation: 90,
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
  };

  return {
    ...createEmptyEditorDocument({
      id: unsafeBrand("document_test"),
      createdAt: "2026-08-01T00:00:00.000Z",
    }),
    pages: [page],
  };
}

describe("renderDocumentPage", () => {
  it("renders through the PdfRenderer port using the document page source reference", async () => {
    const bitmap = {} as ImageBitmap;
    const renderPage = vi.fn<PdfRenderer["renderPage"]>().mockResolvedValue({
      bitmap,
      width: 612,
      height: 792,
    });
    const renderer: PdfRenderer = {
      inspect: vi.fn(),
      renderPage,
      renderThumbnail: vi.fn(),
      disposeSource: vi.fn(),
    };

    await expect(
      renderDocumentPage({ renderer }, createDocumentWithPage(), 0, 1.5),
    ).resolves.toEqual({ bitmap, width: 612, height: 792 });
    expect(renderPage).toHaveBeenCalledWith({
      sourceId: "source_test",
      sourcePageIndex: 3,
      scale: 1.5,
      rotation: 90,
    });
  });

  it("rejects unavailable pages and unsafe scales before calling infrastructure", async () => {
    const renderer: PdfRenderer = {
      inspect: vi.fn(),
      renderPage: vi.fn(),
      renderThumbnail: vi.fn(),
      disposeSource: vi.fn(),
    };
    const document = createDocumentWithPage();

    await expect(renderDocumentPage({ renderer }, document, 2, 1)).rejects.toThrow(
      /Page 3/,
    );
    await expect(
      renderDocumentPage({ renderer }, document, 0, 4.5),
    ).rejects.toThrow(/between 0 and 4/);
    expect(renderer.renderPage).not.toHaveBeenCalled();
  });
});
