import type {
  EditorDocument,
  EditObject,
  FontReference,
  RedactionObject,
  RgbaColor,
  TextObject,
  WhiteoutObject,
} from "./document";
import type { CanonicalFrame } from "./geometry";
import { asPdfPoint, asUnitInterval } from "./primitives";
import type { ObjectId } from "./primitives";

type TextAlignment = TextObject["horizontalAlignment"];
type TextFontFamily = FontReference["family"];
type TextFontWeight = FontReference["weight"];

const textFontFamilies = [
  "arial",
  "helvetica",
  "times",
  "courier",
  "roboto",
  "open-sans",
  "montserrat",
  "lato",
  "poppins",
  "inter",
  "playfair-display",
  "source-sans-pro",
] as const;
const textFontWeights = ["regular", "bold"] as const;
const textAlignments = ["left", "center", "right"] as const;
const MINIMUM_TEXT_FONT_SIZE = 2;
const MAXIMUM_TEXT_FONT_SIZE = 96;

const defaultTextColor: RgbaColor = {
  red: 0.07,
  green: 0.09,
  blue: 0.15,
  alpha: asUnitInterval(1),
};
const defaultWhiteoutColor: RgbaColor = {
  red: 1,
  green: 1,
  blue: 1,
  alpha: asUnitInterval(1),
};
const defaultRedactionColor: RgbaColor = {
  red: 0,
  green: 0,
  blue: 0,
  alpha: asUnitInterval(1),
};

export interface AddTextObjectInput {
  readonly objectId: ObjectId;
  readonly pageIndex: number;
  readonly frame: CanonicalFrame;
  readonly text: string;
  readonly now: string;
}

export interface AddWhiteoutObjectInput {
  readonly objectId: ObjectId;
  readonly pageIndex: number;
  readonly frame: CanonicalFrame;
  readonly now: string;
}

export interface AddRedactionObjectInput {
  readonly objectId: ObjectId;
  readonly pageIndex: number;
  readonly frame: CanonicalFrame;
  readonly now: string;
}

export interface MoveObjectInput {
  readonly objectId: ObjectId;
  readonly frame: CanonicalFrame;
  readonly now: string;
}

export interface ResizeObjectInput {
  readonly objectId: ObjectId;
  readonly frame: CanonicalFrame;
  readonly now: string;
}

export interface UpdateTextObjectContentInput {
  readonly objectId: ObjectId;
  readonly text: string;
  readonly now: string;
}

export interface UpdateTextObjectAppearanceInput {
  readonly objectId: ObjectId;
  readonly fontFamily: TextFontFamily;
  readonly fontWeight: TextFontWeight;
  readonly fontSize: number;
  readonly color: RgbaColor;
  readonly horizontalAlignment: TextAlignment;
  readonly now: string;
}

export interface UpdateWhiteoutObjectAppearanceInput {
  readonly objectId: ObjectId;
  readonly color: RgbaColor;
  readonly now: string;
}

export interface UpdateRedactionObjectAppearanceInput {
  readonly objectId: ObjectId;
  readonly color: RgbaColor;
  readonly now: string;
}

export interface DuplicateObjectInput {
  readonly sourceObjectId: ObjectId;
  readonly objectId: ObjectId;
  readonly frame: CanonicalFrame;
  readonly now: string;
}

function assertValidFrame(frame: CanonicalFrame): void {
  const values = [frame.x, frame.y, frame.width, frame.height];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError("Object frame must contain finite coordinates.");
  }

  if (frame.width <= 0 || frame.height <= 0) {
    throw new RangeError("Object frame must have positive dimensions.");
  }
}

function normalizeTextContent(text: string): string {
  const normalizedText = text.trim();
  if (normalizedText.length === 0) {
    throw new Error("Text object content is required.");
  }

  return normalizedText;
}

function assertTextFontFamily(fontFamily: TextFontFamily): void {
  if (!textFontFamilies.includes(fontFamily)) {
    throw new RangeError("Text font family is not supported.");
  }
}

function assertTextFontWeight(fontWeight: TextFontWeight): void {
  if (!textFontWeights.includes(fontWeight)) {
    throw new RangeError("Text font weight is not supported.");
  }
}

function assertTextAlignment(alignment: TextAlignment): void {
  if (!textAlignments.includes(alignment)) {
    throw new RangeError("Text alignment is not supported.");
  }
}

function normalizeTextFontSize(fontSize: number): ReturnType<typeof asPdfPoint> {
  if (
    !Number.isFinite(fontSize) ||
    fontSize < MINIMUM_TEXT_FONT_SIZE ||
    fontSize > MAXIMUM_TEXT_FONT_SIZE
  ) {
    throw new RangeError(
      `Text font size must be between ${MINIMUM_TEXT_FONT_SIZE} and ${MAXIMUM_TEXT_FONT_SIZE} points.`,
    );
  }

  return asPdfPoint(fontSize, "text font size");
}

