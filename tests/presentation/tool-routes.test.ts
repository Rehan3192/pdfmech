import { describe, expect, it } from "vitest";
import {
  ACTIVE_TOOL_ROUTES,
  TOOL_ROUTES,
  activeToolRouteFromPath,
} from "../../src/tool-routes";

describe("tool route registry", () => {
  it("publishes only the fully implemented add-text route", () => {
    expect(ACTIVE_TOOL_ROUTES.map((route) => route.key)).toEqual([
      "addTextToPdf",
    ]);
    expect(TOOL_ROUTES.addTextToPdf).toMatchObject({
      slug: "/add-text-to-pdf",
      editorMode: "text",
      initialAction: "add-text",
      status: "active",
    });
  });

  it("normalizes trailing slashes and does not expose planned routes", () => {
    expect(activeToolRouteFromPath("/add-text-to-pdf/")?.key).toBe(
      "addTextToPdf",
    );
    expect(activeToolRouteFromPath("/delete-pdf-pages")).toBeNull();
    expect(activeToolRouteFromPath("/not-a-tool")).toBeNull();
  });
});
