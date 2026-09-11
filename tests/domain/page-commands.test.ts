import { describe, expect, it } from "vitest";

import { addTextObject } from "../../src/domain/edit-object-commands";
import { createEmptyEditorDocument } from "../../src/domain/document";
import { deletePage, movePage, rotatePage } from "../../src/domain/page-commands";
import { asPdfPoint } from "../../src/domain/primitives";
import { unsafeBrand } from "../../src/shared/brand";
import type { EditorDocument, PageInstance } from "../../src/domain/document";

function createPage(id: string, sourcePageIndex: number): PageInstance {
  return {
    id: unsafeBrand(id),
    sourceId: unsafeBrand("source_test"),
    sourcePageIndex,
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
}

function createDocument(): EditorDocument {
  const firstPage = createPage("page_first", 0);
  const secondPage = createPage("page_second", 1);
  const thirdPage = createPage("page_third", 2);

  return {
    ...createEmptyEditorDocument({
      id: unsafeBrand("document_page_ops"),
      createdAt: "2026-08-01T00:00:00.000Z",
    }),
    pages: [firstPage, secondPage, thirdPage],
    objectOrderByPage: {
      [firstPage.id]: [],
      [secondPage.id]: [],
      [thirdPage.id]: [],
    },
  };
}

describe("page commands", () => {
  it("rotates one page immutably and normalizes rotation", () => {
    const document = createDocument();
    const next = rotatePage(document, {
      pageIndex: 1,
      deltaDegrees: 90,
      now: "2026-08-01T00:00:01.000Z",
    });

    expect(document.pages[1]?.userRotation).toBe(0);
    expect(next.revision).toBe(1);
    expect(next.updatedAt).toBe("2026-08-01T00:00:01.000Z");
    expect(next.pages.map((page) => page.id)).toEqual([
      "page_first",
      "page_second",
      "page_third",
    ]);
    expect(next.pages[1]?.userRotation).toBe(90);

    const rotatedAgain = rotatePage(next, {
      pageIndex: 1,
      deltaDegrees: 270,
      now: "2026-08-01T00:00:02.000Z",
    });
    expect(rotatedAgain.pages[1]?.userRotation).toBe(0);
  });

  it("does not create a new revision for a no-op full page rotation", () => {
    const document = createDocument();

    expect(
      rotatePage(document, {
        pageIndex: 0,
        deltaDegrees: 360,
        now: "2026-08-01T00:00:01.000Z",
      }),
    ).toBe(document);
  });

  it("moves a page immutably while preserving page ids and object order", () => {
    const objectId = unsafeBrand<string, "ObjectId">("object_on_second_page");
    const document = addTextObject(createDocument(), {
      objectId,
      pageIndex: 1,
      frame: {
        x: asPdfPoint(120),
        y: asPdfPoint(140),
        width: asPdfPoint(180),
        height: asPdfPoint(28),
      },
      text: "Text",
      now: "2026-08-01T00:00:01.000Z",
    });

    const next = movePage(document, {
      fromIndex: 1,
      toIndex: 0,
      now: "2026-08-01T00:00:02.000Z",
    });

    expect(document.pages.map((page) => page.id)).toEqual([
      "page_first",
      "page_second",
      "page_third",
    ]);
    expect(next.revision).toBe(2);
    expect(next.pages.map((page) => page.id)).toEqual([
      "page_second",
      "page_first",
      "page_third",
    ]);
    expect(next.objectOrderByPage[document.pages[1]!.id]).toEqual([objectId]);
    expect(next.objects[objectId]?.pageId).toBe(document.pages[1]!.id);
  });

  it("deletes a page and its page-owned objects", () => {
    const secondPageObjectId = unsafeBrand<string, "ObjectId">(
      "object_on_deleted_page",
    );
    const thirdPageObjectId = unsafeBrand<string, "ObjectId">(
      "object_on_kept_page",
    );
    const document = addTextObject(
      addTextObject(createDocument(), {
        objectId: secondPageObjectId,
        pageIndex: 1,
        frame: {
          x: asPdfPoint(120),
          y: asPdfPoint(140),
          width: asPdfPoint(180),
          height: asPdfPoint(28),
        },
        text: "Deleted page text",
        now: "2026-08-01T00:00:01.000Z",
      }),
      {
        objectId: thirdPageObjectId,
        pageIndex: 2,
        frame: {
          x: asPdfPoint(120),
          y: asPdfPoint(140),
          width: asPdfPoint(180),
          height: asPdfPoint(28),
        },
        text: "Kept page text",
        now: "2026-08-01T00:00:02.000Z",
      },
    );
    const deletedPageId = document.pages[1]!.id;

    const next = deletePage(document, {
      pageIndex: 1,
      now: "2026-08-01T00:00:03.000Z",
    });

    expect(next.revision).toBe(3);
    expect(next.pages.map((page) => page.id)).toEqual([
      "page_first",
      "page_third",
    ]);
    expect(next.objects[secondPageObjectId]).toBeUndefined();
    expect(next.objects[thirdPageObjectId]).toBeDefined();
    expect(next.objectOrderByPage[deletedPageId]).toBeUndefined();
    expect(next.objectOrderByPage[document.pages[2]!.id]).toEqual([
      thirdPageObjectId,
    ]);
  });

  it("rejects invalid page operation inputs", () => {
    const document = createDocument();

    expect(() =>
      rotatePage(document, {
        pageIndex: 9,
        deltaDegrees: 90,
        now: "2026-08-01T00:00:01.000Z",
      }),
    ).toThrow("Page 10 is not available.");
    expect(() =>
      rotatePage(document, {
        pageIndex: 0,
        deltaDegrees: 45,
        now: "2026-08-01T00:00:01.000Z",
      }),
    ).toThrow("multiple of 90");
    expect(() =>
      movePage(document, {
        fromIndex: -1,
        toIndex: 0,
        now: "2026-08-01T00:00:01.000Z",
      }),
    ).toThrow("non-negative integer");
    expect(() =>
      deletePage(document, {
        pageIndex: 3,
        now: "2026-08-01T00:00:01.000Z",
      }),
    ).toThrow("Page 4 is not available.");
  });
});
