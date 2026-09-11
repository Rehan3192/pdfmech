import { describe, expect, it } from "vitest";

import {
  canonicalFrameToCss,
  createDuplicateFrame,
  createDefaultTextFrame,
  createDefaultWhiteoutFrame,
  moveFrameByViewportDelta,
  resizeFrameByViewportDelta,
  viewportPointToCanonical,
} from "../../src/app/overlay-coordinate-layer";
import { asPdfPoint } from "../../src/domain/primitives";

const pageSize = {
  width: asPdfPoint(612),
  height: asPdfPoint(792),
};

describe("overlay coordinate layer", () => {
  it("converts viewport clicks into zoom-independent canonical points", () => {
    expect(
      viewportPointToCanonical({
        x: 180,
        y: 210,
        zoom: 1.5,
        pageSize,
      }),
    ).toEqual({ x: 120, y: 140 });
  });

  it("converts canonical frames into zoomed CSS frames for display only", () => {
    expect(
      canonicalFrameToCss(
        {
          x: asPdfPoint(120),
          y: asPdfPoint(140),
          width: asPdfPoint(180),
          height: asPdfPoint(28),
        },
        1.5,
      ),
    ).toEqual({
      left: 180,
      top: 210,
      width: 270,
      height: 42,
    });
  });

  it("clamps draft text overlays inside the selected page", () => {
    const frame = createDefaultTextFrame({
      point: { x: asPdfPoint(600), y: asPdfPoint(790) },
      pageSize,
    });

    expect(frame).toEqual({
      x: 432,
      y: 764,
      width: 180,
      height: 28,
    });
  });

  it("creates default whiteout overlays in canonical page coordinates", () => {
    const frame = createDefaultWhiteoutFrame({
      point: { x: asPdfPoint(600), y: asPdfPoint(790) },
      pageSize,
    });

    expect(frame).toEqual({
      x: 432,
      y: 756,
      width: 180,
      height: 36,
    });
  });

  it("moves frames by viewport deltas without storing zoom-scaled coordinates", () => {
    const frame = moveFrameByViewportDelta({
      frame: {
        x: asPdfPoint(120),
        y: asPdfPoint(140),
        width: asPdfPoint(180),
        height: asPdfPoint(28),
      },
      deltaX: 60,
      deltaY: 30,
      zoom: 1.5,
      pageSize,
    });

    expect(frame).toEqual({
      x: 160,
      y: 160,
      width: 180,
      height: 28,
    });
  });

  it("clamps moved frames inside page bounds", () => {
    const frame = moveFrameByViewportDelta({
      frame: {
        x: asPdfPoint(120),
        y: asPdfPoint(140),
        width: asPdfPoint(180),
        height: asPdfPoint(28),
      },
      deltaX: 1_000,
      deltaY: 1_000,
      zoom: 1,
      pageSize,
    });

    expect(frame).toEqual({
      x: 432,
      y: 764,
      width: 180,
      height: 28,
    });
  });

  it("resizes frames by viewport deltas without storing zoom-scaled dimensions", () => {
    const frame = resizeFrameByViewportDelta({
      frame: {
        x: asPdfPoint(160),
        y: asPdfPoint(160),
        width: asPdfPoint(180),
        height: asPdfPoint(28),
      },
      deltaX: 60,
      deltaY: 30,
      zoom: 1.5,
      pageSize,
    });

    expect(frame).toEqual({
      x: 160,
      y: 160,
      width: 220,
      height: 48,
    });
  });

  it("clamps resized frames to minimum size and selected page bounds", () => {
    const shrunkenFrame = resizeFrameByViewportDelta({
      frame: {
        x: asPdfPoint(160),
        y: asPdfPoint(160),
        width: asPdfPoint(180),
        height: asPdfPoint(28),
      },
      deltaX: -1_000,
      deltaY: -1_000,
      zoom: 1,
      pageSize,
    });
    const expandedFrame = resizeFrameByViewportDelta({
      frame: {
        x: asPdfPoint(500),
        y: asPdfPoint(760),
        width: asPdfPoint(180),
        height: asPdfPoint(28),
      },
      deltaX: 1_000,
      deltaY: 1_000,
      zoom: 1,
      pageSize,
    });

    expect(shrunkenFrame).toEqual({
      x: 160,
      y: 160,
      width: 24,
      height: 16,
    });
    expect(expandedFrame).toEqual({
      x: 500,
      y: 760,
      width: 112,
      height: 32,
    });
  });

  it("creates duplicate frames with a canonical offset inside page bounds", () => {
    expect(
      createDuplicateFrame({
        frame: {
          x: asPdfPoint(120),
          y: asPdfPoint(140),
          width: asPdfPoint(180),
          height: asPdfPoint(28),
        },
        pageSize,
      }),
    ).toEqual({
      x: 136,
      y: 156,
      width: 180,
      height: 28,
    });
  });

  it("falls duplicate frames back up-left when down-right is clamped", () => {
    expect(
      createDuplicateFrame({
        frame: {
          x: asPdfPoint(432),
          y: asPdfPoint(764),
          width: asPdfPoint(180),
          height: asPdfPoint(28),
        },
        pageSize,
      }),
    ).toEqual({
      x: 416,
      y: 748,
      width: 180,
      height: 28,
    });
  });
});
