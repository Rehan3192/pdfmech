import type { EditorDocument } from "../domain/document";

const DEFAULT_HISTORY_LIMIT = 100;
const MAX_HISTORY_LIMIT = 500;

export interface DocumentHistory {
  readonly past: readonly EditorDocument[];
  readonly present: EditorDocument | null;
  readonly future: readonly EditorDocument[];
  readonly limit: number;
}

export interface CreateDocumentHistoryInput {
  readonly document?: EditorDocument | null;
  readonly limit?: number;
}

export function createDocumentHistory(
  input: CreateDocumentHistoryInput = {},
): DocumentHistory {
  return {
    past: [],
    present: input.document ?? null,
    future: [],
    limit: normalizeHistoryLimit(input.limit ?? DEFAULT_HISTORY_LIMIT),
  };
}

export function resetDocumentHistory(
  history: DocumentHistory,
  document: EditorDocument | null,
): DocumentHistory {
  return {
    past: [],
    present: document,
    future: [],
    limit: history.limit,
  };
}

export function commitDocumentChange(
  history: DocumentHistory,
  nextDocument: EditorDocument,
): DocumentHistory {
  if (documentsRepresentSameRevision(history.present, nextDocument)) {
    return history;
  }

  return {
    past: trimToHistoryLimit(
      history.present === null
        ? history.past
        : [...history.past, history.present],
      history.limit,
    ),
    present: nextDocument,
    future: [],
    limit: history.limit,
  };
}

export function undoDocumentChange(history: DocumentHistory): DocumentHistory {
  const previousDocument = history.past.at(-1);
  if (previousDocument === undefined) {
    return history;
  }

  return {
    past: history.past.slice(0, -1),
    present: previousDocument,
    future:
      history.present === null
        ? history.future
        : [history.present, ...history.future],
    limit: history.limit,
  };
}

export function redoDocumentChange(history: DocumentHistory): DocumentHistory {
  const [nextDocument, ...remainingFuture] = history.future;
  if (nextDocument === undefined) {
    return history;
  }

  return {
    past: trimToHistoryLimit(
      history.present === null
        ? history.past
        : [...history.past, history.present],
      history.limit,
    ),
    present: nextDocument,
    future: remainingFuture,
    limit: history.limit,
  };
}

export function canUndoDocumentChange(history: DocumentHistory): boolean {
  return history.past.length > 0;
}

export function canRedoDocumentChange(history: DocumentHistory): boolean {
  return history.future.length > 0;
}

function documentsRepresentSameRevision(
  currentDocument: EditorDocument | null,
  nextDocument: EditorDocument,
): boolean {
  return (
    currentDocument !== null &&
    currentDocument.id === nextDocument.id &&
    currentDocument.revision === nextDocument.revision
  );
}

function trimToHistoryLimit(
  documents: readonly EditorDocument[],
  limit: number,
): readonly EditorDocument[] {
  return documents.slice(Math.max(0, documents.length - limit));
}

function normalizeHistoryLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_LIMIT) {
    throw new RangeError(
      `Document history limit must be an integer between 1 and ${MAX_HISTORY_LIMIT}.`,
    );
  }

  return limit;
}
