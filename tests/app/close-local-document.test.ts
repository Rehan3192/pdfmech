import { describe, expect, it, vi } from "vitest";

import { closeLocalDocument } from "../../src/app/close-local-document";
import { createEmptyEditorDocument } from "../../src/domain/document";
import { unsafeBrand } from "../../src/shared/brand";
import type { EditorDocument, SourceDocument } from "../../src/domain/document";
import type { PdfRenderer, PdfSourceRegistry } from "../../src/ports/pdf";

function source(id: string): SourceDocument {
  return {
    id: unsafeBrand(id),
    fingerprint: id,
    originalName: `${id}.pdf`,
    byteLength: 10,
    pageCount: 1,
    encryption: "none",
    signatureState: "none",
    capabilities: {
      canRender: true,
      canExportOverlay: false,
      canFillSupportedForms: false,
      unsupportedReasons: [],
    },
  };
}

describe("closeLocalDocument", () => {
  it("disposes every source through the PdfRenderer and source registry ports", async () => {
    const sourceA = unsafeBrand<string, "SourceId">("source_a");
    const sourceB = unsafeBrand<string, "SourceId">("source_b");
    const document: EditorDocument = {
      ...createEmptyEditorDocument({
        id: unsafeBrand("document_test"),
        createdAt: "2026-08-01T00:00:00.000Z",
      }),
      sources: {
        [sourceA]: source(sourceA),
        [sourceB]: source(sourceB),
      },
    };
    const disposeSource = vi.fn<PdfRenderer["disposeSource"]>();
    const disposeRegisteredSource = vi.fn<PdfSourceRegistry["disposeSource"]>();
    const renderer: PdfRenderer = {
      inspect: vi.fn(),
      renderPage: vi.fn(),
      renderThumbnail: vi.fn(),
      disposeSource,
    };
    const sourceRegistry: PdfSourceRegistry = {
      registerSource: vi.fn(),
      disposeSource: disposeRegisteredSource,
    };

    await closeLocalDocument({ renderer, sourceRegistry }, document);

    expect(disposeSource).toHaveBeenCalledTimes(2);
    expect(disposeSource).toHaveBeenCalledWith("source_a");
    expect(disposeSource).toHaveBeenCalledWith("source_b");
    expect(disposeRegisteredSource).toHaveBeenCalledTimes(2);
    expect(disposeRegisteredSource).toHaveBeenCalledWith("source_a");
    expect(disposeRegisteredSource).toHaveBeenCalledWith("source_b");
  });
});
