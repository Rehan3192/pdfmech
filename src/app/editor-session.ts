import type { EditorDocument } from "../domain/document";
import type { PdfExporter, PdfRenderer, PdfValidator } from "../ports/pdf";
import type { AssetRepository } from "../ports/assets";
import type { IdService } from "../ports/ids";
import type { RecoveryStore } from "../ports/recovery";
import { createDocumentHistory, type DocumentHistory } from "./document-history";

export interface EditorSessionPorts {
  readonly ids: IdService;
  readonly renderer: PdfRenderer;
  readonly exporter: PdfExporter;
  readonly validator: PdfValidator;
  readonly assets: AssetRepository;
  readonly recovery: RecoveryStore;
}

export interface EditorSession {
  readonly document: EditorDocument | null;
  readonly history: DocumentHistory;
  readonly busy: boolean;
}

export function createEmptyEditorSession(): EditorSession {
  return {
    document: null,
    history: createDocumentHistory(),
    busy: false,
  };
}
