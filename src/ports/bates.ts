import type { BatesPosition, BatesSequenceSettings } from "../domain/bates";

export interface BatesInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly hasSignatures: boolean;
}

export interface BatesFileRequest {
  readonly file: File;
  readonly pageIndexes: readonly number[];
}

export interface BatesProcessOptions extends BatesSequenceSettings {
  readonly position: BatesPosition;
  readonly fontSize: number;
  readonly color: string;
  readonly margin: number;
}

export interface BatesOutputFile {
  readonly sourceName: string;
  readonly downloadName: string;
  readonly blob: Blob;
  readonly numberedPageCount: number;
  readonly firstLabel: string;
  readonly lastLabel: string;
}

export interface BatesProcessResult {
  readonly files: readonly BatesOutputFile[];
  readonly numberedPageCount: number;
}

export interface BatesProgress {
  readonly completedFiles: number;
  readonly totalFiles: number;
  readonly currentFileName: string;
}

export interface BatesNumberer {
  inspect(file: File): Promise<BatesInspection>;
  process(
    files: readonly BatesFileRequest[],
    options: BatesProcessOptions,
    onProgress: (progress: BatesProgress) => void,
  ): Promise<BatesProcessResult>;
}

