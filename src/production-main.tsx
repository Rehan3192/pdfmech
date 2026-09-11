import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/700.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/700.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/700.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/700.css";

import { closeLocalDocument } from "./app/close-local-document";
import { exportValidatedDocument } from "./app/export-document";
import { openLocalDocument } from "./app/open-local-document";
import { verifyRecoveryCheckpoint } from "./app/recovery-checkpoint";
import { renderDocumentPage } from "./app/render-document-page";
import {
  addRedactionObject,
  addTextObject,
  addWhiteoutObject,
  deleteObject as deleteDomainObject,
  duplicateObject as duplicateDomainObject,
  moveObject as moveDomainObject,
  resizeObject as resizeDomainObject,
  updateTextObjectAppearance as updateDomainTextObjectAppearance,
  updateTextObjectContent as updateDomainTextObjectContent,
  updateRedactionObjectAppearance as updateDomainRedactionObjectAppearance,
  updateWhiteoutObjectAppearance as updateDomainWhiteoutObjectAppearance,
} from "./domain/edit-object-commands";
import {
  deletePage as deleteDomainPage,
  movePage as moveDomainPage,
  rotatePage as rotateDomainPage,
} from "./domain/page-commands";
import { createBrowserIdService } from "./infrastructure/browser-id-service";
import { createLazyPdfRenderer } from "./infrastructure/pdfjs/lazy-renderer";
import { createLazyPdfValidator } from "./infrastructure/pdfjs/lazy-validator";
import { createLazyPdfExporter } from "./infrastructure/pdflib/lazy-exporter";
import { createIndexedDbRecoveryStore } from "./infrastructure/persistence/indexeddb-recovery-store";
import { ProductionApp } from "./presentation/ProductionApp";
import { WebsiteShell } from "./presentation/WebsiteShell";
import type { EditorDocument } from "./domain/document";
import type { SourceId } from "./domain/primitives";
import type { RecoverySummary } from "./ports/recovery";
import "./presentation/production.css";
import "./presentation/editor-reference.css";
import "./presentation/content-guide.css";
import "./presentation/marketing-pages.css";

const rootElement = document.querySelector("#app");
if (rootElement === null) {
  throw new Error("Application root is missing.");
}

const ids = createBrowserIdService();
const renderer = createLazyPdfRenderer();
const exporter = createLazyPdfExporter();
const validator = createLazyPdfValidator();
const recoveryStore = createIndexedDbRecoveryStore();

async function restoreRecoveredDocument(
  summary: RecoverySummary,
): Promise<EditorDocument> {
  const checkpoint = await recoveryStore.load(summary.documentId);
  if (checkpoint === null) {
    throw new Error("Local recovery checkpoint is no longer available.");
  }

  if (!(await verifyRecoveryCheckpoint(checkpoint))) {
    throw new Error("Local recovery checkpoint failed integrity checks.");
  }

  const loadedSourceIds: SourceId[] = [];
  try {
    for (const source of checkpoint.sourceManifest) {
      const storedSource = await recoveryStore.loadSourceBlob(source.sourceId);
      if (storedSource === null) {
        throw new Error("Recovered source PDF is missing.");
      }

      if (
        storedSource.sha256 !== source.sha256 ||
        storedSource.byteLength !== source.byteLength
      ) {
        throw new Error("Recovered source PDF does not match the checkpoint.");
      }

      const localSource = {
        sourceId: storedSource.sourceId,
        blob: storedSource.blob,
        originalName: storedSource.originalName,
      };
      await exporter.registerSource(localSource);
      await renderer.inspect(localSource);
      loadedSourceIds.push(storedSource.sourceId);
    }

    return checkpoint.documentState;
  } catch (error) {
    await Promise.all(
      loadedSourceIds.map((sourceId) =>
        Promise.all([
          renderer.disposeSource(sourceId),
          exporter.disposeSource(sourceId),
        ]),
      ),
    );
    throw error;
  }
}

