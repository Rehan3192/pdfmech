import type { EditorDocument } from "../domain/document";
import type { PdfRenderer, RenderedPage } from "../ports/pdf";

export interface RenderDocumentPageServices {
  readonly renderer: PdfRenderer;
}

export async function renderDocumentPage(
  services: RenderDocumentPageServices,
  document: EditorDocument,
  pageIndex: number,
  scale: number,
): Promise<RenderedPage> {
  const page = document.pages[pageIndex];
  if (page === undefined) {
    throw new RangeError(`Page ${pageIndex + 1} is not available.`);
  }

  if (!Number.isFinite(scale) || scale <= 0 || scale > 4) {
    throw new RangeError("Render scale must be between 0 and 4.");
  }

  return services.renderer.renderPage({
    sourceId: page.sourceId,
    sourcePageIndex: page.sourcePageIndex,
    scale,
    rotation: page.userRotation,
  });
}
