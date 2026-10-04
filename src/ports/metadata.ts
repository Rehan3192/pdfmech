export interface PdfMetadataField {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly kind: "standard" | "custom";
}

export interface PdfMetadataInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly fields: readonly PdfMetadataField[];
  readonly hasXmp: boolean;
  readonly hasSignatures: boolean;
}

export interface PdfMetadataRemovalOptions {
  readonly fieldKeys: readonly string[];
  readonly removeXmp: boolean;
}

export interface PdfMetadataRemovalResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly removedFieldCount: number;
  readonly removedXmp: boolean;
  readonly pageCount: number;
}

export interface PdfMetadataProcessor {
  inspect(file: File): Promise<PdfMetadataInspection>;
  remove(
    file: File,
    options: PdfMetadataRemovalOptions,
  ): Promise<PdfMetadataRemovalResult>;
}
