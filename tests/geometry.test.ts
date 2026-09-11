import { describe, expect, it } from "vitest";
import {
  applyMatrix,
  invertMatrix,
  transformFrameBounds,
  type AffineMatrix,
} from "../src/geometry";

const closePoint = (
  actual: { x: number; y: number },
  expected: { x: number; y: number },
): void => {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
};

describe("affine coordinate transforms", () => {
  it.each([
    {
      name: "identity",
      matrix: [1, 0, 0, 1, 0, 0] as AffineMatrix,
      point: { x: 17.25, y: -4.5 },
    },
    {
      name: "PDF bottom-left to canonical top-left",
      matrix: [1, 0, 0, -1, -40, 800] as AffineMatrix,
      point: { x: 92.5, y: 710.25 },
    },
    {
      name: "clockwise quarter turn with offset",
      matrix: [0, 1, 1, 0, -80, -40] as AffineMatrix,
      point: { x: 250.75, y: 340.5 },
    },
    {
      name: "counterclockwise quarter turn with offset",
      matrix: [0, -1, -1, 0, 900, 700] as AffineMatrix,
      point: { x: -20.125, y: 93.75 },
    },
  ])("round-trips $name", ({ matrix, point }) => {
    const inverse = invertMatrix(matrix);
    closePoint(applyMatrix(inverse, applyMatrix(matrix, point)), point);
  });

  it("rejects a singular matrix", () => {
    expect(() => invertMatrix([1, 2, 2, 4, 0, 0])).toThrow(/not invertible/i);
  });

  it("rejects non-finite coordinates", () => {
    expect(() =>
      applyMatrix([1, 0, 0, 1, 0, 0], {
        x: Number.NaN,
        y: 2,
      }),
    ).toThrow(/non-finite/i);
  });

  it("transforms all frame corners before calculating bounds", () => {
    const rotatedClockwise: AffineMatrix = [0, 1, -1, 0, 792, 0];
    expect(
      transformFrameBounds(rotatedClockwise, {
        x: 100,
        y: 200,
        width: 80,
        height: 30,
      }),
    ).toEqual({
      x: 562,
      y: 100,
      width: 30,
      height: 80,
    });
  });
});
