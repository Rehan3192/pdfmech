import { describe, expect, it } from "vitest";

import {
  calculateFitZoom,
  clampPageIndex,
  formatZoom,
  getAdjacentPageIndex,
  getZoomBounds,
  parseZoomLevel,
  scaleZoom,
  stepZoom,
} from "../../src/presentation/viewer-controls";

describe("viewer controls", () => {
  it("parses only approved zoom levels", () => {
    expect(parseZoomLevel("1.5", 1)).toBe(1.5);
    expect(parseZoomLevel("3", 1)).toBe(3);
    expect(parseZoomLevel("8", 1)).toBe(4);
    expect(parseZoomLevel("not-a-number", 1.25)).toBe(1.25);
  });

  it("formats zoom levels for compact controls", () => {
    expect(formatZoom(0.75)).toBe("75%");
    expect(formatZoom(1.25)).toBe("125%");
    expect(formatZoom(1.37)).toBe("137%");
  });

  it("calculates fit-width and fit-page zoom levels inside safe bounds", () => {
    expect(
      calculateFitZoom({
        pageWidth: 612,
        pageHeight: 792,
        viewportWidth: 918,
        viewportHeight: 900,
        mode: "width",
      }),
    ).toBe(1.5);
    expect(
      calculateFitZoom({
        pageWidth: 612,
        pageHeight: 792,
        viewportWidth: 918,
        viewportHeight: 900,
        mode: "page",
      }),
    ).toBe(1.13);
    expect(
      calculateFitZoom({
        pageWidth: 100,
        pageHeight: 100,
        viewportWidth: 900,
        viewportHeight: 900,
        mode: "page",
      }),
    ).toBe(4);
  });

  it("keeps page navigation inside document bounds", () => {
    expect(clampPageIndex(-3, 4)).toBe(0);
    expect(clampPageIndex(10, 4)).toBe(3);
    expect(getAdjacentPageIndex(0, 4, -1)).toBe(0);
    expect(getAdjacentPageIndex(2, 4, 1)).toBe(3);
  });

  it("supports smooth document zoom steps inside safe bounds", () => {
    expect(stepZoom({ currentZoom: 1, direction: "in" })).toBe(1.1);
    expect(stepZoom({ currentZoom: 1.1, direction: "out" })).toBe(1);
    expect(scaleZoom({ currentZoom: 1, scaleFactor: 1.5 })).toBe(1.5);
    expect(scaleZoom({ currentZoom: 1, scaleFactor: 0.5 })).toBe(0.5);
    expect(scaleZoom({ currentZoom: 1, scaleFactor: Number.NaN })).toBe(1);
    expect(stepZoom({ currentZoom: 4, direction: "in" })).toBe(4);
    expect(stepZoom({ currentZoom: 0.25, direction: "out" })).toBe(0.25);
    expect(getZoomBounds()).toEqual({ min: 0.25, max: 4 });
  });
});
