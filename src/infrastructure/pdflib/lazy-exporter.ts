import type {
  ExportSnapshot,
  GeneratedPdf,
  LocalPdfSource,
  PdfExporter,
  PdfSourceRegistry,
} from "../../ports/pdf";

type RegisteredPdfExporter = PdfExporter & PdfSourceRegistry;

export type PdfExporterLoader = () => Promise<RegisteredPdfExporter>;

async function loadBrowserExporter(): Promise<RegisteredPdfExporter> {
  const module = await import("./browser-exporter");
  return new module.BrowserPdfExporter();
}

export function createLazyPdfExporter(
  loadExporter: PdfExporterLoader = loadBrowserExporter,
): RegisteredPdfExporter {
  let exporterPromise: Promise<RegisteredPdfExporter> | null = null;

  function getExporter(): Promise<RegisteredPdfExporter> {
    exporterPromise ??= loadExporter();
    return exporterPromise;
  }

  return {
    async registerSource(source: LocalPdfSource): Promise<void> {
      return (await getExporter()).registerSource(source);
    },

    async disposeSource(sourceId): Promise<void> {
      if (exporterPromise === null) {
        return;
      }

      return (await exporterPromise).disposeSource(sourceId);
    },

    async export(snapshot: ExportSnapshot): Promise<GeneratedPdf> {
      return (await getExporter()).export(snapshot);
    },
  };
}
