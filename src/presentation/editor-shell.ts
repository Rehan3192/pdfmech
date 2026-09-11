export type EditorPanel = "pages" | "tools" | "properties" | "export";

export interface EditorShellState {
  readonly activePanel: EditorPanel;
  readonly documentOpen: boolean;
  readonly exportEnabled: boolean;
  readonly recoveryEnabled: boolean;
}

export function createInitialShellState(): EditorShellState {
  return {
    activePanel: "pages",
    documentOpen: false,
    exportEnabled: false,
    recoveryEnabled: true,
  };
}
