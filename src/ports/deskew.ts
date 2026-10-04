export interface DeskewPageInspection {
  readonly pageIndex: number;
  readonly width: number;
  readonly height: number;
  readonly suggestedAngle: number;
  readonly thumbnail: Blob;
}

export interface DeskewInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly pages: readonly DeskewPageInspection[];
}

export interface DeskewAdjustment {
  readonly pageIndex: number;
  readonly angle: number;
}

export interface DeskewProgress {
  readonly phase: "analyzing" | "rendering" | "writing" | "validating";
  readonly pageNumber: number | null;
  readonly totalPages: number;
  readonly completedPages: number;
  readonly message: string;
}

export interface DeskewResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly correctedPageCount: number;
  readonly preservedPageCount: number;
  readonly pageCount: number;
}

export interface DeskewProcessor {
  inspect(
    file: File,
    onProgress: (progress: DeskewProgress) => void,
    signal?: AbortSignal,
  ): Promise<DeskewInspection>;
  process(
    file: File,
    adjustments: readonly DeskewAdjustment[],
    onProgress: (progress: DeskewProgress) => void,
    signal?: AbortSignal,
  ): Promise<DeskewResult>;
}

