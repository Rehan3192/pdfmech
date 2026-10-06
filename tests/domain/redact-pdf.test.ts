import { describe, expect, it } from "vitest";

import { createNormalizedRedaction, isValidRedaction, redactedPageCount } from "../../src/domain/redact-pdf";

describe("PDF redaction geometry", () => {
  it("normalizes reverse drag coordinates and clamps them to a page", () => {
    const redaction = createNormalizedRedaction("r1", 2, { x: 1.2, y: .8 }, { x: .25, y: -.2 });
    expect(redaction).toEqual({ id: "r1", pageIndex: 2, x: .25, y: 0, width: .75, height: .8 });
    expect(isValidRedaction(redaction!, 3)).toBe(true);
  });

  it("rejects taps and counts unique affected pages", () => {
    expect(createNormalizedRedaction("tiny", 0, { x: .2, y: .2 }, { x: .204, y: .3 })).toBeNull();
    const first = createNormalizedRedaction("a", 0, { x: .1, y: .1 }, { x: .3, y: .2 })!;
    const second = createNormalizedRedaction("b", 0, { x: .4, y: .4 }, { x: .5, y: .5 })!;
    const third = createNormalizedRedaction("c", 3, { x: .1, y: .1 }, { x: .2, y: .2 })!;
    expect(redactedPageCount([first, second, third])).toBe(2);
  });
});
