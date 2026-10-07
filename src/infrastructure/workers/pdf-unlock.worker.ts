import { createPdfToolkit, PdfPasswordError } from "pdfstudio";

type UnlockRequest =
  | { readonly type: "inspect"; readonly input: ArrayBuffer }
  | { readonly type: "unlock"; readonly input: ArrayBuffer; readonly password: string };

type UnlockWorkerResponse =
  | { readonly type: "progress"; readonly phase: "loading-engine" | "inspecting" | "decrypting" | "verifying"; readonly message: string }
  | { readonly type: "inspection"; readonly requiresPassword: boolean }
  | { readonly type: "success"; readonly output: ArrayBuffer; readonly pageCount: number }
  | { readonly type: "error"; readonly message: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<UnlockRequest>) => void) | null;
  postMessage(message: UnlockWorkerResponse, transfer?: Transferable[]): void;
};

workerScope.onmessage = (event) => { void run(event.data); };

async function run(request: UnlockRequest): Promise<void> {
  try {
    workerScope.postMessage({ type: "progress", phase: "loading-engine", message: "Loading the local PDF security engine" });
    const toolkit = await createPdfToolkit();
    if (request.type === "inspect") {
      workerScope.postMessage({ type: "progress", phase: "inspecting", message: "Checking PDF protection" });
      const bytes = new Uint8Array(request.input);
      if (!(await toolkit.isEncrypted(bytes))) throw new Error("This PDF is not password protected. No password needs to be removed.");
      workerScope.postMessage({ type: "inspection", requiresPassword: await toolkit.requiresPassword(bytes) });
      return;
    }

    workerScope.postMessage({ type: "progress", phase: "decrypting", message: "Removing the PDF password locally" });
    const outputBytes = await toolkit.unlock(new Uint8Array(request.input), { password: request.password });
    workerScope.postMessage({ type: "progress", phase: "verifying", message: "Verifying the unlocked PDF" });
    const info = await toolkit.getInfo(outputBytes);
    if (info.encrypted || info.pageCount < 1) throw new Error("The unlocked PDF failed verification.");
    const output = outputBytes.slice().buffer;
    workerScope.postMessage({ type: "success", output, pageCount: info.pageCount }, [output]);
  } catch (error) {
    const message = error instanceof PdfPasswordError
      ? "That password did not unlock this PDF. Check it and try again."
      : error instanceof Error
        ? error.message
        : "The PDF password could not be removed.";
    workerScope.postMessage({ type: "error", message });
  }
}
