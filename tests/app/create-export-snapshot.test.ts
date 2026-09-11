import { describe, expect, it } from "vitest";

import { createExportSnapshot } from "../../src/app/create-export-snapshot";
import {
  addTextObject,
  addWhiteoutObject,
} from "../../src/domain/edit-object-commands";
import { createEmptyEditorDocument } from "../../src/domain/document";
import { asPdfPoint } from "../../src/domain/primitives";
import { unsafeBrand } from "../../src/shared/brand";
import type {
  AssetDescriptor,
  EditorDocument,
  PageInstance,
  SourceDocument,
} from "../../src/domain/document";

function createSource(): SourceDocument {
  return {
    id: unsafeBrand("source_test"),
    fingerprint: "fingerprint_test",
    originalName: "PRIVATE_FILENAME_CANARY.pdf",
    byteLength: 1234,
    pageCount: 2,
    encryption: "none",
    signatureState: "none",
    capabilities: {
      canRender: true,
      canExportOverlay: true,
      canFillSupportedForms: false,
      unsupportedReasons: [],
    },
  };
}

function createPages(source: SourceDocument): readonly [PageInstance, PageInstance] {
  return [
    {
      id: unsafeBrand("page_test_1"),
      sourceId: source.id,
      sourcePageIndex: 0,
      userRotation: 0,
      geometry: {
        mediaBox: {
          xMin: asPdfPoint(0),
          yMin: asPdfPoint(0),
          xMax: asPdfPoint(612),
          yMax: asPdfPoint(792),
        },
        cropBox: {
          xMin: asPdfPoint(0),
          yMin: asPdfPoint(0),
          xMax: asPdfPoint(612),
          yMax: asPdfPoint(792),
        },
        intrinsicRotation: 0,
      },
    },
    {
      id: unsafeBrand("page_test_2"),
      sourceId: source.id,
      sourcePageIndex: 1,
      userRotation: 90,
      geometry: {
        mediaBox: {
          xMin: asPdfPoint(0),
          yMin: asPdfPoint(0),
          xMax: asPdfPoint(792),
          yMax: asPdfPoint(612),
        },
        cropBox: {
          xMin: asPdfPoint(0),
          yMin: asPdfPoint(0),
          xMax: asPdfPoint(792),
          yMax: asPdfPoint(612),
        },
        intrinsicRotation: 90,
      },
    },
  ];
}

function createDocument(): EditorDocument {
  const source = createSource();
  const [firstPage, secondPage] = createPages(source);
  const asset: AssetDescriptor = {
    id: unsafeBrand("asset_test"),
    mediaType: "image/png",
    byteLength: 99,
    pixelWidth: 10,
    pixelHeight: 10,
    sha256: "asset_sha256_test",
  };
  const fieldId = unsafeBrand<string, "FieldId">("field_test");

  return {
    ...createEmptyEditorDocument({
      id: unsafeBrand("document_test"),
      createdAt: "2026-08-11T00:00:00.000Z",
    }),
    sources: {
      [source.id]: source,
    },
    pages: [firstPage, secondPage],
    objectOrderByPage: {
      [firstPage.id]: [],
      [secondPage.id]: [],
    },
    assets: {
      [asset.id]: asset,
    },
    formValues: {
      [fieldId]: {
        kind: "text",
        value: "PRIVATE_FORM_VALUE_CANARY",
      },
    },
  };
}

describe("createExportSnapshot", () => {
  it("builds a deterministic immutable snapshot from document state", () => {
    const textId = unsafeBrand<string, "ObjectId">("object_text");
    const whiteoutId = unsafeBrand<string, "ObjectId">("object_whiteout");
    const baseDocument = createDocument();
    const documentWithText = addTextObject(baseDocument, {
      objectId: textId,
      pageIndex: 0,
      frame: {
        x: asPdfPoint(120),
        y: asPdfPoint(140),
        width: asPdfPoint(180),
        height: asPdfPoint(28),
      },
      text: "PRIVATE_TEXT_CANARY",
      now: "2026-08-11T00:00:01.000Z",
    });
    const document = addWhiteoutObject(documentWithText, {
      objectId: whiteoutId,
      pageIndex: 0,
      frame: {
        x: asPdfPoint(200),
        y: asPdfPoint(220),
        width: asPdfPoint(180),
        height: asPdfPoint(36),
      },
      now: "2026-08-11T00:00:02.000Z",
    });

    const snapshot = createExportSnapshot(document);

    expect(snapshot.documentId).toBe(document.id);
    expect(snapshot.revision).toBe(2);
    expect(snapshot.sources).toEqual([
      {
        sourceId: Object.values(document.sources)[0]!.id,
        fingerprint: "fingerprint_test",
        byteLength: 1234,
      },
    ]);
    expect(JSON.stringify(snapshot.sources)).not.toContain(
      "PRIVATE_FILENAME_CANARY",
    );
    expect(snapshot.pages).toHaveLength(2);
    expect(snapshot.pages[1]).toMatchObject({
      pageId: document.pages[1]!.id,
      sourcePageIndex: 1,
      userRotation: 90,
    });
    expect(snapshot.objectsByPage[document.pages[0]!.id]?.map((object) => object.id)).toEqual([
      textId,
      whiteoutId,
    ]);
    expect(snapshot.objectsByPage[document.pages[0]!.id]?.map((object) => object.kind)).toEqual([
      "text",
      "whiteout",
    ]);
    expect(snapshot.objectsByPage[document.pages[1]!.id]).toEqual([]);
    expect(snapshot.formValues).toEqual(document.formValues);
    expect(snapshot.assets).toEqual([
      {
        assetId: Object.values(document.assets)[0]!.id,
        sha256: "asset_sha256_test",
      },
    ]);

    const exportedText = snapshot.objectsByPage[document.pages[0]!.id]?.[0];
    if (exportedText?.kind !== "text") {
      throw new Error("Expected first exported object to be text.");
    }
    (exportedText.frame as { x: number }).x = asPdfPoint(999);
    expect(document.objects[textId]?.frame.x).toBe(120);
  });

  it("rejects an object missing from page z-order", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_text");
    const document = addTextObject(createDocument(), {
      objectId,
      pageIndex: 0,
      frame: {
        x: asPdfPoint(120),
        y: asPdfPoint(140),
        width: asPdfPoint(180),
        height: asPdfPoint(28),
      },
      text: "Text",
      now: "2026-08-11T00:00:01.000Z",
    });
    const brokenDocument: EditorDocument = {
      ...document,
      objectOrderByPage: {
        ...document.objectOrderByPage,
        [document.pages[0]!.id]: [],
      },
    };

    expect(() => createExportSnapshot(brokenDocument)).toThrow(
      "Cannot export an object missing from page z-order.",
    );
  });

  it("rejects a z-order entry whose object belongs to another page", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_text");
    const document = addTextObject(createDocument(), {
      objectId,
      pageIndex: 0,
      frame: {
        x: asPdfPoint(120),
        y: asPdfPoint(140),
        width: asPdfPoint(180),
        height: asPdfPoint(28),
      },
      text: "Text",
      now: "2026-08-11T00:00:01.000Z",
    });
    const brokenDocument: EditorDocument = {
      ...document,
      objectOrderByPage: {
        ...document.objectOrderByPage,
        [document.pages[0]!.id]: [],
        [document.pages[1]!.id]: [objectId],
      },
    };

    expect(() => createExportSnapshot(brokenDocument)).toThrow(
      "Cannot export an object in the wrong page z-order.",
    );
  });
});
