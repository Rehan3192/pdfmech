import { describe, expect, it } from "vitest";

import {
  addRedactionObject,
  addTextObject,
  addWhiteoutObject,
  deleteObject,
  duplicateObject,
  moveObject,
  resizeObject,
  updateTextObjectAppearance,
  updateTextObjectContent,
  updateRedactionObjectAppearance,
  updateWhiteoutObjectAppearance,
} from "../../src/domain/edit-object-commands";
import { createEmptyEditorDocument } from "../../src/domain/document";
import { asPdfPoint, asUnitInterval } from "../../src/domain/primitives";
import { unsafeBrand } from "../../src/shared/brand";
import type { EditorDocument, PageInstance } from "../../src/domain/document";

function createDocument(): EditorDocument {
  const pageId = unsafeBrand<string, "PageId">("page_test");
  const page: PageInstance = {
    id: pageId,
    sourceId: unsafeBrand("source_test"),
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
  };

  return {
    ...createEmptyEditorDocument({
      id: unsafeBrand("document_test"),
      createdAt: "2026-08-01T00:00:00.000Z",
    }),
    pages: [page],
    objectOrderByPage: {
      [pageId]: [],
    },
  };
}

describe("edit object commands", () => {
  it("adds a text object immutably and records page z-order", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_test");
    const document = createDocument();
    const next = addTextObject(document, {
      objectId,
      pageIndex: 0,
      frame: {
        x: asPdfPoint(120),
        y: asPdfPoint(140),
        width: asPdfPoint(180),
        height: asPdfPoint(28),
      },
      text: " Text ",
      now: "2026-08-01T00:00:01.000Z",
    });

    expect(document.objects[objectId]).toBeUndefined();
    expect(next.revision).toBe(1);
    expect(next.updatedAt).toBe("2026-08-01T00:00:01.000Z");
    expect(next.objects[objectId]).toMatchObject({
      id: objectId,
      kind: "text",
      text: "Text",
      createdAtRevision: 1,
    });
    expect(next.objectOrderByPage[next.pages[0]!.id]).toEqual([objectId]);
  });

  it("adds a whiteout object immutably and records page z-order", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_whiteout");
    const document = createDocument();
    const next = addWhiteoutObject(document, {
      objectId,
      pageIndex: 0,
      frame: {
        x: asPdfPoint(200),
        y: asPdfPoint(220),
        width: asPdfPoint(180),
        height: asPdfPoint(36),
      },
      now: "2026-08-01T00:00:01.000Z",
    });

    expect(document.objects[objectId]).toBeUndefined();
    expect(next.revision).toBe(1);
    expect(next.updatedAt).toBe("2026-08-01T00:00:01.000Z");
    expect(next.objects[objectId]).toMatchObject({
      id: objectId,
      kind: "whiteout",
      createdAtRevision: 1,
      color: {
        red: 1,
        green: 1,
        blue: 1,
        alpha: 1,
      },
    });
    expect(next.objectOrderByPage[next.pages[0]!.id]).toEqual([objectId]);
  });

  it("adds a redaction object immutably and records page z-order", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_redaction");
    const document = createDocument();
    const next = addRedactionObject(document, {
      objectId,
      pageIndex: 0,
      frame: {
        x: asPdfPoint(200),
        y: asPdfPoint(220),
        width: asPdfPoint(180),
        height: asPdfPoint(36),
      },
      now: "2026-08-01T00:00:01.000Z",
    });

    expect(document.objects[objectId]).toBeUndefined();
    expect(next.revision).toBe(1);
    expect(next.updatedAt).toBe("2026-08-01T00:00:01.000Z");
    expect(next.objects[objectId]).toMatchObject({
      id: objectId,
      kind: "redaction",
      color: {
        red: 0,
        green: 0,
        blue: 0,
        alpha: 1,
      },
      createdAtRevision: 1,
    });
    expect(next.objectOrderByPage[next.pages[0]!.id]).toEqual([objectId]);
  });

  it("updates redaction color immutably", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_redaction");
    const document = addRedactionObject(createDocument(), {
      objectId,
      pageIndex: 0,
      frame: {
        x: asPdfPoint(200),
        y: asPdfPoint(220),
        width: asPdfPoint(180),
        height: asPdfPoint(36),
      },
      now: "2026-08-01T00:00:01.000Z",
    });

    const next = updateRedactionObjectAppearance(document, {
      objectId,
      color: {
        red: 0.15,
        green: 0.18,
        blue: 0.22,
        alpha: asUnitInterval(1),
      },
      now: "2026-08-01T00:00:02.000Z",
    });

    expect(next.revision).toBe(2);
    expect(next.updatedAt).toBe("2026-08-01T00:00:02.000Z");
    expect(next.objects[objectId]).toMatchObject({
      kind: "redaction",
      color: {
        red: 0.15,
        green: 0.18,
        blue: 0.22,
        alpha: 1,
      },
    });
  });

  it("updates whiteout color immutably", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_whiteout");
    const document = addWhiteoutObject(createDocument(), {
      objectId,
      pageIndex: 0,
      frame: {
        x: asPdfPoint(200),
        y: asPdfPoint(220),
        width: asPdfPoint(180),
        height: asPdfPoint(36),
      },
      now: "2026-08-01T00:00:01.000Z",
    });

    const next = updateWhiteoutObjectAppearance(document, {
      objectId,
      color: {
        red: 0.92,
        green: 0.9,
        blue: 0.84,
        alpha: asUnitInterval(1),
      },
      now: "2026-08-01T00:00:02.000Z",
    });

    expect(next.revision).toBe(2);
    expect(next.updatedAt).toBe("2026-08-01T00:00:02.000Z");
    expect(next.objects[objectId]).toMatchObject({
      kind: "whiteout",
      color: {
        red: 0.92,
        green: 0.9,
        blue: 0.84,
        alpha: 1,
      },
    });
    expect(document.objects[objectId]).toMatchObject({
      color: {
        red: 1,
        green: 1,
        blue: 1,
        alpha: 1,
      },
    });
  });

  it("deletes an object immutably and removes it from z-order", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_test");
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
      now: "2026-08-01T00:00:01.000Z",
    });

    const next = deleteObject(
      document,
      objectId,
      "2026-08-01T00:00:02.000Z",
    );

    expect(next.revision).toBe(2);
    expect(next.objects[objectId]).toBeUndefined();
    expect(next.objectOrderByPage[document.pages[0]!.id]).toEqual([]);
  });

  it("moves an object immutably without changing page z-order", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_test");
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
      now: "2026-08-01T00:00:01.000Z",
    });

    const frame = {
      x: asPdfPoint(160),
      y: asPdfPoint(180),
      width: asPdfPoint(180),
      height: asPdfPoint(28),
    };
    const next = moveObject(document, {
      objectId,
      frame,
      now: "2026-08-01T00:00:02.000Z",
    });

    expect(document.objects[objectId]?.frame).toEqual({
      x: 120,
      y: 140,
      width: 180,
      height: 28,
    });
    expect(next.revision).toBe(2);
    expect(next.updatedAt).toBe("2026-08-01T00:00:02.000Z");
    expect(next.objects[objectId]?.frame).toEqual(frame);
    expect(next.objectOrderByPage[document.pages[0]!.id]).toEqual([objectId]);
  });

  it("resizes an object immutably without changing page z-order", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_test");
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
      now: "2026-08-01T00:00:01.000Z",
    });

    const frame = {
      x: asPdfPoint(120),
      y: asPdfPoint(140),
      width: asPdfPoint(220),
      height: asPdfPoint(48),
    };
    const next = resizeObject(document, {
      objectId,
      frame,
      now: "2026-08-01T00:00:02.000Z",
    });

    expect(document.objects[objectId]?.frame).toEqual({
      x: 120,
      y: 140,
      width: 180,
      height: 28,
    });
    expect(next.revision).toBe(2);
    expect(next.updatedAt).toBe("2026-08-01T00:00:02.000Z");
    expect(next.objects[objectId]?.frame).toEqual(frame);
    expect(next.objectOrderByPage[document.pages[0]!.id]).toEqual([objectId]);
  });

  it("updates text object content immutably without changing frame or z-order", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_test");
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
      now: "2026-08-01T00:00:01.000Z",
    });

    const next = updateTextObjectContent(document, {
      objectId,
      text: " Updated text ",
      now: "2026-08-01T00:00:02.000Z",
    });

    expect(document.objects[objectId]).toMatchObject({ text: "Text" });
    expect(next.revision).toBe(2);
    expect(next.updatedAt).toBe("2026-08-01T00:00:02.000Z");
    expect(next.objects[objectId]).toMatchObject({
      text: "Updated text",
      frame: document.objects[objectId]?.frame,
    });
    expect(next.objectOrderByPage[document.pages[0]!.id]).toEqual([objectId]);
  });

  it("does not create a new revision when text content is unchanged", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_test");
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
      now: "2026-08-01T00:00:01.000Z",
    });

    const next = updateTextObjectContent(document, {
      objectId,
      text: " Text ",
      now: "2026-08-01T00:00:02.000Z",
    });

    expect(next).toBe(document);
  });

  it("updates text object appearance immutably without changing text, frame, or z-order", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_test");
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
      now: "2026-08-01T00:00:01.000Z",
    });

    const next = updateTextObjectAppearance(document, {
      objectId,
      fontFamily: "arial",
      fontWeight: "bold",
      fontSize: 2,
      color: {
        red: 1,
        green: 0,
        blue: 0.2,
        alpha: asUnitInterval(1),
      },
      horizontalAlignment: "center",
      now: "2026-08-01T00:00:02.000Z",
    });

    expect(document.objects[objectId]).toMatchObject({
      text: "Text",
      font: { family: "helvetica" },
      fontSize: 14,
      horizontalAlignment: "left",
    });
    expect(next.revision).toBe(2);
    expect(next.updatedAt).toBe("2026-08-01T00:00:02.000Z");
    expect(next.objects[objectId]).toMatchObject({
      text: "Text",
      frame: document.objects[objectId]?.frame,
      font: { family: "arial", weight: "bold" },
      fontSize: 2,
      color: {
        red: 1,
        green: 0,
        blue: 0.2,
        alpha: 1,
      },
      horizontalAlignment: "center",
    });
    expect(next.objectOrderByPage[document.pages[0]!.id]).toEqual([objectId]);
  });

  it("duplicates an object with a fresh id, preserved content, and deterministic z-order", () => {
    const sourceObjectId = unsafeBrand<string, "ObjectId">("object_source");
    const duplicateObjectId = unsafeBrand<string, "ObjectId">("object_duplicate");
    const document = updateTextObjectAppearance(
      updateTextObjectContent(
        addTextObject(createDocument(), {
          objectId: sourceObjectId,
          pageIndex: 0,
          frame: {
            x: asPdfPoint(120),
            y: asPdfPoint(140),
            width: asPdfPoint(180),
            height: asPdfPoint(28),
          },
          text: "Text",
          now: "2026-08-01T00:00:01.000Z",
        }),
        {
          objectId: sourceObjectId,
          text: "Updated text",
          now: "2026-08-01T00:00:02.000Z",
        },
      ),
      {
        objectId: sourceObjectId,
        fontFamily: "courier",
        fontWeight: "bold",
        fontSize: 24,
        color: {
          red: 1,
          green: 0,
          blue: 0.2,
          alpha: asUnitInterval(1),
        },
        horizontalAlignment: "center",
        now: "2026-08-01T00:00:03.000Z",
      },
    );

    const frame = {
      x: asPdfPoint(136),
      y: asPdfPoint(156),
      width: asPdfPoint(180),
      height: asPdfPoint(28),
    };
    const next = duplicateObject(document, {
      sourceObjectId,
      objectId: duplicateObjectId,
      frame,
      now: "2026-08-01T00:00:04.000Z",
    });

    expect(document.objects[duplicateObjectId]).toBeUndefined();
    expect(next.revision).toBe(4);
    expect(next.updatedAt).toBe("2026-08-01T00:00:04.000Z");
    expect(next.objects[duplicateObjectId]).toMatchObject({
      id: duplicateObjectId,
      pageId: document.objects[sourceObjectId]?.pageId,
      text: "Updated text",
      frame,
      font: { family: "courier" },
      fontSize: 24,
      horizontalAlignment: "center",
      createdAtRevision: 4,
    });
    expect(next.objectOrderByPage[document.pages[0]!.id]).toEqual([
      sourceObjectId,
      duplicateObjectId,
    ]);
  });
});
