import { unlockedPdfName } from "../../domain/unlock-pdf";
import type { UnlockPdfInspection, UnlockPdfProcessor, UnlockPdfProgress, UnlockPdfResult } from "../../ports/unlock-pdf";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

type WorkerResponse =
  | { readonly type: "progress"; readonly phase: "loading-engine" | "inspecting" | "decrypting" | "verifying"; readonly message: string }
  | { readonly type: "inspection"; readonly requiresPassword: boolean }
  | { readonly type: "success"; readonly output: ArrayBuffer; readonly pageCount: number }
  | { readonly type: "error"; readonly message: string };

export class BrowserPdfUnlocker implements UnlockPdfProcessor {
  async inspect(file: File, onProgress: (progress: UnlockPdfProgress) => void, signal?: AbortSignal): Promise<UnlockPdfInspection> {
    assertPdfFile(file);
    const result = await runWorker({ type: "inspect", input: await file.arrayBuffer() }, onProgress, signal);
    if (result.type !== "inspection") throw new Error("The PDF protection status could not be read.");
    return { fileName: file.name, byteLength: file.size, requiresPassword: result.requiresPassword };
  }

  async unlock(file: File, password: string, onProgress: (progress: UnlockPdfProgress) => void, signal?: AbortSignal): Promise<UnlockPdfResult> {
    assertPdfFile(file);
    const result = await runWorker({ type: "unlock", input: await file.arrayBuffer(), password }, onProgress, signal);
    if (result.type !== "success") throw new Error("The unlocked PDF was not created.");
    return {
      blob: new Blob([result.output], { type: "application/pdf" }),
      downloadName: unlockedPdfName(file.name),
      pageCount: result.pageCount,
    };
  }
}

function runWorker(
  request: { readonly type: "inspect"; readonly input: ArrayBuffer } | { readonly type: "unlock"; readonly input: ArrayBuffer; readonly password: string },
  onProgress: (progress: UnlockPdfProgress) => void,
  signal?: AbortSignal,
): Promise<Extract<WorkerResponse, { readonly type: "inspection" | "success" }>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/pdf-unlock.worker.ts", import.meta.url), { type: "module" });
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
      else resolve(message);
    };
    worker.onerror = () => {
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      reject(new Error("The browser PDF security engine could not start."));
    };
    worker.postMessage(request, [request.input]);
  });
}

function assertPdfFile(file: File): void {
  if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 100 MB limit.`);
  if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") throw new Error(`${file.name} is not a PDF file.`);
}
