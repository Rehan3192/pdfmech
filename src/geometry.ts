export type AffineMatrix = readonly [
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
];

export interface Point {
  x: number;
  y: number;
}

export interface Frame extends Point {
  width: number;
  height: number;
}

const MIN_DETERMINANT = 1e-12;

function assertFinite(values: readonly number[]): void {
  if (!values.every(Number.isFinite)) {
    throw new Error("Geometry contains a non-finite number.");
  }
}

export function applyMatrix(matrix: AffineMatrix, point: Point): Point {
  assertFinite([...matrix, point.x, point.y]);
  const [a, b, c, d, e, f] = matrix;
  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f,
  };
}

export function applyVector(matrix: AffineMatrix, vector: Point): Point {
  assertFinite([...matrix, vector.x, vector.y]);
  const [a, b, c, d] = matrix;
  return {
    x: a * vector.x + c * vector.y,
    y: b * vector.x + d * vector.y,
  };
}

export function invertMatrix(matrix: AffineMatrix): AffineMatrix {
  assertFinite(matrix);
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;

  if (Math.abs(determinant) < MIN_DETERMINANT) {
    throw new Error("Geometry matrix is not invertible.");
  }

  const inverse: AffineMatrix = [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
  assertFinite(inverse);
  return inverse;
}

export function transformFrameBounds(
  matrix: AffineMatrix,
  frame: Frame,
): Frame {
  const points = [
    applyMatrix(matrix, { x: frame.x, y: frame.y }),
    applyMatrix(matrix, { x: frame.x + frame.width, y: frame.y }),
    applyMatrix(matrix, { x: frame.x, y: frame.y + frame.height }),
    applyMatrix(matrix, {
      x: frame.x + frame.width,
      y: frame.y + frame.height,
    }),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