function assertTextColor(color: RgbaColor): void {
  const values = [color.red, color.green, color.blue];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new RangeError("Text color channels must be between 0 and 1.");
  }

  asUnitInterval(color.alpha, "text color alpha");
}

function assertWhiteoutColor(color: RgbaColor): void {
  const values = [color.red, color.green, color.blue];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new RangeError("Whiteout color channels must be between 0 and 1.");
  }

  asUnitInterval(color.alpha, "whiteout color alpha");
}

function assertRedactionColor(color: RgbaColor): void {
  const values = [color.red, color.green, color.blue];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new RangeError("Redaction color channels must be between 0 and 1.");
  }

  asUnitInterval(color.alpha, "redaction color alpha");
}

function insertObjectAfter(
  order: readonly ObjectId[],
  sourceObjectId: ObjectId,
  objectId: ObjectId,
): readonly ObjectId[] {
  const sourceIndex = order.indexOf(sourceObjectId);
  if (sourceIndex === -1) {
    return [...order, objectId];
  }

  return [
    ...order.slice(0, sourceIndex + 1),
    objectId,
    ...order.slice(sourceIndex + 1),
  ];
}

export function addTextObject(
  document: EditorDocument,
  input: AddTextObjectInput,
): EditorDocument {
  const page = document.pages[input.pageIndex];
  if (page === undefined) {
    throw new RangeError(`Page ${input.pageIndex + 1} is not available.`);
  }

  const text = normalizeTextContent(input.text);

  if (document.objects[input.objectId] !== undefined) {
    throw new Error("Object ID already exists.");
  }

  assertValidFrame(input.frame);

  const nextRevision = document.revision + 1;
  const object: TextObject = {
    id: input.objectId,
    pageId: page.id,
    kind: "text",
    frame: input.frame,
    rotation: 0,
    opacity: asUnitInterval(1),
    locked: false,
    createdAtRevision: nextRevision,
    text,
    font: {
      family: "helvetica",
      weight: "regular",
      style: "normal",
    },
    fontSize: asPdfPoint(14),
    color: defaultTextColor,
    horizontalAlignment: "left",
    lineHeight: 1.2,
  };

  return {
    ...document,
    revision: nextRevision,
    updatedAt: input.now,
    objects: {
      ...document.objects,
      [object.id]: object,
    },
    objectOrderByPage: {
      ...document.objectOrderByPage,
      [page.id]: [...(document.objectOrderByPage[page.id] ?? []), object.id],
    },
  };
}

export function addWhiteoutObject(
  document: EditorDocument,
  input: AddWhiteoutObjectInput,
): EditorDocument {
  const page = document.pages[input.pageIndex];
  if (page === undefined) {
    throw new RangeError(`Page ${input.pageIndex + 1} is not available.`);
  }

  if (document.objects[input.objectId] !== undefined) {
    throw new Error("Object ID already exists.");
  }

  assertValidFrame(input.frame);

  const nextRevision = document.revision + 1;
  const object: WhiteoutObject = {
    id: input.objectId,
    pageId: page.id,
    kind: "whiteout",
    frame: input.frame,
    rotation: 0,
    opacity: asUnitInterval(1),
    locked: false,
    createdAtRevision: nextRevision,
    color: defaultWhiteoutColor,
  };

  return {
    ...document,
    revision: nextRevision,
    updatedAt: input.now,
    objects: {
      ...document.objects,
      [object.id]: object,
    },
    objectOrderByPage: {
      ...document.objectOrderByPage,
      [page.id]: [...(document.objectOrderByPage[page.id] ?? []), object.id],
    },
  };
}

export function addRedactionObject(
  document: EditorDocument,
  input: AddRedactionObjectInput,
): EditorDocument {
  const page = document.pages[input.pageIndex];
  if (page === undefined) {
    throw new RangeError(`Page ${input.pageIndex + 1} is not available.`);
  }

  if (document.objects[input.objectId] !== undefined) {
    throw new Error("Object ID already exists.");
  }

  assertValidFrame(input.frame);

  const nextRevision = document.revision + 1;
  const object: RedactionObject = {
    id: input.objectId,
    pageId: page.id,
    kind: "redaction",
    frame: input.frame,
    color: defaultRedactionColor,
    rotation: 0,
    opacity: asUnitInterval(1),
    locked: false,
    createdAtRevision: nextRevision,
  };

  return {
    ...document,
    revision: nextRevision,
    updatedAt: input.now,
    objects: {
      ...document.objects,
      [object.id]: object,
    },
    objectOrderByPage: {
      ...document.objectOrderByPage,
      [page.id]: [...(document.objectOrderByPage[page.id] ?? []), object.id],
    },
  };
}

export function updateTextObjectContent(
  document: EditorDocument,
  input: UpdateTextObjectContentInput,
): EditorDocument {
  const target = document.objects[input.objectId];
  if (target === undefined || target.kind !== "text") {
    return document;
  }

  const text = normalizeTextContent(input.text);
  if (target.text === text) {
    return document;
  }

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: input.now,
    objects: {
      ...document.objects,
      [input.objectId]: {
        ...target,
        text,
      },
    },
  };
}

