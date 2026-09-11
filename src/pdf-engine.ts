import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";
import {
  applyMatrix,
  applyVector,
  invertMatrix,
  radiansToDegrees,
  transformFrameBounds,
  type AffineMatrix,
} from "./geometry";
import type { Edit, PageGeometry } from "./model";

GlobalWorkerOptions.workerSrc = workerUrl;

export interface OpenedPdf {
  originalBytes: Uint8Array;
  loadingTask: PDFDocumentLoadingTask;
  viewer: PDFDocumentProxy;
  pages: PageGeometry[];
}

export interface ValidationEvidence {
  pageCount: number;
  renderedPages: number[];
  byteLength: number;
}

function asMatrix(value: readonly number[]): AffineMatrix {
  if (value.length !== 6) {
    throw new Error("Unexpected PDF viewport transform.");
  }
  const [a, b, c, d, e, f] = value;
  if (
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined ||
    e === undefined ||
    f === undefined
  ) {
    throw new Error("Incomplete PDF viewport transform.");
  }
  return [a, b, c, d, e, f];
}

export async function openLocalPdf(file: File): Promise<OpenedPdf> {
  if (file.size === 0) {
    throw new Error("The selected file is empty.");
  }
  if (file.size > 100 * 1024 * 1024) {
    throw new Error("The spike rejects files larger than 100 MB.");
  }

  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({
    data: originalBytes.slice(),
    stopAtErrors: true,
    enableXfa: false,
    maxImageSize: 40_000_000,
  });
  const viewer = await new Promise<PDFDocumentProxy>((resolve, reject) => {
    let passwordRejected = false;
    loadingTask.onPassword = () => {
      passwordRejected = true;
      reject(
        new Error(
          "Password-protected PDFs are not supported by this editing spike.",
        ),
      );
      void loadingTask.destroy();
    };
    loadingTask.promise.then(resolve, (error: unknown) => {
      if (!passwordRejected) {
        reject(error);
      }
    });
  });
  const signatures = await viewer.getSignatures();
  if (signatures !== null && signatures.length > 0) {
    await loadingTask.destroy();
    throw new Error(
      "Digitally signed PDFs are blocked by this editing spike because modification invalidates signature trust.",
    );
  }
  const metadata = await viewer.getMetadata();
  const info = metadata.info as unknown as {
    IsXFAPresent?: boolean;
  };
  if (viewer.isPureXfa || info.IsXFAPresent === true) {
    await loadingTask.destroy();
    throw new Error(
      "XFA forms are not supported by this editing spike.",
    );
  }
  if (viewer.numPages > 500) {
    await loadingTask.destroy();
    throw new Error("The spike rejects files with more than 500 pages.");
  }

  const pages: PageGeometry[] = [];
  for (let pageNumber = 1; pageNumber <= viewer.numPages; pageNumber += 1) {
    const page = await viewer.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    if (
      viewport.width > 14_400 ||
      viewport.height > 14_400 ||
      viewport.width * viewport.height > 50_000_000
    ) {
      page.cleanup();
      await loadingTask.destroy();
      throw new Error(
        `Page ${pageNumber} dimensions exceed the safe rendering limit.`,
      );
    }
    const pdfToCanonical = asMatrix(viewport.transform);
    pages.push({
      pageIndex: pageNumber - 1,
      width: viewport.width,
      height: viewport.height,
      pdfToCanonical,
      canonicalToPdf: invertMatrix(pdfToCanonical),
      rotation: viewport.rotation,
    });
    page.cleanup();
  }

  return { originalBytes, loadingTask, viewer, pages };
}

export async function renderPage(
  opened: OpenedPdf,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  zoom: number,
): Promise<void> {
  const page = await opened.viewer.getPage(pageIndex + 1);
  const deviceScale = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: zoom * deviceScale });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = `${viewport.width / deviceScale}px`;
  canvas.style.height = `${viewport.height / deviceScale}px`;
  await page.render({
    canvas,
    viewport,
  }).promise;
  page.cleanup();
}

function textRotation(matrix: AffineMatrix): number {
  const direction = applyVector(matrix, { x: 1, y: 0 });
  return radiansToDegrees(Math.atan2(direction.y, direction.x));
}

export async function exportEditedPdf(
  opened: OpenedPdf,
  edits: readonly Edit[],
): Promise<Uint8Array> {
  const document = await PDFDocument.load(opened.originalBytes, {
    updateMetadata: false,
  });
  const font = await document.embedFont(StandardFonts.Helvetica);

  for (const edit of edits) {
    const page = document.getPage(edit.pageIndex);
    const geometry = opened.pages[edit.pageIndex];
    if (geometry === undefined) {
      throw new Error(`Missing geometry for page ${edit.pageIndex + 1}.`);
    }

    if (edit.kind === "whiteout") {
      const bounds = transformFrameBounds(
        geometry.canonicalToPdf,
        edit.frame,
      );
      page.drawRectangle({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      });
      continue;
    }

    const baseline = applyMatrix(geometry.canonicalToPdf, {
      x: edit.frame.x,
      y: edit.frame.y + edit.fontSize * 0.82,
    });
    page.drawText(edit.text, {
      x: baseline.x,
      y: baseline.y,
      size: edit.fontSize,
      font,
      color: rgb(...edit.color),
      rotate: degrees(textRotation(geometry.canonicalToPdf)),
      maxWidth: edit.frame.width,
    });
  }

  return document.save({
    addDefaultPage: false,
    updateFieldAppearances: true,
    useObjectStreams: true,
  });
}

export async function validateGeneratedPdf(
  bytes: Uint8Array,
  expectedPageCount: number,
  changedPageIndexes: readonly number[],
): Promise<ValidationEvidence> {
  if (bytes.byteLength === 0) {
    throw new Error("Generated PDF is empty.");
  }

  const task = getDocument({
    data: bytes.slice(),
    stopAtErrors: true,
    enableXfa: false,
    maxImageSize: 40_000_000,
  });
  const document = await task.promise;
  try {
    if (document.numPages !== expectedPageCount) {
      throw new Error(
        `Expected ${expectedPageCount} pages, found ${document.numPages}.`,
      );
    }
    const uniquePages = [...new Set(changedPageIndexes)].sort(
      (left, right) => left - right,
    );
    for (const pageIndex of uniquePages) {
      const page = await document.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 0.25 });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
    }
    return {
      pageCount: document.numPages,
      renderedPages: uniquePages,
      byteLength: bytes.byteLength,
    };
  } finally {
    await task.destroy();
  }
}
