import { describe, expect, it } from "vitest";

import { createEmptyEditorSession } from "../../src/app/editor-session";

describe("createEmptyEditorSession", () => {
  it("starts with an empty document history", () => {
    const session = createEmptyEditorSession();

    expect(session.document).toBeNull();
    expect(session.history).toMatchObject({
      past: [],
      present: null,
      future: [],
      limit: 100,
    });
    expect(session.busy).toBe(false);
  });
});