export function updateTextObjectAppearance(
  document: EditorDocument,
  input: UpdateTextObjectAppearanceInput,
): EditorDocument {
  const target = document.objects[input.objectId];
  if (target === undefined || target.kind !== "text") {
    return document;
  }

  assertTextFontFamily(input.fontFamily);
  assertTextFontWeight(input.fontWeight);
  assertTextAlignment(input.horizontalAlignment);
  assertTextColor(input.color);
  const fontSize = normalizeTextFontSize(input.fontSize);

  if (
    target.font.family === input.fontFamily &&
    target.font.weight === input.fontWeight &&
    target.fontSize === fontSize &&
    target.color.red === input.color.red &&
    target.color.green === input.color.green &&
    target.color.blue === input.color.blue &&
    target.color.alpha === input.color.alpha &&
    target.horizontalAlignment === input.horizontalAlignment
  ) {
    return document;
  }

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: input.now,
    objects: {
      ...document.objects,
      [input.objectId]: {
        ...target,
        font: {
          ...target.font,
          family: input.fontFamily,
          weight: input.fontWeight,
        },
        fontSize,
        color: input.color,
        horizontalAlignment: input.horizontalAlignment,
      },
    },
  };
}

export function updateWhiteoutObjectAppearance(
  document: EditorDocument,
  input: UpdateWhiteoutObjectAppearanceInput,
): EditorDocument {
  const target = document.objects[input.objectId];
  if (target === undefined || target.kind !== "whiteout") {
    return document;
  }

  assertWhiteoutColor(input.color);

  if (
    target.color.red === input.color.red &&
    target.color.green === input.color.green &&
    target.color.blue === input.color.blue &&
    target.color.alpha === input.color.alpha
  ) {
    return document;
  }

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: input.now,
    objects: {
      ...document.objects,
      [input.objectId]: {
        ...target,
        color: input.color,
      },
    },
  };
}

export function updateRedactionObjectAppearance(
  document: EditorDocument,
  input: UpdateRedactionObjectAppearanceInput,
): EditorDocument {
  const target = document.objects[input.objectId];
  if (target === undefined || target.kind !== "redaction") {
    return document;
  }

  assertRedactionColor(input.color);

  if (
    target.color.red === input.color.red &&
    target.color.green === input.color.green &&
    target.color.blue === input.color.blue &&
    target.color.alpha === input.color.alpha
  ) {
    return document;
  }

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: input.now,
    objects: {
      ...document.objects,
      [input.objectId]: {
        ...target,
        color: input.color,
      },
    },
  };
}

export function duplicateObject(
  document: EditorDocument,
  input: DuplicateObjectInput,
): EditorDocument {
  const target = document.objects[input.sourceObjectId];
  if (target === undefined) {
    return document;
  }

  if (document.objects[input.objectId] !== undefined) {
    throw new Error("Object ID already exists.");
  }

  assertValidFrame(input.frame);

  const nextRevision = document.revision + 1;
  return {
    ...document,
    revision: nextRevision,
    updatedAt: input.now,
    objects: {
      ...document.objects,
      [input.objectId]: {
        ...target,
        id: input.objectId,
        frame: input.frame,
        createdAtRevision: nextRevision,
      },
    },
    objectOrderByPage: {
      ...document.objectOrderByPage,
      [target.pageId]: insertObjectAfter(
        document.objectOrderByPage[target.pageId] ?? [],
        target.id,
        input.objectId,
      ),
    },
  };
}

export function moveObject(
  document: EditorDocument,
  input: MoveObjectInput,
): EditorDocument {
  const target = document.objects[input.objectId];
  if (target === undefined) {
    return document;
  }

  assertValidFrame(input.frame);

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: input.now,
    objects: {
      ...document.objects,
      [input.objectId]: {
        ...target,
        frame: input.frame,
      },
    },
  };
}

export function resizeObject(
  document: EditorDocument,
  input: ResizeObjectInput,
): EditorDocument {
  const target = document.objects[input.objectId];
  if (target === undefined) {
    return document;
  }

  assertValidFrame(input.frame);

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: input.now,
    objects: {
      ...document.objects,
      [input.objectId]: {
        ...target,
        frame: input.frame,
      },
    },
  };
}

export function deleteObject(
  document: EditorDocument,
  objectId: ObjectId,
  now: string,
): EditorDocument {
  const target = document.objects[objectId];
  if (target === undefined) {
    return document;
  }

  const nextObjects: Record<ObjectId, EditObject> = { ...document.objects };
  delete nextObjects[objectId];

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: now,
    objects: nextObjects,
    objectOrderByPage: {
      ...document.objectOrderByPage,
      [target.pageId]: (document.objectOrderByPage[target.pageId] ?? []).filter(
        (candidate) => candidate !== objectId,
      ),
    },
  };
}
