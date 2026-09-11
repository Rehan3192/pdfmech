import type { EditorDocument, PageInstance } from "./document";
import { normalizeDegrees } from "./primitives";
import type { ObjectId, PageId } from "./primitives";

export interface RotatePageInput {
  readonly pageIndex: number;
  readonly deltaDegrees: number;
  readonly now: string;
}

export interface MovePageInput {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly now: string;
}

export interface DeletePageInput {
  readonly pageIndex: number;
  readonly now: string;
}

export function rotatePage(
  document: EditorDocument,
  input: RotatePageInput,
): EditorDocument {
  const page = document.pages[input.pageIndex];
  if (page === undefined) {
    throw new RangeError(`Page ${input.pageIndex + 1} is not available.`);
  }

  const userRotation = normalizeDegrees(page.userRotation + input.deltaDegrees);
  if (userRotation === page.userRotation) {
    return document;
  }

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: input.now,
    pages: replacePage(document.pages, input.pageIndex, {
      ...page,
      userRotation,
    }),
  };
}

export function movePage(
  document: EditorDocument,
  input: MovePageInput,
): EditorDocument {
  assertPageIndex(document, input.fromIndex);
  assertPageIndex(document, input.toIndex);

  if (input.fromIndex === input.toIndex) {
    return document;
  }

  const pages = [...document.pages];
  const [page] = pages.splice(input.fromIndex, 1);
  if (page === undefined) {
    throw new RangeError(`Page ${input.fromIndex + 1} is not available.`);
  }
  pages.splice(input.toIndex, 0, page);

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: input.now,
    pages,
  };
}

export function deletePage(
  document: EditorDocument,
  input: DeletePageInput,
): EditorDocument {
  const page = document.pages[input.pageIndex];
  if (page === undefined) {
    throw new RangeError(`Page ${input.pageIndex + 1} is not available.`);
  }

  const removedObjectIds = new Set(document.objectOrderByPage[page.id] ?? []);
  const objects = { ...document.objects };
  for (const objectId of removedObjectIds) {
    delete objects[objectId];
  }

  const objectOrderByPage: Record<PageId, readonly ObjectId[]> = {
    ...document.objectOrderByPage,
  };
  delete objectOrderByPage[page.id];

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: input.now,
    pages: document.pages.filter((candidate) => candidate.id !== page.id),
    objects,
    objectOrderByPage,
  };
}

function assertPageIndex(document: EditorDocument, pageIndex: number): void {
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new RangeError("Page index must be a non-negative integer.");
  }

  if (pageIndex >= document.pages.length) {
    throw new RangeError(`Page ${pageIndex + 1} is not available.`);
  }
}

function replacePage(
  pages: readonly PageInstance[],
  pageIndex: number,
  page: PageInstance,
): readonly PageInstance[] {
  return pages.map((candidate, index) =>
    index === pageIndex ? page : candidate,
  );
}
