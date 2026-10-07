export interface SignaturePlacement {
  readonly id: string;
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export function signatureHeightRatio(
  widthRatio: number,
  signatureAspect: number,
  pageWidth: number,
  pageHeight: number,
): number {
  if (![widthRatio, signatureAspect, pageWidth, pageHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Signature dimensions are invalid.");
  }
  return widthRatio * (pageWidth / pageHeight) / signatureAspect;
}

export function clampSignaturePlacement(
  placement: SignaturePlacement,
  signatureAspect: number,
  pageWidth: number,
  pageHeight: number,
): SignaturePlacement {
  const width = Math.min(.7, Math.max(.08, placement.width));
  const height = signatureHeightRatio(width, signatureAspect, pageWidth, pageHeight);
  return {
    ...placement,
    width,
    x: Math.min(1 - width, Math.max(0, placement.x)),
    y: Math.min(Math.max(0, 1 - height), Math.max(0, placement.y)),
  };
}

export function validateSignaturePlacements(
  placements: readonly SignaturePlacement[],
  pageCount: number,
): void {
  if (placements.length === 0) throw new Error("Add at least one signature to the PDF.");
  for (const placement of placements) {
    if (!Number.isInteger(placement.pageIndex) || placement.pageIndex < 0 || placement.pageIndex >= pageCount) {
      throw new Error("A signature is placed outside this PDF.");
    }
    if (![placement.x, placement.y, placement.width].every(Number.isFinite) || placement.width <= 0 || placement.x < 0 || placement.y < 0) {
      throw new Error("A signature placement is invalid.");
    }
  }
}