createRoot(rootElement).render(
  <StrictMode>
    <WebsiteShell
      editor={<ProductionApp
      openDocument={(file) =>
        openLocalDocument(
          {
            ids,
            renderer,
            sourceRegistry: exporter,
            now: () => new Date().toISOString(),
          },
          file,
        )
      }
      renderPage={(document, pageIndex, scale) =>
        renderDocumentPage({ renderer }, document, pageIndex, scale)
      }
      closeDocument={(document) =>
        closeLocalDocument({ renderer, sourceRegistry: exporter }, document)
      }
      exportDocument={(document) =>
        exportValidatedDocument({ exporter, validator }, document)
      }
      createTextObject={(document, input) => {
        const objectId = ids.createObjectId();
        return {
          objectId,
          document: addTextObject(document, {
            objectId,
            pageIndex: input.pageIndex,
            frame: input.frame,
            text: input.text,
            now: new Date().toISOString(),
          }),
        };
      }}
      createWhiteoutObject={(document, input) => {
        const objectId = ids.createObjectId();
        return {
          objectId,
          document: addWhiteoutObject(document, {
            objectId,
            pageIndex: input.pageIndex,
            frame: input.frame,
            now: new Date().toISOString(),
          }),
        };
      }}
      createRedactionObject={(document, input) => {
        const objectId = ids.createObjectId();
        return {
          objectId,
          document: addRedactionObject(document, {
            objectId,
            pageIndex: input.pageIndex,
            frame: input.frame,
            now: new Date().toISOString(),
          }),
        };
      }}
      deleteObject={(document, objectId) =>
        deleteDomainObject(document, objectId, new Date().toISOString())
      }
      moveObject={(document, objectId, frame) =>
        moveDomainObject(document, {
          objectId,
          frame,
          now: new Date().toISOString(),
        })
      }
      resizeObject={(document, objectId, frame) =>
        resizeDomainObject(document, {
          objectId,
          frame,
          now: new Date().toISOString(),
        })
      }
      updateTextObjectContent={(document, objectId, text) =>
        updateDomainTextObjectContent(document, {
          objectId,
          text,
          now: new Date().toISOString(),
        })
      }
      updateTextObjectAppearance={(document, objectId, input) =>
        updateDomainTextObjectAppearance(document, {
          objectId,
          fontFamily: input.fontFamily,
          fontWeight: input.fontWeight,
          fontSize: input.fontSize,
          color: input.color,
          horizontalAlignment: input.horizontalAlignment,
          now: new Date().toISOString(),
        })
      }
      updateWhiteoutObjectAppearance={(document, objectId, input) =>
        updateDomainWhiteoutObjectAppearance(document, {
          objectId,
          color: input.color,
          now: new Date().toISOString(),
        })
      }
      updateRedactionObjectAppearance={(document, objectId, input) =>
        updateDomainRedactionObjectAppearance(document, {
          objectId,
          color: input.color,
          now: new Date().toISOString(),
        })
      }
      duplicateObject={(document, sourceObjectId, frame) => {
        const objectId = ids.createObjectId();
        return {
          objectId,
          document: duplicateDomainObject(document, {
            sourceObjectId,
            objectId,
            frame,
            now: new Date().toISOString(),
          }),
        };
      }}
      rotatePage={(document, pageIndex, deltaDegrees) =>
        rotateDomainPage(document, {
          pageIndex,
          deltaDegrees,
          now: new Date().toISOString(),
        })
      }
      movePage={(document, fromIndex, toIndex) =>
        moveDomainPage(document, {
          fromIndex,
          toIndex,
          now: new Date().toISOString(),
        })
      }
      deletePage={(document, pageIndex) =>
        deleteDomainPage(document, {
          pageIndex,
          now: new Date().toISOString(),
        })
      }
      recoveryStore={recoveryStore}
      restoreRecoveredDocument={restoreRecoveredDocument}
    />}
    />
  </StrictMode>,
);
