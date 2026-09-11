import { describe, expect, it } from "vitest";

import {
  createRecoveryCheckpoint,
  verifyRecoveryCheckpoint,
} from "../../src/app/recovery-checkpoint";
import { createEmptyEditorDocument } from "../../src/domain/document";
import { asPdfPoint } from "../../src/domain/primitives";
import { unsafeBrand } from "../../src/shared/brand";
import type {
  AssetDescriptor,
  EditorDocument,
  PageInstance,
  SourceDocument,
} from "../../src/domain/document";

function createDocument(): EditorDocument {
  const sourceId = unsafeBrand<string, "SourceId">("source_recovery_test");
  const source: SourceDocument = {
    id: sourceId,
    fingerprint: "source_sha256_test",
    originalName: "PRIVATE_FILENAME_CANARY.pdf",
    byteLength: 1234,
    pageCount: 1,
    encryption: "none",
    signatureState: "none",
    capabilities: {
      canRender: true,
      canExportOverlay: true,
      canFillSupportedForms: false,
      unsupportedReasons: [],
    },
  };
  const page: PageInstance = {
    id: unsafeBrand("page_recovery_test"),
    sourceId: source.id,
    sourcePageIndex: 0,
    userRotation: 0,
    geometry: {
      mediaBox: {
        xMin: asPdfPoint(0),
        yMin: asPdfPoint(0),
        xMax: asPdfPoint(612),
        yMax: asPdfPoint(792),
      },
      cropBox: {
        xMin: asPdfPoint(0),
        yMin: asPdfPoint(0),
        xMax: asPdfPoint(612),
        yMax: asPdfPoint(792),
      },
      intrinsicRotation: 0,
    },
  };
  const asset: AssetDescriptor = {
    id: unsafeBrand("asset_recovery_test"),
    mediaType: "image/png",
    byteLength: 99,
    pixelWidth: 10,
    pixelHeight: 10,
    sha256: "asset_sha256_test",
  };

  return {
    ...createEmptyEditorDocument({
      id: unsafeBrand("document_recovery_test"),
      createdAt: "2026-08-01T00:00:00.000Z",
    }),
    revision: 3,
    updatedAt: "2026-08-01T00:00:03.000Z",
    sources: {
      [source.id]: source,
    },
    pages: [page],
    objectOrderByPage: {
      [page.id]: [],
    },
    assets: {
      [asset.id]: asset,
    },
  };
}

describe("createRecoveryCheckpoint", () => {
  it(
    "creates a recoverable checkpoint with manifests and a verifiable checksum",
    async () => {
      const document = createDocument();

      const checkpoint = await createRecoveryCheckpoint({
        document,
        now: "2026-08-01T00:00:10.000Z",
        ttlDays: 3,
      });

      expect(checkpoint).toMatchObject({
        schemaVersion: 1,
        documentId: document.id,
        documentRevision: 3,
        createdAt: "2026-08-01T00:00:10.000Z",
        expiresAt: "2026-08-04T00:00:10.000Z",
        sourceManifest: [
          {
            sourceId: "source_recovery_test",
            sha256: "source_sha256_test",
            byteLength: 1234,
          },
        ],
        assetManifest: [
          {
            assetId: "asset_recovery_test",
            sha256: "asset_sha256_test",
            byteLength: 99,
          },
        ],
      });
      expect(checkpoint.checksum).toMatch(/^[a-f0-9]{64}$/);
      await expect(verifyRecoveryCheckpoint(checkpoint)).resolves.toBe(true);
    },
    15_000,
  );

  it("clones document state so later edits cannot mutate the checkpoint", async () => {
    const document = createDocument();
    const checkpoint = await createRecoveryCheckpoint({
      document,
      now: "2026-08-01T00:00:10.000Z",
    });
    const sourceId = unsafeBrand<string, "SourceId">("source_recovery_test");

    const checkpointSource = checkpoint.documentState.sources[sourceId] as {
      byteLength: number;
    };
    checkpointSource.byteLength = 999;

    expect(document.sources[sourceId]?.byteLength).toBe(1234);
  });

  it("detects changed checkpoint contents", async () => {
    const checkpoint = await createRecoveryCheckpoint({
      document: createDocument(),
      now: "2026-08-01T00:00:10.000Z",
    });
    const changedCheckpoint = {
      ...checkpoint,
      documentRevision: checkpoint.documentRevision + 1,
    };

    await expect(verifyRecoveryCheckpoint(changedCheckpoint)).resolves.toBe(
      false,
    );
  });

  it("rejects unsafe recovery TTL values", async () => {
    await expect(
      createRecoveryCheckpoint({
        document: createDocument(),
        now: "2026-08-01T00:00:10.000Z",
        ttlDays: 0,
      }),
    ).rejects.toThrow("Recovery TTL must be an integer");
  });
});
