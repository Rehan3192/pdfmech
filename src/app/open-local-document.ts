import { createDocumentFromInspection } from "./open-document";
import type { EditorDocument } from "../domain/document";
import type { IdService } from "../ports/ids";
import type { LocalPdfSource, PdfRenderer, PdfSourceRegistry } from "../ports/pdf";

export interface OpenLocalDocumentServices {
  readonly ids: IdService;
  readonly renderer: PdfRenderer;
  readonly sourceRegistry?: PdfSourceRegistry;
  readonly now: () => string;
}

export async function openLocalDocument(
  services: OpenLocalDocumentServices,
  file: File,
): Promise<EditorDocument> {
  const sourceId = services.ids.createSourceId();
  const source: LocalPdfSource = {
    sourceId,
    blob: file,
    originalName: file.name,
  };

  await services.sourceRegistry?.registerSource(source);

  let keepRegisteredSource = false;
  try {
    const inspection = await services.renderer.inspect(source);
    keepRegisteredSource = true;

    return createDocumentFromInspection({
      inspection,
      ids: {
        documentId: services.ids.createDocumentId(),
        pageIds: inspection.pages.map(() => services.ids.createPageId()),
      },
      now: services.now(),
    });
  } finally {
    if (!keepRegisteredSource) {
      await services.sourceRegistry?.disposeSource(sourceId);
    }
  }
}
