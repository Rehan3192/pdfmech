import { createExportSnapshot } from "./create-export-snapshot";
import type { EditorDocument } from "../domain/document";
import type { EditorError } from "../domain/errors";
import { getCropBoxSize } from "../domain/geometry";
import { normalizeDegrees } from "../domain/primitives";
import type { GeneratedPdf, PdfExporter, PdfValidator } from "../ports/pdf";

export interface ExportDocumentServices {
  readonly exporter: PdfExporter;
}

export interface ExportValidatedDocumentServices extends ExportDocumentServices {
  readonly validator: PdfValidator;
}

export class ExportValidationError extends Error {
  constructor(readonly editorError: EditorError) {
    super("Generated PDF failed validation.");
    this.name = "ExportValidationError";
  }
}

export async function exportDocument(
  services: ExportDocumentServices,
  document: EditorDocument,
): Promise<GeneratedPdf> {
  return services.exporter.export(createExportSnapshot(document));
}

export async function exportValidatedDocument(
  services: ExportValidatedDocumentServices,
  document: EditorDocument,
): Promise<GeneratedPdf> {
  const generated = await exportDocument(services, document);
  const validation = await services.validator.validate({
    documentId: document.id,
    revision: document.revision,
    generatedBytes: generated.bytes,
    expectedPages: document.pages.map((page) => {
      const size = getCropBoxSize(page.geometry.cropBox);
      const finalRotation =
        page.userRotation === 0
          ? page.geometry.intrinsicRotation
          : normalizeDegrees(page.userRotation);
      const rotatedSideways =
        finalRotation === 90 || finalRotation === 270;
      return {
        sourcePageIndex: page.sourcePageIndex,
        width: rotatedSideways ? size.height : size.width,
        height: rotatedSideways ? size.width : size.height,
        rotation: finalRotation,
      };
    }),
  });

  if (!validation.ok) {
    throw new ExportValidationError(validation.error);
  }

  return generated;
}
