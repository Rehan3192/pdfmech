import type {
  InspectionResult,
  LocalPdfSource,
  PdfRenderer,
  RenderedPage,
  RenderedThumbnail,
  RenderPageRequest,
} from "../../ports/pdf";

export type PdfRendererLoader = () => Promise<PdfRenderer>;

async function loadBrowserRenderer(): Promise<PdfRenderer> {
  const module = await import("./browser-renderer");
  return module.createPdfJsRenderer();
}

export function createLazyPdfRenderer(
  loadRenderer: PdfRendererLoader = loadBrowserRenderer,
): PdfRenderer {
  let rendererPromise: Promise<PdfRenderer> | null = null;

  function getRenderer(): Promise<PdfRenderer> {
    rendererPromise ??= loadRenderer();
    return rendererPromise;
  }

  return {
    async inspect(source: LocalPdfSource): Promise<InspectionResult> {
      return (await getRenderer()).inspect(source);
    },

    async renderPage(request: RenderPageRequest): Promise<RenderedPage> {
      return (await getRenderer()).renderPage(request);
    },

    async renderThumbnail(
      request: RenderPageRequest,
    ): Promise<RenderedThumbnail> {
      return (await getRenderer()).renderThumbnail(request);
    },

    async disposeSource(sourceId): Promise<void> {
      if (rendererPromise === null) {
        return;
      }

      return (await rendererPromise).disposeSource(sourceId);
    },
  };
}
