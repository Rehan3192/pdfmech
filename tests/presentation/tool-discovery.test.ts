import { describe, expect, it } from "vitest";
import { guideForToolPath, relatedTools } from "../../src/tool-discovery";

describe("tool discovery links", () => {
  it("gives an orphan-prone mobile guide meaningful incoming relationships", () => {
    expect(relatedTools("/add-text-to-pdf").map((item) => item.path)).toContain(
      "/edit-pdf-on-iphone",
    );
    expect(relatedTools("/edit-pdf-on-iphone")).toHaveLength(4);
  });

  it("connects relevant tools to their practical guides", () => {
    expect(guideForToolPath("/ocr-pdf")?.path).toBe(
      "/blog/how-to-make-a-scanned-pdf-searchable",
    );
    expect(guideForToolPath("/split-pdf-and-rename")?.path).toBe(
      "/blog/how-to-split-a-pdf-and-rename-each-file",
    );
    expect(guideForToolPath("/protect-pdf")).toBeNull();
  });
});
