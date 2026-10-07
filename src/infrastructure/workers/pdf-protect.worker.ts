import { createPdfToolkit } from "pdfstudio";

import type { ProtectPdfPermissions } from "../../domain/protect-pdf";

interface ProtectRequest {
  readonly type: "protect";
  readonly input: ArrayBuffer;
  readonly password: string;
  readonly permissions: ProtectPdfPermissions;
}

type ProtectWorkerResponse =
  | { readonly type: "progress"; readonly phase: "loading-engine" | "encrypting" | "verifying"; readonly message: string }
  | { readonly type: "success"; readonly output: ArrayBuffer; readonly pageCount: number }
  | { readonly type: "error"; readonly message: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<ProtectRequest>) => void) | null;
  postMessage(message: ProtectWorkerResponse, transfer?: Transferable[]): void;
};

workerScope.onmessage = (event) => {
  if (event.data.type !== "protect") return;
  void protect(event.data);
};

async function protect(request: ProtectRequest): Promise<void> {
  try {
    workerScope.postMessage({ type: "progress", phase: "loading-engine", message: "Loading the AES-256 encryption engine" });
    const toolkit = await createPdfToolkit();
    workerScope.postMessage({ type: "progress", phase: "encrypting", message: "Encrypting your PDF locally" });
    const outputBytes = await toolkit.lock(new Uint8Array(request.input), {
      userPassword: request.password,
      ownerPassword: createOwnerPassword(),
      keyLength: 256,
      permissions: {
        print: request.permissions.printing ? "full" : "none",
        modify: request.permissions.editing ? "all" : "none",
        extract: request.permissions.copying,
      },
    });
    workerScope.postMessage({ type: "progress", phase: "verifying", message: "Verifying password protection" });
    const info = await toolkit.getInfo(outputBytes, { password: request.password });
    if (!info.encrypted || info.encryption?.bits !== 256 || info.pageCount < 1) {
      throw new Error("The protected PDF failed encryption verification.");
    }
    const output = outputBytes.slice().buffer;
    workerScope.postMessage({ type: "success", output, pageCount: info.pageCount }, [output]);
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "The PDF could not be password protected.",
    });
  }
}

function createOwnerPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
