import type { EditorDocument } from "../domain/document";
import type { PdfRenderer, PdfSourceRegistry } from "../ports/pdf";

export interface CloseLocalDocumentServices {
  readonly renderer: PdfRenderer;
  readonly sourceRegistry?: PdfSourceRegistry;
}

export async function closeLocalDocument(
  services: CloseLocalDocumentServices,
  document: EditorDocument,
): Promise<void> {
  await Promise.all(
    Object.values(document.sources).flatMap((source) => [
      services.renderer.disposeSource(source.id),
      services.sourceRegistry?.disposeSource(source.id) ?? Promise.resolve(),
    ]),
  );
}
