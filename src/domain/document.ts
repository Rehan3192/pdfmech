import type {
  AssetId,
  Degrees,
  DocumentId,
  FieldId,
  ObjectId,
  PageId,
  PdfPoint,
  SourceId,
  UnitInterval,
} from "./primitives";
import type { CanonicalFrame, SourcePageGeometry } from "./geometry";

export interface EditorDocument {
  readonly schemaVersion: number;
  readonly id: DocumentId;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sources: Readonly<Record<SourceId, SourceDocument>>;
  readonly pages: readonly PageInstance[];
  readonly objects: Readonly<Record<ObjectId, EditObject>>;
  readonly objectOrderByPage: Readonly<Record<PageId, readonly ObjectId[]>>;
  readonly formValues: Readonly<Record<FieldId, SupportedFormValue>>;
  readonly assets: Readonly<Record<AssetId, AssetDescriptor>>;
  readonly warnings: readonly DocumentWarning[];
}

export interface SourceDocument {
  readonly id: SourceId;
  readonly fingerprint: string;
  readonly originalName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly encryption: "none" | "unsupported" | "unknown";
  readonly signatureState: "none" | "present" | "unknown";
  readonly capabilities: DocumentCapabilities;
}

export interface DocumentCapabilities {
  readonly canRender: boolean;
  readonly canExportOverlay: boolean;
  readonly canFillSupportedForms: boolean;
  readonly unsupportedReasons: readonly string[];
}

export interface PageInstance {
  readonly id: PageId;
  readonly sourceId: SourceId;
  readonly sourcePageIndex: number;
  readonly userRotation: Degrees;
  readonly geometry: SourcePageGeometry;
}

export type EditObject =
  | TextObject
  | WhiteoutObject
  | RedactionObject
  | ImageObject
  | SignatureObject
  | RectangleObject
  | EllipseObject
  | LineObject
  | CheckmarkObject
  | HighlightObject
  | InkObject;

export interface EditObjectBase {
  readonly id: ObjectId;
  readonly pageId: PageId;
  readonly frame: CanonicalFrame;
  readonly rotation: number;
  readonly opacity: UnitInterval;
  readonly locked: boolean;
  readonly createdAtRevision: number;
}

export interface TextObject extends EditObjectBase {
  readonly kind: "text";
  readonly text: string;
  readonly font: FontReference;
  readonly fontSize: PdfPoint;
  readonly color: RgbaColor;
  readonly horizontalAlignment: "left" | "center" | "right";
  readonly lineHeight: number;
}

export interface WhiteoutObject extends EditObjectBase {
  readonly kind: "whiteout";
  readonly color: RgbaColor;
}

export interface RedactionObject extends EditObjectBase {
  readonly kind: "redaction";
  readonly color: RgbaColor;
}

export interface ImageObject extends EditObjectBase {
  readonly kind: "image";
  readonly assetId: AssetId;
}

export interface SignatureObject extends EditObjectBase {
  readonly kind: "signature";
  readonly assetId: AssetId;
}

export interface RectangleObject extends EditObjectBase {
  readonly kind: "rectangle";
  readonly stroke: RgbaColor;
  readonly fill: RgbaColor | null;
  readonly strokeWidth: PdfPoint;
}

export interface EllipseObject extends EditObjectBase {
  readonly kind: "ellipse";
  readonly stroke: RgbaColor;
  readonly fill: RgbaColor | null;
  readonly strokeWidth: PdfPoint;
}

export interface LineObject extends EditObjectBase {
  readonly kind: "line";
  readonly stroke: RgbaColor;
  readonly strokeWidth: PdfPoint;
}

export interface CheckmarkObject extends EditObjectBase {
  readonly kind: "checkmark";
  readonly color: RgbaColor;
  readonly strokeWidth: PdfPoint;
}

export interface HighlightObject extends EditObjectBase {
  readonly kind: "highlight";
  readonly color: RgbaColor;
}

export interface InkObject extends EditObjectBase {
  readonly kind: "ink";
  readonly paths: readonly (readonly CanonicalPointLike[])[];
  readonly stroke: RgbaColor;
  readonly strokeWidth: PdfPoint;
}

export interface CanonicalPointLike {
  readonly x: PdfPoint;
  readonly y: PdfPoint;
}

export interface FontReference {
  readonly family:
    | "arial"
    | "helvetica"
    | "times"
    | "courier"
    | "roboto"
    | "open-sans"
    | "montserrat"
    | "lato"
    | "poppins"
    | "inter"
    | "playfair-display"
    | "source-sans-pro";
  readonly weight: "regular" | "bold";
  readonly style: "normal" | "italic";
}

export interface RgbaColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: UnitInterval;
}

export type SupportedFormValue =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "checkbox"; readonly checked: boolean }
  | { readonly kind: "radio"; readonly selectedValue: string | null }
  | { readonly kind: "dropdown"; readonly selectedValue: string | null };

export interface AssetDescriptor {
  readonly id: AssetId;
  readonly mediaType: "image/png" | "image/jpeg";
  readonly byteLength: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly sha256: string;
}

export interface DocumentWarning {
  readonly code:
    | "UNSUPPORTED_FEATURE"
    | "SIGNATURE_PRESENT"
    | "ENCRYPTION_UNSUPPORTED"
    | "EXPORT_MAY_DROP_FEATURES";
  readonly blocking: boolean;
}

export function createEmptyEditorDocument(input: {
  readonly id: DocumentId;
  readonly createdAt: string;
}): EditorDocument {
  return {
    schemaVersion: 1,
    id: input.id,
    revision: 0,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    sources: {},
    pages: [],
    objects: {},
    objectOrderByPage: {},
    formValues: {},
    assets: {},
    warnings: [],
  };
}
