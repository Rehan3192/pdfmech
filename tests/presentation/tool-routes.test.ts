import { describe, expect, it } from "vitest";
import {
  ACTIVE_TOOL_ROUTES,
  TOOL_ROUTES,
  activeToolRouteFromPath,
} from "../../src/tool-routes";

describe("tool route registry", () => {
  it("publishes the fully implemented task routes", () => {
    expect(ACTIVE_TOOL_ROUTES.map((route) => route.key)).toEqual([
      "addTextToPdf",
      "deletePdfPages",
      "reorderPdfPages",
      "rotatePdfPages",
      "whiteoutPdf",
    ]);
    expect(TOOL_ROUTES.addTextToPdf).toMatchObject({
      slug: "/add-text-to-pdf",
      editorMode: "text",
      initialAction: "add-text",
      status: "active",
    });
    expect(TOOL_ROUTES.deletePdfPages).toMatchObject({
      slug: "/delete-pdf-pages",
      editorMode: "pages",
      initialAction: "delete",
      status: "active",
    });
    expect(TOOL_ROUTES.reorderPdfPages).toMatchObject({
      slug: "/reorder-pdf-pages",
      editorMode: "pages",
      initialAction: "reorder",
      status: "active",
    });
    expect(TOOL_ROUTES.rotatePdfPages).toMatchObject({
      slug: "/rotate-pdf-pages",
      editorMode: "pages",
      initialAction: "rotate",
      status: "active",
    });
    expect(TOOL_ROUTES.whiteoutPdf).toMatchObject({
      slug: "/whiteout-pdf",
      editorMode: "whiteout",
      initialAction: "draw",
      status: "active",
    });
  });

  it("normalizes trailing slashes and does not expose planned routes", () => {
    expect(activeToolRouteFromPath("/add-text-to-pdf/")?.key).toBe(
      "addTextToPdf",
    );
    expect(activeToolRouteFromPath("/delete-pdf-pages/")?.key).toBe(
      "deletePdfPages",
    );
    expect(activeToolRouteFromPath("/reorder-pdf-pages/")?.key).toBe(
      "reorderPdfPages",
    );
    expect(activeToolRouteFromPath("/rotate-pdf-pages/")?.key).toBe(
      "rotatePdfPages",
    );
    expect(activeToolRouteFromPath("/whiteout-pdf/")?.key).toBe(
      "whiteoutPdf",
    );
    expect(activeToolRouteFromPath("/not-a-tool")).toBeNull();
  });
});
