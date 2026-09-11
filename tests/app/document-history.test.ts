import { describe, expect, it } from "vitest";

import {
  canRedoDocumentChange,
  canUndoDocumentChange,
  commitDocumentChange,
  createDocumentHistory,
  redoDocumentChange,
  resetDocumentHistory,
  undoDocumentChange,
} from "../../src/app/document-history";
import { createEmptyEditorDocument } from "../../src/domain/document";
import { unsafeBrand } from "../../src/shared/brand";
import type { EditorDocument } from "../../src/domain/document";

function createDocument(revision: number, id = "document_history_test"): EditorDocument {
  return {
    ...createEmptyEditorDocument({
      id: unsafeBrand(id),
      createdAt: "2026-08-01T00:00:00.000Z",
    }),
    revision,
    updatedAt: `2026-08-01T00:00:${revision.toString().padStart(2, "0")}.000Z`,
  };
}

describe("document history", () => {
  it("starts with an optional present document and no undo or redo states", () => {
    const document = createDocument(0);
    const history = createDocumentHistory({ document });

    expect(history).toMatchObject({
      past: [],
      present: document,
      future: [],
      limit: 100,
    });
    expect(canUndoDocumentChange(history)).toBe(false);
    expect(canRedoDocumentChange(history)).toBe(false);
  });

  it("commits document revisions, then undoes and redoes them in order", () => {
    const first = createDocument(0);
    const second = createDocument(1);
    const third = createDocument(2);
    const committed = commitDocumentChange(
      commitDocumentChange(createDocumentHistory({ document: first }), second),
      third,
    );

    expect(committed.present).toBe(third);
    expect(committed.past).toEqual([first, second]);
    expect(committed.future).toEqual([]);
    expect(canUndoDocumentChange(committed)).toBe(true);

    const undoneOnce = undoDocumentChange(committed);
    expect(undoneOnce.present).toBe(second);
    expect(undoneOnce.past).toEqual([first]);
    expect(undoneOnce.future).toEqual([third]);

    const undoneTwice = undoDocumentChange(undoneOnce);
    expect(undoneTwice.present).toBe(first);
    expect(undoneTwice.past).toEqual([]);
    expect(undoneTwice.future).toEqual([second, third]);
    expect(canUndoDocumentChange(undoneTwice)).toBe(false);

    const redone = redoDocumentChange(undoneTwice);
    expect(redone.present).toBe(second);
    expect(redone.past).toEqual([first]);
    expect(redone.future).toEqual([third]);
  });

  it("does not create history entries for unchanged document revisions", () => {
    const first = createDocument(0);
    const equivalentFirst = createDocument(0);
    const history = commitDocumentChange(
      createDocumentHistory({ document: first }),
      equivalentFirst,
    );

    expect(history.present).toBe(first);
    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
  });

  it("clears redo states when a new change is committed after undo", () => {
    const first = createDocument(0);
    const second = createDocument(1);
    const alternateSecond = createDocument(2);
    const undone = undoDocumentChange(
      commitDocumentChange(createDocumentHistory({ document: first }), second),
    );

    const branched = commitDocumentChange(undone, alternateSecond);

    expect(branched.present).toBe(alternateSecond);
    expect(branched.past).toEqual([first]);
    expect(branched.future).toEqual([]);
    expect(canRedoDocumentChange(branched)).toBe(false);
  });

  it("resets history for a newly opened or cleared document", () => {
    const first = createDocument(0);
    const second = createDocument(1);
    const otherDocument = createDocument(0, "document_other");
    const history = commitDocumentChange(
      createDocumentHistory({ document: first }),
      second,
    );

    const reset = resetDocumentHistory(history, otherDocument);
    expect(reset).toMatchObject({
      past: [],
      present: otherDocument,
      future: [],
      limit: history.limit,
    });

    expect(resetDocumentHistory(reset, null).present).toBeNull();
  });

  it("keeps only the most recent past entries inside the configured limit", () => {
    const initial = createDocument(0);
    const history = [1, 2, 3].reduce(
      (currentHistory, revision) =>
        commitDocumentChange(currentHistory, createDocument(revision)),
      createDocumentHistory({ document: initial, limit: 2 }),
    );

    expect(history.past.map((document) => document.revision)).toEqual([1, 2]);
    expect(history.present?.revision).toBe(3);
  });

  it("rejects unsafe history limits", () => {
    expect(() => createDocumentHistory({ limit: 0 })).toThrow(
      "Document history limit must be an integer",
    );
    expect(() => createDocumentHistory({ limit: 501 })).toThrow(
      "Document history limit must be an integer",
    );
  });
});
