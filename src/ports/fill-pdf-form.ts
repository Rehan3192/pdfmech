import type { FillableFieldKind, FormFieldValue } from "../domain/fill-pdf-form";

export interface FillableFormField {
  readonly name: string;
  readonly label: string;
  readonly kind: FillableFieldKind | "unsupported";
  readonly value: FormFieldValue;
  readonly options: readonly string[];
  readonly readOnly: boolean;
  readonly multiline: boolean;
  readonly maxLength: number | null;
  readonly typeLabel: string;
}

export interface FillPdfFormInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly fields: readonly FillableFormField[];
  readonly hasXfa: boolean;
  readonly hasSignatures: boolean;
}

export interface FillPdfFormResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly pageCount: number;
  readonly updatedFieldCount: number;
  readonly flattened: boolean;
}

export interface FillPdfFormProcessor {
  inspect(file: File): Promise<FillPdfFormInspection>;
  fill(
    file: File,
    values: Readonly<Record<string, FormFieldValue>>,
    flatten: boolean,
  ): Promise<FillPdfFormResult>;
}
