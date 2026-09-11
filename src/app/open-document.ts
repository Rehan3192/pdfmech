import type { EditorDocument, PageInstance } from "../domain/document";
import { createEmptyEditorDocument } from "../domain/document";
import type { DocumentId, PageId } from "../domain/primitives";
import type { InspectionResult } from "../ports/pdf";

export interface DocumentBootstrapIds {
  readonly documentId: DocumentId;
  readonly pageIds: readonly PageId[];
}

export function createDocumentFromInspection(input: {
  readonly inspection: InspectionResult;
  readonly ids: DocumentBootstrapIds;
  readonly now: string;
}): EditorDocument {
  const { inspection, ids, now } = input;

  if (inspection.pages.length !== inspection.pageCount) {
    throw new Error("Inspection page list must match reported page count.");
  }

  if (ids.pageIds.length !== inspection.pages.length) {
    throw new Error("A page ID is required for every inspected page.");
  }

  const pages: PageInstance[] = inspection.pages.map((page, index) => ({
    id: ids.pageIds[index] as PageId,
    sourceId: inspection.id,
    sourcePageIndex: page.sourcePageIndex,
    userRotation: 0,
    geometry: page.geometry,
  }));

  return {
    ...createEmptyEditorDocument({
      id: ids.documentId,
      createdAt: now,
    }),
    updatedAt: now,
    sources: {
      [inspection.id]: {
        id: inspection.id,
        fingerprint: inspection.fingerprint,
        originalName: inspection.originalName,
        byteLength: inspection.byteLength,
        pageCount: inspection.pageCount,
        encryption: inspection.encryption,
        signatureState: inspection.signatureState,
        capabilities: inspection.capabilities,
      },
    },
    pages,
    objectOrderByPage: Object.fromEntries(
      pages.map((page) => [page.id, [] as const]),
    ) as EditorDocument["objectOrderByPage"],
  };
}
