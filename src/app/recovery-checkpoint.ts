import type { EditorDocument } from "../domain/document";
import type {
  RecoveryAssetEntry,
  RecoveryCheckpoint,
  RecoverySourceEntry,
} from "../ports/recovery";

const RECOVERY_SCHEMA_VERSION = 1;
const DEFAULT_RECOVERY_TTL_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CreateRecoveryCheckpointInput {
  readonly document: EditorDocument;
  readonly now: string;
  readonly ttlDays?: number;
}

export async function createRecoveryCheckpoint({
  document,
  now,
  ttlDays = DEFAULT_RECOVERY_TTL_DAYS,
}: CreateRecoveryCheckpointInput): Promise<RecoveryCheckpoint> {
  const clonedDocument = structuredClone(document) as EditorDocument;
  const expiresAt = calculateExpiry(now, ttlDays);
  const unsignedCheckpoint = {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    documentId: clonedDocument.id,
    documentRevision: clonedDocument.revision,
    createdAt: now,
    expiresAt,
    sourceManifest: createSourceManifest(clonedDocument),
    assetManifest: createAssetManifest(clonedDocument),
    documentState: clonedDocument,
  };

  return {
    ...unsignedCheckpoint,
    checksum: await sha256Hex(stableStringify(unsignedCheckpoint)),
  };
}

export async function verifyRecoveryCheckpoint(
  checkpoint: RecoveryCheckpoint,
): Promise<boolean> {
  const { checksum, ...unsignedCheckpoint } = checkpoint;
  return checksum === (await sha256Hex(stableStringify(unsignedCheckpoint)));
}

function createSourceManifest(
  document: EditorDocument,
): readonly RecoverySourceEntry[] {
  return Object.values(document.sources).map((source) => ({
    sourceId: source.id,
    sha256: source.fingerprint,
    byteLength: source.byteLength,
  }));
}

function createAssetManifest(
  document: EditorDocument,
): readonly RecoveryAssetEntry[] {
  return Object.values(document.assets).map((asset) => ({
    assetId: asset.id,
    sha256: asset.sha256,
    byteLength: asset.byteLength,
  }));
}

function calculateExpiry(now: string, ttlDays: number): string {
  if (!Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 30) {
    throw new RangeError("Recovery TTL must be an integer between 1 and 30 days.");
  }

  const nowTime = Date.parse(now);
  if (!Number.isFinite(nowTime)) {
    throw new RangeError("Recovery checkpoint time must be a valid ISO date.");
  }

  return new Date(nowTime + ttlDays * MILLISECONDS_PER_DAY).toISOString();
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableStringify(value));
}

function sortForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableStringify);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortForStableStringify(entryValue)]),
    );
  }

  return value;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
