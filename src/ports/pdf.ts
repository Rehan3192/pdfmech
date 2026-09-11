import type {
  EditObject,
  EditorDocument,
  SourceDocument,
} from "../domain/document";
import type {
  AssetId,
  FieldId,
  DocumentId,
  PageId,
  SourceId,
} from "../domain/primitives";
import type { SourcePageGeometry } from "../domain/geometry";
import type { EditorError } from "../domain/errors";

export interface LocalPdfSource {
  readonly sourceId: SourceId;
  readonly blob: Blob;
  readonly originalName: string;
}

export interface InspectionPage {
  readonly sourcePageIndex: number;
  readonly geometry: SourcePageGeometry;
}

export interface InspectionResult extends SourceDocument {
  readonly pages: readonly InspectionPage[];
}

export interface RenderPageRequest {
  readonly sourceId: SourceId;
  readonly sourcePageIndex: number;
  readonly scale: number;
  readonly rotation?: EditorDocument["pages"][number]["userRotation"];
}

export interface RenderedPage {
  readonly bitmap: ImageBitmap;
  readonly width: number;
  readonly height: number;
}

export interface RenderedThumbnail {
  readonly bitmap: ImageBitmap;
  readonly width: number;
  readonly height: number;
}

export interface PdfRenderer {
  inspect(source: LocalPdfSource): Promise<InspectionResult>;
  renderPage(request: RenderPageRequest): Promise<RenderedPage>;
  renderThumbnail(request: RenderPageRequest): Promise<RenderedThumbnail>;
  disposeSource(sourceId: SourceId): Promise<void>;
}

export interface PdfSourceRegistry {
  registerSource(source: LocalPdfSource): Promise<void>;
  disposeSource(sourceId: SourceId): Promise<void>;
}

export interface ExportSnapshot {
  readonly documentId: DocumentId;
  readonly revision: number;
  readonly sources: readonly ExportSourceReference[];
  readonly pages: readonly ExportPage[];
  readonly objectsByPage: Readonly<Record<PageId, readonly EditObject[]>>;
  readonly formValues: Readonly<Record<FieldId, EditorDocument["formValues"][FieldId]>>;
  readonly assets: readonly ExportAssetReference[];
}

export interface ExportSourceReference {
  readonly sourceId: SourceId;
  readonly fingerprint: string;
  readonly byteLength: number;
}

export interface ExportPage {
  readonly pageId: PageId;
  readonly sourceId: SourceId;
  readonly sourcePageIndex: number;
  readonly geometry: SourcePageGeometry;
  readonly userRotation: EditorDocument["pages"][number]["userRotation"];
}

export interface ExportAssetReference {
  readonly assetId: AssetId;
  readonly sha256: string;
}

export interface GeneratedPdf {
  readonly bytes: Uint8Array;
  readonly sha256: string;
}

export interface PdfExporter {
  export(snapshot: ExportSnapshot): Promise<GeneratedPdf>;
}

export interface ValidationRequest {
  readonly documentId: DocumentId;
  readonly revision: number;
  readonly generatedBytes: Uint8Array;
  readonly expectedPages: readonly ValidationExpectedPage[];
}

export interface ValidationExpectedPage {
  readonly sourcePageIndex: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: EditorDocument["pages"][number]["userRotation"];
}

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: EditorError };

export interface PdfValidator {
  validate(request: ValidationRequest): Promise<ValidationResult>;
}
