import { expect, test } from "@playwright/test";

test("IndexedDB recovery store saves, loads, lists, deletes, and expires checkpoints locally", async ({
  page,
}) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("privacy-pdf-editor-recovery");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      request.onblocked = () =>
        reject(new Error("Recovery database deletion was blocked."));
    });
    const recoveryStoreModulePath =
      "/src/infrastructure/persistence/indexeddb-recovery-store.ts";
    const recoveryCheckpointModulePath = "/src/app/recovery-checkpoint.ts";
    const { createIndexedDbRecoveryStore } = await import(
      recoveryStoreModulePath
    );
    const { createRecoveryCheckpoint, verifyRecoveryCheckpoint } = await import(
      recoveryCheckpointModulePath
    );

    const store = createIndexedDbRecoveryStore();
    const baseDocument = {
      schemaVersion: 1,
      id: "document_recovery_browser",
      revision: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:01.000Z",
      sources: {
        source_recovery_browser: {
          id: "source_recovery_browser",
          fingerprint: "source_sha256_browser",
          originalName: "PRIVATE_FILENAME_CANARY.pdf",
          byteLength: 4,
          pageCount: 1,
          encryption: "none",
          signatureState: "none",
          capabilities: {
            canRender: true,
            canExportOverlay: true,
            canFillSupportedForms: false,
            unsupportedReasons: [],
          },
        },
      },
      pages: [],
      objects: {},
      objectOrderByPage: {},
      formValues: {},
      assets: {},
      warnings: [],
    };
    const checkpoint = await createRecoveryCheckpoint({
      document: baseDocument,
      now: "2026-08-01T00:00:02.000Z",
      ttlDays: 1,
    });

    const capacity = await store.estimateCapacity();
    const sourceBlobOutcome = await store.saveSourceBlob({
      sourceId: "source_recovery_browser",
      originalName: "PRIVATE_FILENAME_CANARY.pdf",
      byteLength: 4,
      sha256: "source_sha256_browser",
      blob: new Blob([new Uint8Array([37, 80, 68, 70])], {
        type: "application/pdf",
      }),
    });
    const saveOutcome = await store.save(checkpoint);
    const loaded = await store.load("document_recovery_browser");
    const loadedSource = await store.loadSourceBlob("source_recovery_browser");
    const summaries = await store.listRecoverable();
    const deletedMissingBeforeExpiry = await store.deleteExpired(
      "2026-08-01T12:00:00.000Z",
    );
    const stillLoaded = await store.load("document_recovery_browser");
    const deletedExpired = await store.deleteExpired(
      "2026-08-03T00:00:00.000Z",
    );
    const afterExpiry = await store.load("document_recovery_browser");
    const sourceAfterExpiry = await store.loadSourceBlob(
      "source_recovery_browser",
    );

    await store.saveSourceBlob({
      sourceId: "source_recovery_browser",
      originalName: "PRIVATE_FILENAME_CANARY.pdf",
      byteLength: 4,
      sha256: "source_sha256_browser",
      blob: new Blob([new Uint8Array([37, 80, 68, 70])], {
        type: "application/pdf",
      }),
    });
    await store.save(checkpoint);
    await store.delete("document_recovery_browser");
    const afterManualDelete = await store.load("document_recovery_browser");
    const sourceAfterManualDelete = await store.loadSourceBlob(
      "source_recovery_browser",
    );

    return {
      capacityHasKnownShape:
        "quotaBytes" in capacity && "usedBytes" in capacity,
      sourceBlobOutcome,
      saveOutcome,
      loadedRevision: loaded?.documentRevision,
      loadedSource:
        loadedSource === null
          ? null
          : {
              sourceId: loadedSource.sourceId,
              originalName: loadedSource.originalName,
              byteLength: loadedSource.byteLength,
              sha256: loadedSource.sha256,
              bytes: Array.from(
                new Uint8Array(await loadedSource.blob.arrayBuffer()),
              ),
            },
      loadedChecksumOk:
        loaded === null ? false : await verifyRecoveryCheckpoint(loaded),
      summaries,
      deletedMissingBeforeExpiry,
      stillLoadedRevision: stillLoaded?.documentRevision,
      deletedExpired,
      afterExpiry,
      sourceAfterExpiry,
      afterManualDelete,
      sourceAfterManualDelete,
    };
  });

  expect(result.capacityHasKnownShape).toBe(true);
  expect(result.sourceBlobOutcome).toEqual({ ok: true });
  expect(result.saveOutcome).toEqual({ ok: true });
  expect(result.loadedRevision).toBe(1);
  expect(result.loadedSource).toEqual({
    sourceId: "source_recovery_browser",
    originalName: "PRIVATE_FILENAME_CANARY.pdf",
    byteLength: 4,
    sha256: "source_sha256_browser",
    bytes: [37, 80, 68, 70],
  });
  expect(result.loadedChecksumOk).toBe(true);
  expect(result.summaries).toEqual([
    {
      documentId: "document_recovery_browser",
      documentRevision: 1,
      updatedAt: "2026-08-01T00:00:01.000Z",
      expiresAt: "2026-08-02T00:00:02.000Z",
    },
  ]);
  expect(result.deletedMissingBeforeExpiry).toBe(0);
  expect(result.stillLoadedRevision).toBe(1);
  expect(result.deletedExpired).toBe(1);
  expect(result.afterExpiry).toBeNull();
  expect(result.sourceAfterExpiry).toBeNull();
  expect(result.afterManualDelete).toBeNull();
  expect(result.sourceAfterManualDelete).toBeNull();
});
