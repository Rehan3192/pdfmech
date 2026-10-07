import type { PDFDocumentProxy } from "pdfjs-dist";

import type { ProtectPdfPermissions } from "../../domain/protect-pdf";
import type { ProtectPdfInspection, ProtectPdfProcessor, ProtectPdfProgress, ProtectPdfResult } from "../../ports/protect-pdf";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_COUNT = 300;
const PREVIEW_WIDTH = 520;

type WorkerResponse =
  | { readonly type: "progress"; readonly phase: "loading-engine" | "encrypting" | "verifying"; readonly message: string }
  | { readonly type: "success"; readonly output: ArrayBuffer; readonly pageCount: number }
  | { readonly type: "error"; readonly message: string };

export class BrowserPdfProtector implements ProtectPdfProcessor {
  async inspect(file: File, onProgress: (progress: ProtectPdfProgress) => void, signal?: AbortSignal): Promise<ProtectPdfInspection> {
    assertPdfFile(file);
    throwIfAborted(signal);
    onProgress({ phase: "inspecting", message: "Checking your PDF" });
    const [{ GlobalWorkerOptions, getDocument }, { default: workerUrl }] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    GlobalWorkerOptions.workerSrc = workerUrl;
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), stopAtErrors: true, enableXfa: false });
    let viewer: PDFDocumentProxy | null = null;
    try {
      viewer = await task.promise;
      assertPageCount(viewer.numPages);
      throwIfAborted(signal);
      const page = await viewer.getPage(1);
      try {
        const viewportAtOne = page.getViewport({ scale: 1 });
        const scale = Math.min(1.25, PREVIEW_WIDTH / viewportAtOne.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const context = canvas.getContext("2d", { alpha: false });
        if (context === null) throw new Error("A PDF preview is unavailable in this browser.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const signatures = await viewer.getSignatures();
        return {
          fileName: file.name,
          byteLength: file.size,
          pageCount: viewer.numPages,
          hasSignatures: signatures !== null && signatures.length > 0,
          preview: await canvasToBlob(canvas),
        };
      } finally {
        page.cleanup();
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Error && /larger|more than|preview/.test(error.message)) throw error;
      const detail = error instanceof Error ? error.message.toLocaleLowerCase("en") : "";
      if (detail.includes("password")) throw new Error("This PDF is already password protected. Use Unlock PDF before setting a new password.");
      throw new Error(`${file.name} could not be opened. Damaged or unsupported PDFs cannot be protected.`);
    } finally {
      await task.destroy();
    }
  }

  async protect(file: File, password: string, permissions: ProtectPdfPermissions, onProgress: (progress: ProtectPdfProgress) => void, signal?: AbortSignal): Promise<ProtectPdfResult> {
    assertPdfFile(file);
    throwIfAborted(signal);
    const input = await file.arrayBuffer();
    throwIfAborted(signal);
    const result = await runProtectWorker(input, password, permissions, onProgress, signal);
    return {
      blob: new Blob([result.output], { type: "application/pdf" }),
      downloadName: `${file.name.replace(/\.pdf$/i, "") || "document"}-protected.pdf`,
      pageCount: result.pageCount,
      encryption: "AES-256",
    };
  }
}

function runProtectWorker(
  input: ArrayBuffer,
  password: string,
  permissions: ProtectPdfPermissions,
  onProgress: (progress: ProtectPdfProgress) => void,
  signal?: AbortSignal,
): Promise<{ readonly output: ArrayBuffer; readonly pageCount: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/pdf-protect.worker.ts", import.meta.url), { type: "module" });
    const abort = () => {
      worker.terminate();
      reject(new DOMException("The operation was cancelled.", "AbortError"));
    };
    if (signal?.aborted === true) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        onProgress({ phase: message.phase, message: message.message });
        return;
      }
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      if (message.type === "error") reject(new Error(message.message));
      else resolve({ output: message.output, pageCount: message.pageCount });
    };
    worker.onerror = () => {
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      reject(new Error("The browser encryption engine could not start."));
    };
    worker.postMessage({ type: "protect", input, password, permissions }, [input]);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob === null ? reject(new Error("A PDF preview could not be created.")) : resolve(blob), "image/jpeg", .84));
}

function assertPdfFile(file: File): void {
  if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 100 MB limit.`);
  if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") throw new Error(`${file.name} is not a PDF file.`);
}

function assertPageCount(pageCount: number): void {
  if (pageCount < 1) throw new Error("The PDF does not contain any pages.");
  if (pageCount > MAX_PAGE_COUNT) throw new Error(`PDFs with more than ${MAX_PAGE_COUNT} pages are not supported.`);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new DOMException("The operation was cancelled.", "AbortError");
}
