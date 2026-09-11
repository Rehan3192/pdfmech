import type { DocumentId, SourceId } from "../../domain/primitives";
import type {
  RecoveryCheckpoint,
  RecoverySourceBlob,
  RecoveryStore,
  RecoverySummary,
  SaveOutcome,
  StorageEstimate,
} from "../../ports/recovery";

const DATABASE_NAME = "privacy-pdf-editor-recovery";
const DATABASE_VERSION = 2;
const CHECKPOINT_STORE = "checkpoints";
const SOURCE_BLOB_STORE = "sourceBlobs";

export interface IndexedDbRecoveryStoreOptions {
  readonly indexedDb?: IDBFactory;
  readonly storageManager?: StorageManager;
}

export function createIndexedDbRecoveryStore(
  options: IndexedDbRecoveryStoreOptions = {},
): RecoveryStore {
  const indexedDb = options.indexedDb ?? globalThis.indexedDB;
  const storageManager = options.storageManager ?? navigator.storage;

  return {
    async estimateCapacity(): Promise<StorageEstimate> {
      if (storageManager === undefined) {
        return {
          quotaBytes: null,
          usedBytes: null,
        };
      }

      const estimate = await storageManager.estimate();
      return {
        quotaBytes: estimate.quota ?? null,
        usedBytes: estimate.usage ?? null,
      };
    },

    async save(checkpoint: RecoveryCheckpoint): Promise<SaveOutcome> {
      try {
        const database = await openRecoveryDatabase(indexedDb);
        try {
          await runStoreRequest(
            database,
            "readwrite",
            (store) => store.put(cloneCheckpoint(checkpoint)),
          );
          return { ok: true };
        } finally {
          database.close();
        }
      } catch (error) {
        if (isQuotaError(error)) {
          return { ok: false, reason: "quota" };
        }

        return { ok: false, reason: "unavailable" };
      }
    },

    async load(documentId: DocumentId): Promise<RecoveryCheckpoint | null> {
      const database = await openRecoveryDatabase(indexedDb);
      try {
        const checkpoint = await runStoreRequest(
          database,
          "readonly",
          (store) => store.get(documentId) as IDBRequest<RecoveryCheckpoint | undefined>,
        );
        return checkpoint === undefined ? null : cloneCheckpoint(checkpoint);
      } finally {
        database.close();
      }
    },

    async saveSourceBlob(source: RecoverySourceBlob): Promise<SaveOutcome> {
      try {
        const database = await openRecoveryDatabase(indexedDb);
        try {
          await runObjectStoreRequest(
            database,
            SOURCE_BLOB_STORE,
            "readwrite",
            (store) => store.put(cloneSourceBlob(source)),
          );
          return { ok: true };
        } finally {
          database.close();
        }
      } catch (error) {
        if (isQuotaError(error)) {
          return { ok: false, reason: "quota" };
        }

        return { ok: false, reason: "unavailable" };
      }
    },

    async loadSourceBlob(sourceId: SourceId): Promise<RecoverySourceBlob | null> {
      const database = await openRecoveryDatabase(indexedDb);
      try {
        const source = await runObjectStoreRequest(
          database,
          SOURCE_BLOB_STORE,
          "readonly",
          (store) =>
            store.get(sourceId) as IDBRequest<RecoverySourceBlob | undefined>,
        );
        return source === undefined ? null : cloneSourceBlob(source);
      } finally {
        database.close();
      }
    },

    async listRecoverable(): Promise<readonly RecoverySummary[]> {
      const database = await openRecoveryDatabase(indexedDb);
      try {
        const checkpoints = await runStoreRequest(
          database,
          "readonly",
          (store) => store.getAll() as IDBRequest<RecoveryCheckpoint[]>,
        );

        return checkpoints
          .map((checkpoint) => ({
            documentId: checkpoint.documentId,
            documentRevision: checkpoint.documentRevision,
            updatedAt: checkpoint.documentState.updatedAt,
            expiresAt: checkpoint.expiresAt,
          }))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      } finally {
        database.close();
      }
    },

    async delete(documentId: DocumentId): Promise<void> {
      const database = await openRecoveryDatabase(indexedDb);
      try {
        const checkpoint = await runCheckpointRequest(
          database,
          "readonly",
          (store) => store.get(documentId) as IDBRequest<RecoveryCheckpoint | undefined>,
        );
        await runCheckpointRequest(database, "readwrite", (store) =>
          store.delete(documentId),
        );
        await Promise.all(
          (checkpoint?.sourceManifest ?? []).map((source) =>
            runObjectStoreRequest(database, SOURCE_BLOB_STORE, "readwrite", (store) =>
              store.delete(source.sourceId),
            ),
          ),
        );
      } finally {
        database.close();
      }
    },

    async deleteExpired(now: string): Promise<number> {
      const database = await openRecoveryDatabase(indexedDb);
      try {
        const checkpoints = await runStoreRequest(
          database,
          "readonly",
          (store) => store.getAll() as IDBRequest<RecoveryCheckpoint[]>,
        );
        const expired = checkpoints.filter(
          (checkpoint) => checkpoint.expiresAt <= now,
        );

        await Promise.all(
          expired.map((checkpoint) =>
            runCheckpointRequest(database, "readwrite", (store) =>
              store.delete(checkpoint.documentId),
            ),
          ),
        );
        await Promise.all(
          expired.flatMap((checkpoint) =>
            checkpoint.sourceManifest.map((source) =>
              runObjectStoreRequest(
                database,
                SOURCE_BLOB_STORE,
                "readwrite",
                (store) => store.delete(source.sourceId),
              ),
            ),
          ),
        );

        return expired.length;
      } finally {
        database.close();
      }
    },
  };
}

function openRecoveryDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CHECKPOINT_STORE)) {
        database.createObjectStore(CHECKPOINT_STORE, {
          keyPath: "documentId",
        });
      }
      if (!database.objectStoreNames.contains(SOURCE_BLOB_STORE)) {
        database.createObjectStore(SOURCE_BLOB_STORE, {
          keyPath: "sourceId",
        });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function runStoreRequest<Result>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CHECKPOINT_STORE, mode);
    const store = transaction.objectStore(CHECKPOINT_STORE);
    const request = createRequest(store);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function runCheckpointRequest<Result>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> {
  return runObjectStoreRequest(database, CHECKPOINT_STORE, mode, createRequest);
}

function runObjectStoreRequest<Result>(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = createRequest(store);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function cloneCheckpoint(checkpoint: RecoveryCheckpoint): RecoveryCheckpoint {
  return structuredClone(checkpoint) as RecoveryCheckpoint;
}

function cloneSourceBlob(source: RecoverySourceBlob): RecoverySourceBlob {
  return structuredClone(source) as RecoverySourceBlob;
}

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "QuotaExceededError";
}
