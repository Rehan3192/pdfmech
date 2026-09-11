import type { EditorDocument } from "../domain/document";
import type { AssetId, DocumentId, SourceId } from "../domain/primitives";

export interface RecoveryCheckpoint {
  readonly schemaVersion: number;
  readonly documentId: DocumentId;
  readonly documentRevision: number;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly sourceManifest: readonly RecoverySourceEntry[];
  readonly assetManifest: readonly RecoveryAssetEntry[];
  readonly documentState: EditorDocument;
  readonly checksum: string;
}

export interface RecoverySourceEntry {
  readonly sourceId: SourceId;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface RecoveryAssetEntry {
  readonly assetId: AssetId;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface RecoverySummary {
  readonly documentId: DocumentId;
  readonly documentRevision: number;
  readonly updatedAt: string;
  readonly expiresAt: string;
}

export interface RecoverySourceBlob {
  readonly sourceId: SourceId;
  readonly originalName: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly blob: Blob;
}

export interface StorageEstimate {
  readonly quotaBytes: number | null;
  readonly usedBytes: number | null;
}

export type SaveOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "quota" | "unavailable" };

export interface RecoveryStore {
  estimateCapacity(): Promise<StorageEstimate>;
  save(checkpoint: RecoveryCheckpoint): Promise<SaveOutcome>;
  load(documentId: DocumentId): Promise<RecoveryCheckpoint | null>;
  saveSourceBlob(source: RecoverySourceBlob): Promise<SaveOutcome>;
  loadSourceBlob(sourceId: SourceId): Promise<RecoverySourceBlob | null>;
  listRecoverable(): Promise<readonly RecoverySummary[]>;
  delete(documentId: DocumentId): Promise<void>;
  deleteExpired(now: string): Promise<number>;
}
