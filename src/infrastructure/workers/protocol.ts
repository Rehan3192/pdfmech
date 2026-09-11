import type { DocumentId } from "../../domain/primitives";
import type { EditorError } from "../../domain/errors";

export interface WorkerRequest<TPayload> {
  readonly protocolVersion: 1;
  readonly requestId: string;
  readonly documentId: DocumentId;
  readonly documentRevision?: number;
  readonly operation: string;
  readonly payload: TPayload;
}

export type WorkerResponse<TResult> =
  | {
      readonly protocolVersion: 1;
      readonly requestId: string;
      readonly ok: true;
      readonly result: TResult;
    }
  | {
      readonly protocolVersion: 1;
      readonly requestId: string;
      readonly ok: false;
      readonly error: EditorError;
    };

export function isWorkerRequest(value: unknown): value is WorkerRequest<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.protocolVersion === 1 &&
    typeof candidate.requestId === "string" &&
    typeof candidate.documentId === "string" &&
    typeof candidate.operation === "string" &&
    "payload" in candidate
  );
}
