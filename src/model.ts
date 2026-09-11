import type { AffineMatrix, Frame } from "./geometry";

export type Tool = "text" | "whiteout";

interface BaseEdit {
  id: string;
  pageIndex: number;
  frame: Frame;
}

export interface TextEdit extends BaseEdit {
  kind: "text";
  text: string;
  fontSize: number;
  color: readonly [number, number, number];
}

export interface WhiteoutEdit extends BaseEdit {
  kind: "whiteout";
}

export type Edit = TextEdit | WhiteoutEdit;

export interface PageGeometry {
  pageIndex: number;
  width: number;
  height: number;
  pdfToCanonical: AffineMatrix;
  canonicalToPdf: AffineMatrix;
  rotation: number;
}
