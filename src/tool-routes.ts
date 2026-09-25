export type ToolRouteKey =
  | "addTextToPdf"
  | "deletePdfPages"
  | "reorderPdfPages"
  | "rotatePdfPages"
  | "whiteoutPdf"
  | "privatePdfEditor";

export type ToolEditorMode = "text" | "pages" | "whiteout" | "general";
export type ToolInitialAction =
  | "add-text"
  | "delete"
  | "reorder"
  | "rotate"
  | "draw"
  | "general";

export interface ToolRouteDefinition {
  readonly key: ToolRouteKey;
  readonly slug: string;
  readonly editorMode: ToolEditorMode;
  readonly initialAction: ToolInitialAction;
  readonly category: "edit" | "organize" | "privacy";
  readonly seoIntent: string;
  readonly status: "active" | "planned";
}

export type ProductEventName =
  | "tool_landing_view"
  | "pdf_selected"
  | "editor_loaded"
  | "edit_action"
  | "export_clicked"
  | "export_success";

export interface ProductEvent {
  readonly name: ProductEventName;
  readonly tool: ToolInitialAction | "general";
}

export const TOOL_ROUTES: Readonly<Record<ToolRouteKey, ToolRouteDefinition>> = {
  addTextToPdf: {
    key: "addTextToPdf",
    slug: "/add-text-to-pdf",
    editorMode: "text",
    initialAction: "add-text",
    category: "edit",
    seoIntent: "add text to PDF online",
    status: "active",
  },
  deletePdfPages: {
    key: "deletePdfPages",
    slug: "/delete-pdf-pages",
    editorMode: "pages",
    initialAction: "delete",
    category: "organize",
    seoIntent: "delete PDF pages online",
    status: "active",
  },
  reorderPdfPages: {
    key: "reorderPdfPages",
    slug: "/reorder-pdf-pages",
    editorMode: "pages",
    initialAction: "reorder",
    category: "organize",
    seoIntent: "reorder PDF pages online",
    status: "active",
  },
  rotatePdfPages: {
    key: "rotatePdfPages",
    slug: "/rotate-pdf-pages",
    editorMode: "pages",
    initialAction: "rotate",
    category: "organize",
    seoIntent: "rotate PDF pages online",
    status: "active",
  },
  whiteoutPdf: {
    key: "whiteoutPdf",
    slug: "/whiteout-pdf",
    editorMode: "whiteout",
    initialAction: "draw",
    category: "edit",
    seoIntent: "white out PDF content online",
    status: "active",
  },
  privatePdfEditor: {
    key: "privatePdfEditor",
    slug: "/private-pdf-editor",
    editorMode: "general",
    initialAction: "general",
    category: "privacy",
    seoIntent: "private PDF editor without upload",
    status: "active",
  },
};

export const ACTIVE_TOOL_ROUTES = Object.values(TOOL_ROUTES).filter(
  (route) => route.status === "active",
);

export function activeToolRouteFromPath(
  pathname: string,
): ToolRouteDefinition | null {
  const normalizedPath =
    pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  return (
    ACTIVE_TOOL_ROUTES.find((route) => route.slug === normalizedPath) ?? null
  );
}
