import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { EditorErrorCode } from "../../domain/errors";
import { asPdfPoint, normalizeDegrees } from "../../domain/primitives";
import type {
  InspectionResult,
  InspectionPage,
  LocalPdfSource,
  PdfRenderer,
  RenderedPage,
  RenderedThumbnail,
  RenderPageRequest,
} from "../../ports/pdf";

GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 500;
const MAX_PAGE_SIDE_POINTS = 14_400;
const MAX_PAGE_AREA_POINTS = 50_000_000;
const MAX_RENDER_SCALE = 4;

interface LoadedSource {
  readonly task: PDFDocumentLoadingTask;
  readonly viewer: PDFDocumentProxy;
}

export class PdfInspectionError extends Error {
  constructor(
    readonly code: EditorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfInspectionError";
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function waitForDocument(
  task: PDFDocumentLoadingTask,
): Promise<PDFDocumentProxy> {
  let passwordRejected = false;
  task.onPassword = () => {
    passwordRejected = true;
    void task.destroy();
  };

  try {
    return await task.promise;
  } catch (error) {
    if (passwordRejected) {
      throw new PdfInspectionError(
        "PDF_ENCRYPTED_UNSUPPORTED",
        "Password-protected PDFs are not supported yet.",
      );
    }

    throw error;
  }
}

export function createPdfJsRenderer(): PdfRenderer {
  const sources = new Map<string, LoadedSource>();

  return {
    async inspect(source: LocalPdfSource): Promise<InspectionResult> {
      const previous = sources.get(source.sourceId);
      if (previous !== undefined) {
        await previous.task.destroy();
        sources.delete(source.sourceId);
      }

      if (source.blob.size === 0) {
        throw new PdfInspectionError("PDF_MALFORMED", "The PDF is empty.");
      }

      if (source.blob.size > MAX_FILE_BYTES) {
        throw new PdfInspectionError(
          "FILE_TOO_LARGE",
          "This PDF is larger than the local editing limit.",
        );
      }

      const bytes = new Uint8Array(await source.blob.arrayBuffer());
      const task = getDocument({
        data: bytes.slice(),
        stopAtErrors: true,
        enableXfa: false,
        maxImageSize: 40_000_000,
      });

      const viewer = await waitForDocument(task);
      let keepSourceLoaded = false;
      try {
        const signatures = await viewer.getSignatures();
        if (signatures !== null && signatures.length > 0) {
          throw new PdfInspectionError(
            "PDF_SIGNATURE_ACK_REQUIRED",
            "Digitally signed PDFs are blocked until signature handling is implemented.",
          );
        }

        const metadata = await viewer.getMetadata();
        const info = metadata.info as { readonly IsXFAPresent?: boolean };
        if (viewer.isPureXfa || info.IsXFAPresent === true) {
          throw new PdfInspectionError(
            "PDF_FEATURE_UNSUPPORTED",
            "XFA PDFs are not supported.",
          );
        }

        if (viewer.numPages > MAX_PAGE_COUNT) {
          throw new PdfInspectionError(
            "PAGE_COUNT_EXCEEDED",
            "This PDF has more pages than the local editing limit.",
          );
        }

        const pages: InspectionPage[] = [];
        for (
          let pageNumber = 1;
          pageNumber <= viewer.numPages;
          pageNumber += 1
        ) {
          const page = await viewer.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });
          try {
            if (
              viewport.width > MAX_PAGE_SIDE_POINTS ||
              viewport.height > MAX_PAGE_SIDE_POINTS ||
              viewport.width * viewport.height > MAX_PAGE_AREA_POINTS
            ) {
              throw new PdfInspectionError(
                "RENDER_RESOURCE_LIMIT",
                "A PDF page exceeds the local rendering safety limit.",
              );
            }

            const [xMin, yMin, xMax, yMax] = page.view;
            if (
              xMin === undefined ||
              yMin === undefined ||
              xMax === undefined ||
              yMax === undefined
            ) {
              throw new PdfInspectionError(
                "PDF_MALFORMED",
                "A PDF page is missing its page box.",
              );
            }

            const cropBox = {
              xMin: asPdfPoint(xMin),
              yMin: asPdfPoint(yMin),
              xMax: asPdfPoint(xMax),
              yMax: asPdfPoint(yMax),
            };
            pages.push({
              sourcePageIndex: pageNumber - 1,
              geometry: {
                mediaBox: cropBox,
                cropBox,
                intrinsicRotation: normalizeDegrees(viewport.rotation),
              },
            });
          } finally {
            page.cleanup();
          }
        }

        const result: InspectionResult = {
          id: source.sourceId,
          fingerprint: await sha256Hex(bytes),
          originalName: source.originalName,
          byteLength: source.blob.size,
          pageCount: viewer.numPages,
          encryption: "none",
          signatureState: "none",
          capabilities: {
            canRender: true,
            canExportOverlay: false,
            canFillSupportedForms: false,
            unsupportedReasons: [],
          },
          pages,
        };
        sources.set(source.sourceId, { task, viewer });
        keepSourceLoaded = true;
        return result;
      } catch (error) {
        if (error instanceof PdfInspectionError) {
          throw error;
        }

        throw new PdfInspectionError(
          "PDF_MALFORMED",
          "The PDF could not be inspected safely.",
        );
      } finally {
        if (!keepSourceLoaded) {
          await task.destroy();
        }
      }
    },

    async renderPage(request: RenderPageRequest): Promise<RenderedPage> {
      if (
        !Number.isFinite(request.scale) ||
        request.scale <= 0 ||
        request.scale > MAX_RENDER_SCALE
      ) {
        throw new PdfInspectionError(
          "RENDER_RESOURCE_LIMIT",
          "The requested render scale is outside the safe local limit.",
        );
      }

      const source = sources.get(request.sourceId);
      if (source === undefined) {
        throw new PdfInspectionError(
          "RENDER_FAILED",
          "The PDF source is not available for rendering.",
        );
      }

      const page = await source.viewer.getPage(request.sourcePageIndex + 1);
      const viewport = page.getViewport({
        scale: request.scale,
        rotation: request.rotation,
      });
      try {
        if (
          viewport.width > MAX_PAGE_SIDE_POINTS ||
          viewport.height > MAX_PAGE_SIDE_POINTS ||
          viewport.width * viewport.height > MAX_PAGE_AREA_POINTS
        ) {
          throw new PdfInspectionError(
            "RENDER_RESOURCE_LIMIT",
            "The rendered page exceeds the local rendering safety limit.",
          );
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (context === null) {
          throw new PdfInspectionError(
            "RENDER_FAILED",
            "The browser cannot create a canvas for PDF rendering.",
          );
        }

        await page.render({
          canvas,
          canvasContext: context,
          viewport,
        }).promise;

        return {
          bitmap: await createImageBitmap(canvas),
          width: canvas.width,
          height: canvas.height,
        };
      } finally {
        page.cleanup();
      }
    },

    async renderThumbnail(
      request: RenderPageRequest,
    ): Promise<RenderedThumbnail> {
      const source = sources.get(request.sourceId);
      if (source === undefined) {
        throw new PdfInspectionError(
          "RENDER_FAILED",
          "The PDF source is not available for thumbnail rendering.",
        );
      }

      const page = await source.viewer.getPage(request.sourcePageIndex + 1);
      const viewport = page.getViewport({
        scale: Math.min(request.scale, 0.25),
      });
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (context === null) {
          throw new PdfInspectionError(
            "RENDER_FAILED",
            "The browser cannot create a canvas for PDF thumbnail rendering.",
          );
        }
        await page.render({
          canvas,
          canvasContext: context,
          viewport,
        }).promise;
        return {
          bitmap: await createImageBitmap(canvas),
          width: canvas.width,
          height: canvas.height,
        };
      } finally {
        page.cleanup();
      }
    },

    async disposeSource(sourceId): Promise<void> {
      const source = sources.get(sourceId);
      if (source === undefined) {
        return;
      }

      sources.delete(sourceId);
      await source.task.destroy();
    },
  };
}
