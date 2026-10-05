import { describe, expect, it } from "vitest";

import { comparePdfText, createTextComparisonReport, type ExtractedTextDocument } from "../../src/domain/pdf-compare";

function document(fileName: string, pages: readonly (readonly string[])[]): ExtractedTextDocument {
  return {
    fileName,
    byteLength: 100,
    pageCount: pages.length,
    pages: pages.map((lines, index) => ({ pageNumber: index + 1, lines })),
    characterCount: pages.flat().join("").length,
  };
}

describe("PDF text comparison", () => {
  it("reports added and removed lines by page", () => {
    const result = comparePdfText(
      document("old.pdf", [["Agreement", "Payment is due in 30 days."], ["Unchanged page"]]),
      document("new.pdf", [["Agreement", "Payment is due in 15 days."], ["Unchanged page"]]),
      { ignoreCase: false, ignoreWhitespace: true },
    );

    expect(result).toMatchObject({ changedPageCount: 1, unchangedPageCount: 1, addedLineCount: 1, removedLineCount: 1 });
    expect(result.pages[0]?.lines).toEqual([
      { kind: "equal", text: "Agreement", oldLineNumber: 1, newLineNumber: 1 },
      { kind: "removed", text: "Payment is due in 30 days.", oldLineNumber: 2, newLineNumber: null },
      { kind: "added", text: "Payment is due in 15 days.", oldLineNumber: null, newLineNumber: 2 },
    ]);
  });

  it("can ignore capitalization and whitespace", () => {
    const result = comparePdfText(
      document("old.pdf", [["Payment   Due"]]),
      document("new.pdf", [["payment due"]]),
      { ignoreCase: true, ignoreWhitespace: true },
    );

    expect(result.changedPageCount).toBe(0);
  });

  it("marks whole pages added or removed and creates a report", () => {
    const result = comparePdfText(
      document("old.pdf", [["Page one"], ["Removed page"]]),
      document("new.pdf", [["Page one"]]),
      { ignoreCase: false, ignoreWhitespace: true },
    );

    expect(result.pages[1]?.status).toBe("removed");
    expect(createTextComparisonReport(result)).toContain("- Removed page");
    expect(createTextComparisonReport(result)).toContain("Visual, image, formatting, and layout-only changes are not included.");
  });
});
