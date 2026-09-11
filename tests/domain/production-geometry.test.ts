import { describe, expect, it } from "vitest";

import {
  getCropBoxSize,
  rotateFrameClockwise,
  rotatePointClockwise,
} from "../../src/domain/geometry";
import { asPdfPoint, normalizeDegrees } from "../../src/domain/primitives";

describe("production canonical geometry", () => {
  it("keeps page rotation constrained to right angles", () => {
    expect(normalizeDegrees(450)).toBe(90);
    expect(normalizeDegrees(-90)).toBe(270);
    expect(() => normalizeDegrees(45)).toThrow(/multiple of 90/);
  });

  it("derives positive crop-box dimensions", () => {
    expect(
      getCropBoxSize({
        xMin: asPdfPoint(10),
        yMin: asPdfPoint(20),
        xMax: asPdfPoint(622),
        yMax: asPdfPoint(812),
      }),
    ).toEqual({
      width: 612,
      height: 792,
    });
  });

  it("rotates points using the approved canonical formulas", () => {
    const size = { width: asPdfPoint(200), height: asPdfPoint(100) };
    const point = { x: asPdfPoint(30), y: asPdfPoint(40) };

    expect(rotatePointClockwise(point, size, 90)).toEqual({ x: 60, y: 30 });
    expect(rotatePointClockwise(point, size, 180)).toEqual({ x: 170, y: 60 });
    expect(rotatePointClockwise(point, size, 270)).toEqual({ x: 40, y: 170 });
  });

  it("rotates frames edge-to-edge instead of rotating only the origin", () => {
    const size = { width: asPdfPoint(200), height: asPdfPoint(100) };
    const frame = {
      x: asPdfPoint(30),
      y: asPdfPoint(40),
      width: asPdfPoint(50),
      height: asPdfPoint(20),
    };

    expect(rotateFrameClockwise(frame, size, 90)).toEqual({
      x: 40,
      y: 30,
      width: 20,
      height: 50,
    });
    expect(rotateFrameClockwise(frame, size, 180)).toEqual({
      x: 120,
      y: 40,
      width: 50,
      height: 20,
    });
    expect(rotateFrameClockwise(frame, size, 270)).toEqual({
      x: 40,
      y: 120,
      width: 20,
      height: 50,
    });
  });
});
