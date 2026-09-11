import { describe, expect, it, vi } from "vitest";

import { createLazyPdfExporter } from "../../src/infrastructure/pdflib/lazy-exporter";
import { unsafeBrand } from "../../src/shared/brand";
import type {
  ExportSnapshot,
  PdfExporter,
  PdfSourceRegistry,
} from "../../src/ports/pdf";

describe("lazy PDF exporter", () => {
  it("does not load the browser pdf-lib adapter until export source work needs it", async () => {
    const registerSource = vi.fn<PdfSourceRegistry["registerSource"]>();
    const disposeSource = vi.fn<PdfSourceRegistry["disposeSource"]>();
    const exportPdf = vi.fn<PdfExporter["export"]>().mockResolvedValue({
      bytes: new Uint8Array([1]),
      sha256: "hash",
    });
    const exporter = {
      registerSource,
      disposeSource,
      export: exportPdf,
    };
    const loadExporter = vi.fn().mockResolvedValue(exporter);
    const lazyExporter = createLazyPdfExporter(loadExporter);

    expect(loadExporter).not.toHaveBeenCalled();
    await lazyExporter.disposeSource(unsafeBrand("source_unused"));
    expect(loadExporter).not.toHaveBeenCalled();

    await lazyExporter.registerSource({
      sourceId: unsafeBrand("source_test"),
      blob: new Blob(["%PDF"]),
      originalName: "PRIVATE_NAME.pdf",
    });

    await lazyExporter.export({
      documentId: unsafeBrand("document_test"),
      revision: 0,
      sources: [],
      pages: [],
      objectsByPage: {},
      formValues: {},
      assets: [],
    } satisfies ExportSnapshot);

    expect(loadExporter).toHaveBeenCalledTimes(1);
    expect(registerSource).toHaveBeenCalledTimes(1);
    expect(exportPdf).toHaveBeenCalledTimes(1);
  });
});
