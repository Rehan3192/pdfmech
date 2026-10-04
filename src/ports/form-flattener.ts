export interface FormFieldSummary {
  readonly name: string;
  readonly type: string;
}

export interface FormInspection {
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly fields: readonly FormFieldSummary[];
  readonly hasXfa: boolean;
  readonly hasSignatures: boolean;
}

export interface FlattenFormResult {
  readonly blob: Blob;
  readonly downloadName: string;
  readonly flattenedFieldCount: number;
  readonly pageCount: number;
}

export interface FormFlattener {
  inspect(file: File): Promise<FormInspection>;
  flatten(file: File): Promise<FlattenFormResult>;
}

