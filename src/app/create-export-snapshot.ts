import type { EditObject, EditorDocument } from "../domain/document";
import type { ObjectId, PageId } from "../domain/primitives";
import type { ExportSnapshot } from "../ports/pdf";

function cloneEditObject(object: EditObject): EditObject {
  return structuredClone(object) as EditObject;
}

export function createExportSnapshot(document: EditorDocument): ExportSnapshot {
  const objectsByPage = {} as Record<PageId, EditObject[]>;
  const pageIds = new Set<PageId>();
  const seenObjectIds = new Set<ObjectId>();

  for (const page of document.pages) {
    const source = document.sources[page.sourceId];
    if (source === undefined) {
      throw new Error("Cannot export a page with a missing source document.");
    }

    pageIds.add(page.id);
    objectsByPage[page.id] = [];
    for (const objectId of document.objectOrderByPage[page.id] ?? []) {
      if (seenObjectIds.has(objectId)) {
        throw new Error("Cannot export an object that appears more than once.");
      }

      const object = document.objects[objectId];
      if (object === undefined) {
        throw new Error("Cannot export a z-order entry with a missing object.");
      }

      if (object.pageId !== page.id) {
        throw new Error("Cannot export an object in the wrong page z-order.");
      }

      seenObjectIds.add(objectId);
      objectsByPage[page.id]!.push(cloneEditObject(object));
    }
  }

  for (const object of Object.values(document.objects)) {
    if (!pageIds.has(object.pageId)) {
      throw new Error("Cannot export an object with a missing page.");
    }

    if (!seenObjectIds.has(object.id)) {
      throw new Error("Cannot export an object missing from page z-order.");
    }
  }

  return {
    documentId: document.id,
    revision: document.revision,
    sources: Object.values(document.sources).map((source) => ({
      sourceId: source.id,
      fingerprint: source.fingerprint,
      byteLength: source.byteLength,
    })),
    pages: document.pages.map((page) => ({
      pageId: page.id,
      sourceId: page.sourceId,
      sourcePageIndex: page.sourcePageIndex,
      geometry: structuredClone(page.geometry),
      userRotation: page.userRotation,
    })),
    objectsByPage,
    formValues: structuredClone(document.formValues),
    assets: Object.values(document.assets).map((asset) => ({
      assetId: asset.id,
      sha256: asset.sha256,
    })),
  };
}
