import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import type {
  EditObject,
  EditorDocument,
  RgbaColor,
  TextObject,
} from "../domain/document";
import { getCropBoxSize } from "../domain/geometry";
import type { GeneratedPdf, RenderedPage } from "../ports/pdf";
import type { RecoveryStore, RecoverySummary } from "../ports/recovery";
import {
  canRedoDocumentChange,
  canUndoDocumentChange,
  commitDocumentChange,
  createDocumentHistory,
  redoDocumentChange,
  resetDocumentHistory,
  undoDocumentChange,
} from "../app/document-history";
import {
  createRecoveryCheckpoint,
  verifyRecoveryCheckpoint,
} from "../app/recovery-checkpoint";
import {
  canonicalFrameToCss,
  createDuplicateFrame,
  createDefaultRedactionFrame,
  createDefaultTextFrame,
  createDefaultWhiteoutFrame,
  moveFrameByViewportDelta,
  resizeFrameByViewportDelta,
  viewportPointToCanonical,
} from "../app/overlay-coordinate-layer";
import type { CanonicalFrame, CanonicalPageSize } from "../domain/geometry";
import { asUnitInterval } from "../domain/primitives";
import type { ObjectId } from "../domain/primitives";
import {
  ZOOM_LEVELS,
  calculateFitZoom,
  formatZoom,
  getAdjacentPageIndex,
  isZoomLevel,
  parseZoomLevel,
  scaleZoom,
  stepZoom,
  type ZoomLevel,
} from "./viewer-controls";
import { safeErrorMessage } from "./error-messages";

interface ProductionAppProps {
  readonly openDocument: (file: File) => Promise<EditorDocument>;
  readonly renderPage: (
    document: EditorDocument,
    pageIndex: number,
    scale: number,
  ) => Promise<RenderedPage>;
  readonly closeDocument: (document: EditorDocument) => Promise<void>;
  readonly exportDocument: (document: EditorDocument) => Promise<GeneratedPdf>;
  readonly createTextObject: (
    document: EditorDocument,
    input: {
      readonly pageIndex: number;
      readonly frame: CanonicalFrame;
      readonly text: string;
    },
  ) => { readonly document: EditorDocument; readonly objectId: ObjectId };
  readonly createWhiteoutObject: (
    document: EditorDocument,
    input: {
      readonly pageIndex: number;
      readonly frame: CanonicalFrame;
    },
  ) => { readonly document: EditorDocument; readonly objectId: ObjectId };
  readonly createRedactionObject: (
    document: EditorDocument,
    input: {
      readonly pageIndex: number;
      readonly frame: CanonicalFrame;
    },
  ) => { readonly document: EditorDocument; readonly objectId: ObjectId };
  readonly deleteObject: (
    document: EditorDocument,
    objectId: ObjectId,
  ) => EditorDocument;
  readonly moveObject: (
    document: EditorDocument,
    objectId: ObjectId,
    frame: CanonicalFrame,
  ) => EditorDocument;
  readonly resizeObject: (
    document: EditorDocument,
    objectId: ObjectId,
    frame: CanonicalFrame,
  ) => EditorDocument;
  readonly updateTextObjectContent: (
    document: EditorDocument,
    objectId: ObjectId,
    text: string,
  ) => EditorDocument;
  readonly updateTextObjectAppearance: (
    document: EditorDocument,
    objectId: ObjectId,
    input: {
      readonly fontFamily: TextObject["font"]["family"];
      readonly fontWeight: TextObject["font"]["weight"];
      readonly fontSize: number;
      readonly color: RgbaColor;
      readonly horizontalAlignment: TextObject["horizontalAlignment"];
    },
  ) => EditorDocument;
  readonly updateWhiteoutObjectAppearance: (
    document: EditorDocument,
    objectId: ObjectId,
    input: {
      readonly color: RgbaColor;
    },
  ) => EditorDocument;
  readonly updateRedactionObjectAppearance: (
    document: EditorDocument,
    objectId: ObjectId,
    input: {
      readonly color: RgbaColor;
    },
  ) => EditorDocument;
  readonly duplicateObject: (
    document: EditorDocument,
    sourceObjectId: ObjectId,
    frame: CanonicalFrame,
  ) => { readonly document: EditorDocument; readonly objectId: ObjectId };
  readonly rotatePage: (
    document: EditorDocument,
    pageIndex: number,
    deltaDegrees: number,
  ) => EditorDocument;
  readonly movePage: (
    document: EditorDocument,
    fromIndex: number,
    toIndex: number,
  ) => EditorDocument;
  readonly deletePage: (
    document: EditorDocument,
    pageIndex: number,
  ) => EditorDocument;
  readonly recoveryStore?: RecoveryStore;
  readonly restoreRecoveredDocument?: (
    summary: RecoverySummary,
  ) => Promise<EditorDocument>;
  readonly now?: () => string;
}

type StatusKind = "idle" | "working" | "ready" | "error";
type CreationTool = "text" | "whiteout" | "redaction";

interface StatusState {
  readonly kind: StatusKind;
  readonly text: string;
}

type RenderState =
  | { readonly kind: "empty" }
  | { readonly kind: "loading"; readonly pageIndex: number }
  | {
      readonly kind: "ready";
      readonly pageIndex: number;
      readonly renderedPage: RenderedPage;
    }
  | { readonly kind: "error"; readonly pageIndex: number; readonly text: string };

interface DragSession {
  readonly pointerId: number;
  readonly objectId: ObjectId;
  readonly objectKind: EditObject["kind"];
  readonly documentAtDragStart: EditorDocument;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startFrame: CanonicalFrame;
  readonly pageSize: CanonicalPageSize;
  readonly zoom: ZoomLevel;
  latestFrame: CanonicalFrame;
}

interface ResizeSession {
  readonly pointerId: number;
  readonly objectId: ObjectId;
  readonly objectKind: EditObject["kind"];
  readonly documentAtResizeStart: EditorDocument;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startFrame: CanonicalFrame;
  readonly pageSize: CanonicalPageSize;
  readonly zoom: ZoomLevel;
  latestFrame: CanonicalFrame;
}

interface PanSession {
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startScrollLeft: number;
  readonly startScrollTop: number;
}

interface DragPreview {
  readonly objectId: ObjectId;
  readonly frame: CanonicalFrame;
}

interface TextAppearanceDraft {
  readonly fontFamily: TextObject["font"]["family"];
  readonly fontWeight: TextObject["font"]["weight"];
  readonly fontSize: string;
  readonly color: string;
  readonly horizontalAlignment: TextObject["horizontalAlignment"];
}

const textFontFamilyOptions: readonly TextObject["font"]["family"][] = [
  "arial",
  "helvetica",
  "times",
  "courier",
  "roboto",
  "open-sans",
  "montserrat",
  "lato",
  "poppins",
  "inter",
  "playfair-display",
  "source-sans-pro",
];
const textAlignmentOptions: readonly TextObject["horizontalAlignment"][] = [
  "left",
  "center",
  "right",
];
const defaultAppearanceDraft: TextAppearanceDraft = {
  fontFamily: "helvetica",
  fontWeight: "regular",
  fontSize: "14",
  color: "#121726",
  horizontalAlignment: "left",
};
const localEditingLimits = {
  maxFileSize: "100 MB",
  maxPages: "500 pages",
  maxZoom: "400%",
} as const;

const defaultNow = () => new Date().toISOString();
const tutorialStorageKey = "pdfmech-editor-tutorial-complete";
const MINIMUM_PINCH_DISTANCE = 20;

const tutorialSteps = [
  {
    title: "Start with Open PDF",
    text:
      "Choose a PDF from your device. PDFMech opens it in your browser so you can make quick fixes.",
  },
  {
    title: "Add text that matches your PDF",
    text:
      "Use the text tool to place words on the page. After selecting text, you can change the font, size, color, bold style, and alignment.",
  },
  {
    title: "Use color to blend with the page",
    text:
      "For text, pick a color that matches the document. For whiteout, pick a cover color that blends with scanned paper or off-white backgrounds.",
  },
  {
    title: "Organize pages when needed",
    text:
      "Use the page tools to rotate pages, move pages earlier or later, or delete pages you do not need.",
  },
  {
    title: "Download your fixed PDF",
    text:
      "Download creates a new edited PDF. Your original file stays unchanged on your device.",
  },
] as const;

function createEditedFilename(originalName: string | null): string {
  const fallback = "edited.pdf";
  if (originalName === null || originalName.trim().length === 0) {
    return fallback;
  }

  const trimmed = originalName.trim();
  const withoutPath = trimmed.split(/[/\\]/).at(-1) ?? trimmed;
  const pdfExtension = /\.pdf$/i;
  if (pdfExtension.test(withoutPath)) {
    return withoutPath.replace(pdfExtension, "-edited.pdf");
  }

  return `${withoutPath}-edited.pdf`;
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function colorChannelToHex(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");
}

function rgbaColorToHex(color: RgbaColor): string {
  return `#${colorChannelToHex(color.red)}${colorChannelToHex(
    color.green,
  )}${colorChannelToHex(color.blue)}`;
}

function hexToRgbaColor(hex: string): RgbaColor {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new RangeError("Text color must be a valid hex color.");
  }

  return {
    red: Number.parseInt(hex.slice(1, 3), 16) / 255,
    green: Number.parseInt(hex.slice(3, 5), 16) / 255,
    blue: Number.parseInt(hex.slice(5, 7), 16) / 255,
    alpha: asUnitInterval(1),
  };
}

function rgbaColorToCss(color: RgbaColor): string {
  const red = Math.round(color.red * 255);
  const green = Math.round(color.green * 255);
  const blue = Math.round(color.blue * 255);
  return `rgb(${red} ${green} ${blue} / ${color.alpha})`;
}

function textFontFamilyToCss(fontFamily: TextObject["font"]["family"]): string {
  switch (fontFamily) {
    case "arial":
    case "helvetica":
      return "Arial, Helvetica, sans-serif";
    case "times":
      return "\"Times New Roman\", Times, serif";
    case "courier":
      return "\"Courier New\", Courier, monospace";
    case "roboto":
      return "Roboto, sans-serif";
    case "open-sans":
      return "\"Open Sans\", sans-serif";
    case "montserrat":
      return "Montserrat, sans-serif";
    case "lato":
      return "Lato, sans-serif";
    case "poppins":
      return "Poppins, sans-serif";
    case "inter":
      return "Inter, sans-serif";
    case "playfair-display":
      return "\"Playfair Display\", serif";
    case "source-sans-pro":
      return "\"Source Sans 3\", sans-serif";
  }
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

export function ProductionApp({
  openDocument,
  renderPage,
  closeDocument,
  exportDocument,
  createTextObject,
  createWhiteoutObject,
  createRedactionObject,
  deleteObject,
  moveObject,
  resizeObject,
  updateTextObjectContent,
  updateTextObjectAppearance,
  updateWhiteoutObjectAppearance,
  updateRedactionObjectAppearance,
  duplicateObject,
  rotatePage: rotateDocumentPage,
  movePage: moveDocumentPage,
  deletePage: deleteDocumentPage,
  recoveryStore,
  restoreRecoveredDocument,
  now = defaultNow,
}: ProductionAppProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const productionShellRef = useRef<HTMLDivElement | null>(null);
  const renderPanelRef = useRef<HTMLElement | null>(null);
  const renderRequestId = useRef(0);
  const dragSessionRef = useRef<DragSession | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const panSessionRef = useRef<PanSession | null>(null);
  const pendingTextFocusIdRef = useRef<ObjectId | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);
  const [documentHistory, setDocumentHistory] = useState(() =>
    createDocumentHistory(),
  );
  const documentState = documentHistory.present;
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [zoom, setZoom] = useState<ZoomLevel>(1);
  const [creationTool, setCreationTool] = useState<CreationTool>("text");
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [placementArmed, setPlacementArmed] = useState(false);
  const [panModeEnabled, setPanModeEnabled] = useState(false);
  const [pageStripVisible, setPageStripVisible] = useState(true);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [toolRailVisible, setToolRailVisible] = useState(true);
  const [propertiesVisible, setPropertiesVisible] = useState(true);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<ObjectId | null>(
    null,
  );
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [appearanceDraft, setAppearanceDraft] = useState<TextAppearanceDraft>(
    defaultAppearanceDraft,
  );
  const [renderState, setRenderState] = useState<RenderState>({
    kind: "empty",
  });
  const [isPdfDragOver, setIsPdfDragOver] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState<StatusState>({
    kind: "idle",
    text: "No document open.",
  });
  const [recoveryStatus, setRecoveryStatus] = useState<StatusState>({
    kind: "idle",
    text:
      recoveryStore === undefined
        ? "Local recovery unavailable."
        : "Local recovery ready.",
  });
  const [recoverableDocuments, setRecoverableDocuments] = useState<
    readonly RecoverySummary[]
  >([]);
  const [tutorialStepIndex, setTutorialStepIndex] = useState<number | null>(
    null,
  );
  const canUndo = canUndoDocumentChange(documentHistory);
  const canRedo = canRedoDocumentChange(documentHistory);
  const canRestoreRecoveredDocument =
    restoreRecoveredDocument !== undefined &&
    documentState === null &&
    recoverableDocuments.length > 0;

  const activeSource = useMemo(() => {
    if (documentState === null) {
      return null;
    }

    return Object.values(documentState.sources)[0] ?? null;
  }, [documentState]);

  const selectedPageSize = useMemo(() => {
    const page = documentState?.pages[selectedPageIndex];
    return page === undefined ? null : getCropBoxSize(page.geometry.cropBox);
  }, [documentState, selectedPageIndex]);

  const selectedPageObjects = useMemo(() => {
    const page = documentState?.pages[selectedPageIndex];
    if (documentState === null || page === undefined) {
      return [];
    }

    return (documentState.objectOrderByPage[page.id] ?? [])
      .map((objectId) => documentState.objects[objectId])
      .filter((object) => object !== undefined);
  }, [documentState, selectedPageIndex]);

  const selectedObject = useMemo(() => {
    if (documentState === null || selectedObjectId === null) {
      return null;
    }

    return documentState.objects[selectedObjectId] ?? null;
  }, [documentState, selectedObjectId]);

  const selectedTextObject =
    selectedObject?.kind === "text" ? selectedObject : null;
  const selectedWhiteoutObject =
    selectedObject?.kind === "whiteout" ? selectedObject : null;
  const selectedRedactionObject =
    selectedObject?.kind === "redaction" ? selectedObject : null;
  const propertiesTool =
    selectedObject?.kind ?? (editingEnabled ? creationTool : "select");
  const normalizedTextDraft = textDraft.trim();
  const canApplyTextDraft =
    selectedTextObject !== null &&
    normalizedTextDraft.length > 0 &&
    normalizedTextDraft !== selectedTextObject.text;
  const documentPanEnabled = panModeEnabled;

  const currentTutorialStep =
    tutorialStepIndex === null ? null : tutorialSteps[tutorialStepIndex];
  const tutorialPosition =
    tutorialStepIndex === null
      ? ""
      : `Step ${tutorialStepIndex + 1} of ${tutorialSteps.length}`;

function finishTutorial(): void {
    try {
      localStorage.setItem(tutorialStorageKey, "true");
    } catch {
      // The tutorial is helpful, not critical. If storage is blocked, just close it.
    }

    setTutorialStepIndex(null);
  }

  function skipTutorialStep(): void {
    if (
      tutorialStepIndex === null ||
      tutorialStepIndex >= tutorialSteps.length - 1
    ) {
      finishTutorial();
      return;
    }

    setTutorialStepIndex(tutorialStepIndex + 1);
  }

  function goToNextTutorialStep(): void {
    skipTutorialStep();
  }

  function goToPreviousTutorialStep(): void {
    if (tutorialStepIndex === null || tutorialStepIndex === 0) {
      return;
    }

    setTutorialStepIndex(tutorialStepIndex - 1);
  }

  useEffect(() => {
    try {
      if (localStorage.getItem(tutorialStorageKey) === "true") {
        return;
      }
    } catch {
      // If storage is blocked, still show the guide for this session.
    }

    setTutorialStepIndex(0);
  }, []);

  useEffect(() => {
    const updateFullscreenState = () => {
      setFullscreenEnabled(document.fullscreenElement === productionShellRef.current);
    };
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  useEffect(() => {
    setTextDraft(selectedTextObject?.text ?? "");
  }, [selectedTextObject?.id, selectedTextObject?.text]);

  useEffect(() => {
    const pendingObjectId = pendingTextFocusIdRef.current;
    if (
      pendingObjectId === null ||
      selectedObjectId !== pendingObjectId ||
      !editingEnabled
    ) {
      return;
    }

    const editableTextElement = Array.from(
      document.querySelectorAll<HTMLElement>("[data-text-object-id]"),
    ).find((element) => element.dataset.textObjectId === pendingObjectId);
    if (editableTextElement === undefined) {
      return;
    }

    pendingTextFocusIdRef.current = null;
    focusEditableTextAtEnd(editableTextElement);
  }, [editingEnabled, selectedObjectId, selectedPageObjects]);

  useEffect(() => {
    setAppearanceDraft(
      selectedTextObject === null
        ? defaultAppearanceDraft
        : {
            fontFamily: selectedTextObject.font.family,
            fontWeight: selectedTextObject.font.weight,
            fontSize: selectedTextObject.fontSize.toString(),
            color: rgbaColorToHex(selectedTextObject.color),
            horizontalAlignment: selectedTextObject.horizontalAlignment,
          },
    );
  }, [
    selectedTextObject?.id,
    selectedTextObject?.font.family,
    selectedTextObject?.font.weight,
    selectedTextObject?.fontSize,
    selectedTextObject?.color,
    selectedTextObject?.horizontalAlignment,
  ]);

  useEffect(() => {
    if (renderState.kind !== "ready") {
      return;
    }

    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const { renderedPage } = renderState;
    canvas.width = renderedPage.width;
    canvas.height = renderedPage.height;
    const context = canvas.getContext("2d");
    if (context !== null) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(renderedPage.bitmap, 0, 0);
    }

    return () => {
      renderedPage.bitmap.close();
    };
  }, [renderState]);

  useEffect(() => {
    const renderPanel = renderPanelRef.current;
    if (renderPanel === null) {
      return;
    }

    const options: AddEventListenerOptions = { passive: false };
    const preventBrowserWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };
    const preventBrowserTouchZoom = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        event.preventDefault();
      }
    };
    const preventBrowserGestureZoom = (event: Event) => {
      event.preventDefault();
    };

    renderPanel.addEventListener("wheel", preventBrowserWheelZoom, options);
    renderPanel.addEventListener("touchmove", preventBrowserTouchZoom, options);
    renderPanel.addEventListener(
      "gesturestart",
      preventBrowserGestureZoom,
      options,
    );
    renderPanel.addEventListener(
      "gesturechange",
      preventBrowserGestureZoom,
      options,
    );

    return () => {
      renderPanel.removeEventListener("wheel", preventBrowserWheelZoom, options);
      renderPanel.removeEventListener(
        "touchmove",
        preventBrowserTouchZoom,
        options,
      );
      renderPanel.removeEventListener(
        "gesturestart",
        preventBrowserGestureZoom,
        options,
      );
      renderPanel.removeEventListener(
        "gesturechange",
        preventBrowserGestureZoom,
        options,
      );
    };
  }, [documentState !== null]);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      const commandKey = event.ctrlKey || event.metaKey;
      const editableTarget = isEditableKeyboardTarget(event.target);

      if (commandKey && key === "z" && event.shiftKey && canRedo) {
        event.preventDefault();
        redoLastChange();
        return;
      }

      if (commandKey && key === "z" && !event.shiftKey && canUndo) {
        event.preventDefault();
        undoLastChange();
        return;
      }

      if (commandKey && key === "s" && documentState !== null) {
        event.preventDefault();
        void downloadDocument();
        return;
      }

      if (key === "escape" && selectedObjectId !== null) {
        event.preventDefault();
        setSelectedObjectId(null);
        setStatus({ kind: "ready", text: "Deselected object." });
        return;
      }

      if (editableTarget) {
        return;
      }

      if (
        (key === "delete" || key === "backspace") &&
        documentState !== null &&
        selectedObjectId !== null
      ) {
        event.preventDefault();
        removeSelectedObject();
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcut);
    };
  }, [
    canRedo,
    canUndo,
    documentState,
    selectedObjectId,
    redoLastChange,
    undoLastChange,
    downloadDocument,
    removeSelectedObject,
  ]);

  useEffect(() => {
    const store = recoveryStore;
    if (store === undefined) {
      return;
    }

    let cancelled = false;

    async function refreshRecoverableDocuments(): Promise<void> {
      try {
        await store!.deleteExpired(now());
        const summaries = await store!.listRecoverable();
        if (cancelled) {
          return;
        }

        const verifiedSummaries: RecoverySummary[] = [];
        for (const summary of summaries) {
          const checkpoint = await store!.load(summary.documentId);
          if (
            checkpoint !== null &&
            (await verifyRecoveryCheckpoint(checkpoint))
          ) {
            verifiedSummaries.push(summary);
          }
        }

        setRecoverableDocuments(verifiedSummaries);
        setRecoveryStatus({
          kind: "ready",
          text:
            verifiedSummaries.length === 0
              ? "Local recovery ready."
              : `${verifiedSummaries.length} restorable local document${
                  verifiedSummaries.length === 1 ? "" : "s"
                } found.`,
        });
      } catch {
        if (!cancelled) {
          setRecoveryStatus({
            kind: "error",
            text: "Local recovery is unavailable in this browser.",
          });
        }
      }
    }

    void refreshRecoverableDocuments();

    return () => {
      cancelled = true;
    };
  }, [now, recoveryStore]);

  useEffect(() => {
    const store = recoveryStore;
    const documentToSave = documentState;
    if (store === undefined || documentToSave === null) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      async function saveRecoveryCheckpoint(): Promise<void> {
        try {
          const checkpoint = await createRecoveryCheckpoint({
            document: documentToSave!,
            now: now(),
          });
          const outcome = await store!.save(checkpoint);
          if (cancelled) {
            return;
          }

          if (outcome.ok) {
            setRecoverableDocuments(await store!.listRecoverable());
            setRecoveryStatus({
              kind: "ready",
              text: `Autosaved locally at ${new Date(
                checkpoint.createdAt,
              ).toLocaleTimeString()}.`,
            });
          } else {
            setRecoveryStatus({
              kind: "error",
              text:
                outcome.reason === "quota"
                  ? "Local recovery storage is full."
                  : "Local recovery is unavailable in this browser.",
            });
          }
        } catch {
          if (!cancelled) {
            setRecoveryStatus({
              kind: "error",
              text: "Local recovery checkpoint could not be saved.",
            });
          }
        }
      }

      void saveRecoveryCheckpoint();
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [documentState, now, recoveryStore]);

  async function renderSelectedPage(
    document: EditorDocument,
    pageIndex: number,
    nextZoom: ZoomLevel,
  ): Promise<void> {
    const requestId = (renderRequestId.current += 1);
    setRenderState({ kind: "loading", pageIndex });
    setStatus({
      kind: "working",
      text: `Rendering page ${pageIndex + 1} locally at ${formatZoom(nextZoom)}...`,
    });

    try {
      const renderedPage = await renderPage(document, pageIndex, nextZoom);
      if (requestId !== renderRequestId.current) {
        renderedPage.bitmap.close();
        return;
      }

      setRenderState({ kind: "ready", pageIndex, renderedPage });
      setStatus({
        kind: "ready",
        text: `Rendered page ${pageIndex + 1} locally at ${formatZoom(nextZoom)}.`,
      });
    } catch (error) {
      if (requestId !== renderRequestId.current) {
        return;
      }

      const text = safeErrorMessage(error);
      setRenderState({ kind: "error", pageIndex, text });
      setStatus({ kind: "error", text });
    }
  }

  async function openSelectedPdf(file: File): Promise<void> {
    const previousDocument = documentState;
    if (previousDocument !== null) {
      const previousSource = Object.values(previousDocument.sources)[0] ?? null;
      const confirmed = window.confirm(
        `Open another PDF?\n\nYour current document${
          previousSource === null ? "" : ` (${previousSource.originalName})`
        } has local edit state in this browser. Opening another PDF will close it. Your original PDF will not be changed.`,
      );
      if (!confirmed) {
        setStatus({
          kind: "ready",
          text: "Kept current document open.",
        });
        return;
      }
    }

    if (previousDocument !== null) {
      await closeDocument(previousDocument);
    }
    setDocumentHistory((history) => resetDocumentHistory(history, null));
    setRenderState({ kind: "empty" });
    setSelectedPageIndex(0);
    setZoom(1);
    setSelectedObjectId(null);
    setStatus({ kind: "working", text: "Opening locally..." });

    try {
      const opened = await openDocument(file);
      const openedSource = Object.values(opened.sources)[0] ?? null;
      if (recoveryStore !== undefined && openedSource !== null) {
        const sourceOutcome = await recoveryStore.saveSourceBlob({
          sourceId: openedSource.id,
          originalName: openedSource.originalName,
          byteLength: openedSource.byteLength,
          sha256: openedSource.fingerprint,
          blob: file,
        });
        if (!sourceOutcome.ok) {
          setRecoveryStatus({
            kind: "error",
            text:
              sourceOutcome.reason === "quota"
                ? "Local recovery storage is full."
                : "Local PDF recovery storage is unavailable.",
          });
        }
      }
      setDocumentHistory((history) => resetDocumentHistory(history, opened));
      setSelectedPageIndex(0);
      setZoom(1);
      setEditingEnabled(false);
      setPlacementArmed(false);
      setPanModeEnabled(false);
      setSelectedObjectId(null);
      setStatus({
        kind: "ready",
        text: `Opened ${opened.pages.length} page${
          opened.pages.length === 1 ? "" : "s"
        } locally. View mode is on. Click Edit PDF when you want to add text or covers.`,
      });
      await renderSelectedPage(opened, 0, 1);
    } catch (error) {
      setStatus({ kind: "error", text: safeErrorMessage(error) });
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const inputElement = event.currentTarget;
    const [file] = inputElement.files ?? [];
    if (file === undefined) {
      return;
    }

    await openSelectedPdf(file);
    inputElement.value = "";
  }

  function handlePdfDragOver(event: ReactDragEvent<HTMLElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsPdfDragOver(true);
  }

  function handlePdfDragLeave(event: ReactDragEvent<HTMLElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsPdfDragOver(false);
    }
  }

  function handlePdfDrop(event: ReactDragEvent<HTMLElement>): void {
    event.preventDefault();
    setIsPdfDragOver(false);
    const [file] = event.dataTransfer.files;
    if (file === undefined) {
      return;
    }

    void openSelectedPdf(file);
  }

  function commitDocument(nextDocument: EditorDocument): void {
    setDocumentHistory((history) =>
      commitDocumentChange(history, nextDocument),
    );
  }

  async function clearDocument(): Promise<void> {
    const documentToClear = documentState;
    if (documentToClear !== null) {
      const source = Object.values(documentToClear.sources)[0] ?? null;
      const confirmed = window.confirm(
        `Clear this session?\n\nThis closes the current document${
          source === null ? "" : ` (${source.originalName})`
        } and deletes its local recovery data from this browser. Your original PDF file is not changed.`,
      );
      if (!confirmed) {
        setStatus({
          kind: "ready",
          text: "Kept current document open.",
        });
        return;
      }
    }

    if (documentState !== null) {
      await closeDocument(documentState);
    }

    if (recoveryStore !== undefined && documentToClear !== null) {
      try {
        await recoveryStore.delete(documentToClear.id);
        setRecoverableDocuments(await recoveryStore.listRecoverable());
        setRecoveryStatus({
          kind: "ready",
          text: "Cleared this document's local recovery checkpoint.",
        });
      } catch {
        setRecoveryStatus({
          kind: "error",
          text: "Local recovery checkpoint could not be cleared.",
        });
      }
    }

    setDocumentHistory((history) => resetDocumentHistory(history, null));
    setRenderState({ kind: "empty" });
    setSelectedPageIndex(0);
    setZoom(1);
    setSelectedObjectId(null);
    setEditingEnabled(false);
    setPlacementArmed(false);
    setPanModeEnabled(false);
    setStatus({
      kind: "idle",
      text: "Session cleared. The original PDF file was not changed.",
    });
  }

  async function restoreMostRecentDocument(): Promise<void> {
    if (!canRestoreRecoveredDocument || restoreRecoveredDocument === undefined) {
      return;
    }

    const [summary] = recoverableDocuments;
    if (summary === undefined) {
      return;
    }

    setStatus({ kind: "working", text: "Restoring local recovery..." });
    setRecoveryStatus({ kind: "working", text: "Restoring local document..." });

    try {
      const restored = await restoreRecoveredDocument(summary);
      setDocumentHistory((history) => resetDocumentHistory(history, restored));
      setSelectedPageIndex(0);
      setZoom(1);
      setSelectedObjectId(null);
      setEditingEnabled(false);
      setPlacementArmed(false);
      setPanModeEnabled(false);
      setRecoveryStatus({
        kind: "ready",
        text: "Restored from local recovery.",
      });
      setStatus({
        kind: "ready",
        text: `Restored ${restored.pages.length} page${
          restored.pages.length === 1 ? "" : "s"
        } from local recovery. View mode is on. Click Edit PDF when you want to edit.`,
      });
      await renderSelectedPage(restored, 0, 1);
    } catch (error) {
      const text = safeErrorMessage(error);
      setRecoveryStatus({ kind: "error", text });
      setStatus({ kind: "error", text });
    }
  }

  function restoreDocumentHistory(input: {
    readonly history: ReturnType<typeof undoDocumentChange>;
    readonly statusText: string;
  }): void {
    const nextDocument = input.history.present;
    const nextPageIndex =
      nextDocument !== null && selectedPageIndex >= nextDocument.pages.length
        ? Math.max(0, nextDocument.pages.length - 1)
        : selectedPageIndex;
    setDocumentHistory(input.history);
    setSelectedObjectId((objectId) =>
      objectId !== null && nextDocument?.objects[objectId] !== undefined
        ? objectId
        : null,
    );

    if (nextPageIndex !== selectedPageIndex) {
      setSelectedPageIndex(nextPageIndex);
    }

    setStatus({
      kind: "ready",
      text: input.statusText,
    });

    if (nextDocument !== null) {
      void renderSelectedPage(nextDocument, nextPageIndex, zoom);
    }
  }

  function undoLastChange(): void {
    if (!canUndo) {
      return;
    }

    restoreDocumentHistory({
      history: undoDocumentChange(documentHistory),
      statusText: "Undid last edit.",
    });
  }

  function redoLastChange(): void {
    if (!canRedo) {
      return;
    }

    restoreDocumentHistory({
      history: redoDocumentChange(documentHistory),
      statusText: "Redid last edit.",
    });
  }

  async function downloadDocument(): Promise<void> {
    if (documentState === null || isDownloading) {
      return;
    }

    const source = Object.values(documentState.sources)[0] ?? null;
    const editedFilename = createEditedFilename(source?.originalName ?? null);
    setIsDownloading(true);
    setStatus({ kind: "working", text: "Generating PDF locally..." });

    try {
      await waitForNextPaint();
      setStatus({ kind: "working", text: "Validating generated PDF locally..." });
      await waitForNextPaint();
      const generated = await exportDocument(documentState);
      const blob = new Blob([Uint8Array.from(generated.bytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = editedFilename;
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus({
        kind: "ready",
        text: `Download ready locally as ${editedFilename} (${formatBytes(generated.bytes.byteLength)}).`,
      });
    } catch (error) {
      setStatus({ kind: "error", text: safeErrorMessage(error) });
    } finally {
      setIsDownloading(false);
    }
  }

  function choosePage(pageIndex: number): void {
    if (documentState === null || pageIndex === selectedPageIndex) {
      return;
    }

    setSelectedPageIndex(pageIndex);
    setSelectedObjectId(null);
    void renderSelectedPage(documentState, pageIndex, zoom);
  }

  function rotateCurrentPage(): void {
    if (documentState === null) {
      return;
    }

    const nextDocument = rotateDocumentPage(documentState, selectedPageIndex, 90);
    commitDocument(nextDocument);
    setSelectedObjectId(null);
    setStatus({
      kind: "ready",
      text: `Rotated page ${selectedPageIndex + 1} clockwise.`,
    });
    void renderSelectedPage(nextDocument, selectedPageIndex, zoom);
  }

  function moveCurrentPageEarlier(): void {
    if (documentState === null || selectedPageIndex === 0) {
      return;
    }

    const nextPageIndex = selectedPageIndex - 1;
    const nextDocument = moveDocumentPage(
      documentState,
      selectedPageIndex,
      nextPageIndex,
    );
    commitDocument(nextDocument);
    setSelectedPageIndex(nextPageIndex);
    setSelectedObjectId(null);
    setStatus({
      kind: "ready",
      text: `Moved page ${selectedPageIndex + 1} earlier.`,
    });
    void renderSelectedPage(nextDocument, nextPageIndex, zoom);
  }

  function moveCurrentPageLater(): void {
    if (
      documentState === null ||
      selectedPageIndex >= documentState.pages.length - 1
    ) {
      return;
    }

    const nextPageIndex = selectedPageIndex + 1;
    const nextDocument = moveDocumentPage(
      documentState,
      selectedPageIndex,
      nextPageIndex,
    );
    commitDocument(nextDocument);
    setSelectedPageIndex(nextPageIndex);
    setSelectedObjectId(null);
    setStatus({
      kind: "ready",
      text: `Moved page ${selectedPageIndex + 1} later.`,
    });
    void renderSelectedPage(nextDocument, nextPageIndex, zoom);
  }

  function deleteCurrentPage(): void {
    if (documentState === null) {
      return;
    }

    const deletedPageNumber = selectedPageIndex + 1;
    const nextDocument = deleteDocumentPage(documentState, selectedPageIndex);
    const nextPageIndex = Math.min(
      selectedPageIndex,
      Math.max(0, nextDocument.pages.length - 1),
    );
    commitDocument(nextDocument);
    setSelectedPageIndex(nextPageIndex);
    setSelectedObjectId(null);
    setStatus({
      kind: "ready",
      text: `Deleted page ${deletedPageNumber}.`,
    });

    if (nextDocument.pages.length === 0) {
      setRenderState({ kind: "empty" });
      return;
    }

    void renderSelectedPage(nextDocument, nextPageIndex, zoom);
  }

  function movePage(direction: -1 | 1): void {
    if (documentState === null) {
      return;
    }

    const nextPageIndex = getAdjacentPageIndex(
      selectedPageIndex,
      documentState.pages.length,
      direction,
    );
    choosePage(nextPageIndex);
  }

  function changeZoom(value: string): void {
    const nextZoom = parseZoomLevel(value, zoom);
    applyDocumentZoom(nextZoom);
  }

  function applyDocumentZoom(nextZoom: ZoomLevel): void {
    setZoom(nextZoom);
    if (documentState !== null) {
      void renderSelectedPage(documentState, selectedPageIndex, nextZoom);
    }
  }

  function fitZoom(mode: "width" | "page"): void {
    if (
      documentState === null ||
      selectedPageSize === null ||
      renderPanelRef.current === null
    ) {
      return;
    }

    const bounds = renderPanelRef.current.getBoundingClientRect();
    const nextZoom = calculateFitZoom({
      pageWidth: selectedPageSize.width,
      pageHeight: selectedPageSize.height,
      viewportWidth: Math.max(1, bounds.width - 32),
      viewportHeight: Math.max(1, bounds.height - 32),
      mode,
    });
    setZoom(nextZoom);
    void renderSelectedPage(documentState, selectedPageIndex, nextZoom);
  }

  function zoomDocumentWithWheel(
    event: ReactWheelEvent<HTMLElement>,
  ): void {
    if (documentState === null || !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    const nextZoom = stepZoom({
      currentZoom: zoom,
      direction: event.deltaY < 0 ? "in" : "out",
    });
    applyDocumentZoom(nextZoom);
  }

  function zoomDocumentWithTouch(
    event: ReactTouchEvent<HTMLElement>,
  ): void {
    if (documentState === null || event.touches.length !== 2) {
      pinchDistanceRef.current = null;
      return;
    }

    const firstTouch = event.touches[0];
    const secondTouch = event.touches[1];
    if (firstTouch === undefined || secondTouch === undefined) {
      return;
    }

    const nextDistance = getTouchDistance(firstTouch, secondTouch);
    if (nextDistance < MINIMUM_PINCH_DISTANCE) {
      return;
    }

    event.preventDefault();
    const previousDistance = pinchDistanceRef.current;
    pinchDistanceRef.current = nextDistance;
    if (previousDistance === null) {
      return;
    }

    const nextZoom = scaleZoom({
      currentZoom: zoom,
      scaleFactor: nextDistance / previousDistance,
    });
    applyDocumentZoom(nextZoom);
  }

  function finishTouchZoom(): void {
    pinchDistanceRef.current = null;
  }

  function addOverlayObject(event: ReactPointerEvent<HTMLDivElement>): void {
    if (
      documentState === null ||
      selectedPageSize === null ||
      panModeEnabled ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    if (!editingEnabled || !placementArmed) {
      setSelectedObjectId(null);
      setEditingEnabled(false);
      setPlacementArmed(false);
      setStatus({
        kind: "ready",
        text: "Select mode is on. Choose a tool when you want to add another object.",
      });
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const point = viewportPointToCanonical({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      zoom,
      pageSize: selectedPageSize,
    });
    const frame =
      creationTool === "text"
        ? createDefaultTextFrame({
            point,
            pageSize: selectedPageSize,
          })
        : creationTool === "whiteout"
          ? createDefaultWhiteoutFrame({
              point,
              pageSize: selectedPageSize,
            })
          : createDefaultRedactionFrame({
              point,
              pageSize: selectedPageSize,
            });
    const result =
      creationTool === "text"
        ? createTextObject(documentState, {
            pageIndex: selectedPageIndex,
            text: "Text",
            frame,
          })
        : creationTool === "whiteout"
          ? createWhiteoutObject(documentState, {
              pageIndex: selectedPageIndex,
              frame,
            })
          : createRedactionObject(documentState, {
              pageIndex: selectedPageIndex,
              frame,
            });
    commitDocument(result.document);
    setSelectedObjectId(result.objectId);
    setPlacementArmed(false);
    if (creationTool === "text") {
      pendingTextFocusIdRef.current = result.objectId;
    }
    setStatus({
      kind: "ready",
      text:
        creationTool === "text"
          ? "Added one text box. Type inside it, or choose Add Text again to place another."
          : `Created one ${creationTool} object on page ${selectedPageIndex + 1}. Choose the tool again to place another.`,
    });
  }

  function startObjectDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    object: EditObject,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    if (documentState === null || selectedPageSize === null) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragSessionRef.current = {
      pointerId: event.pointerId,
      objectId: object.id,
      objectKind: object.kind,
      documentAtDragStart: documentState,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFrame: object.frame,
      pageSize: selectedPageSize,
      zoom,
      latestFrame: object.frame,
    };

    setPlacementArmed(false);
    setPanModeEnabled(false);
    setSelectedObjectId(object.id);
    setStatus({
      kind: "ready",
      text: `Selected ${object.kind} object.`,
    });
  }

  function continueObjectDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const session = dragSessionRef.current;
    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const nextFrame = moveFrameByViewportDelta({
      frame: session.startFrame,
      deltaX: event.clientX - session.startClientX,
      deltaY: event.clientY - session.startClientY,
      zoom: session.zoom,
      pageSize: session.pageSize,
    });

    session.latestFrame = nextFrame;
    setDragPreview({
      objectId: session.objectId,
      frame: nextFrame,
    });
  }

  function finishObjectDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const session = dragSessionRef.current;
    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragSessionRef.current = null;
    setDragPreview(null);

    const moved =
      session.latestFrame.x !== session.startFrame.x ||
      session.latestFrame.y !== session.startFrame.y;
    if (!moved) {
      if (session.objectKind === "text") {
        setEditingEnabled(true);
        setPlacementArmed(false);
        pendingTextFocusIdRef.current = session.objectId;
        setStatus({
          kind: "ready",
          text: "Text selected. Type directly inside it or use Text Properties.",
        });
      } else {
        setEditingEnabled(false);
      }
      return;
    }

    const nextDocument = moveObject(
      session.documentAtDragStart,
      session.objectId,
      session.latestFrame,
    );
    commitDocument(nextDocument);
    setSelectedObjectId(session.objectId);
    setStatus({
      kind: "ready",
      text: `Moved ${session.objectKind} object to ${session.latestFrame.x.toFixed(1)}, ${session.latestFrame.y.toFixed(1)} pt.`,
    });
  }

  function cancelObjectDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const session = dragSessionRef.current;
    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    dragSessionRef.current = null;
    setDragPreview(null);
  }

  function startObjectResize(
    event: ReactPointerEvent<HTMLDivElement>,
    object: EditObject,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    if (documentState === null || selectedPageSize === null) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    resizeSessionRef.current = {
      pointerId: event.pointerId,
      objectId: object.id,
      objectKind: object.kind,
      documentAtResizeStart: documentState,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFrame: object.frame,
      pageSize: selectedPageSize,
      zoom,
      latestFrame: object.frame,
    };

    setSelectedObjectId(object.id);
    setStatus({
      kind: "ready",
      text: `Selected ${object.kind} object.`,
    });
  }

  function continueObjectResize(
    event: ReactPointerEvent<HTMLDivElement>,
  ): void {
    const session = resizeSessionRef.current;
    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const nextFrame = resizeFrameByViewportDelta({
      frame: session.startFrame,
      deltaX: event.clientX - session.startClientX,
      deltaY: event.clientY - session.startClientY,
      zoom: session.zoom,
      pageSize: session.pageSize,
    });

    session.latestFrame = nextFrame;
    setDragPreview({
      objectId: session.objectId,
      frame: nextFrame,
    });
  }

  function finishObjectResize(event: ReactPointerEvent<HTMLDivElement>): void {
    const session = resizeSessionRef.current;
    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    resizeSessionRef.current = null;
    setDragPreview(null);

    const resized =
      session.latestFrame.width !== session.startFrame.width ||
      session.latestFrame.height !== session.startFrame.height;
    if (!resized) {
      return;
    }

    const nextDocument = resizeObject(
      session.documentAtResizeStart,
      session.objectId,
      session.latestFrame,
    );
    commitDocument(nextDocument);
    setSelectedObjectId(session.objectId);
    setStatus({
      kind: "ready",
      text: `Resized ${session.objectKind} object to ${session.latestFrame.width.toFixed(1)} x ${session.latestFrame.height.toFixed(1)} pt.`,
    });
  }

  function cancelObjectResize(event: ReactPointerEvent<HTMLDivElement>): void {
    const session = resizeSessionRef.current;
    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    resizeSessionRef.current = null;
    setDragPreview(null);
  }

  function startDocumentPan(event: ReactPointerEvent<HTMLElement>): void {
    if (
      !documentPanEnabled ||
      documentState === null ||
      renderPanelRef.current === null ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    renderPanelRef.current.setPointerCapture(event.pointerId);
    panSessionRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: renderPanelRef.current.scrollLeft,
      startScrollTop: renderPanelRef.current.scrollTop,
    };
    setSelectedObjectId(null);
    setStatus({
      kind: "ready",
      text: "Drag the document to move around.",
    });
  }

  function continueDocumentPan(event: ReactPointerEvent<HTMLElement>): void {
    const session = panSessionRef.current;
    if (
      session === null ||
      session.pointerId !== event.pointerId ||
      renderPanelRef.current === null
    ) {
      return;
    }

    event.preventDefault();
    const panel = renderPanelRef.current;
    const nextScrollLeft =
      session.startScrollLeft - (event.clientX - session.startClientX);
    const nextScrollTop =
      session.startScrollTop - (event.clientY - session.startClientY);
    panel.scrollLeft = clampScrollPosition(
      nextScrollLeft,
      panel.scrollWidth - panel.clientWidth,
    );
    panel.scrollTop = clampScrollPosition(
      nextScrollTop,
      panel.scrollHeight - panel.clientHeight,
    );
  }

  function finishDocumentPan(event: ReactPointerEvent<HTMLElement>): void {
    const session = panSessionRef.current;
    if (
      session === null ||
      session.pointerId !== event.pointerId ||
      renderPanelRef.current === null
    ) {
      return;
    }

    if (renderPanelRef.current.hasPointerCapture(event.pointerId)) {
      renderPanelRef.current.releasePointerCapture(event.pointerId);
    }
    panSessionRef.current = null;
  }

  function cancelDocumentPan(event: ReactPointerEvent<HTMLElement>): void {
    const session = panSessionRef.current;
    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    panSessionRef.current = null;
  }

  function applySelectedTextContent(): void {
    if (documentState === null || selectedTextObject === null) {
      return;
    }

    try {
      const nextDocument = updateTextObjectContent(
        documentState,
        selectedTextObject.id,
        textDraft,
      );
      commitDocument(nextDocument);
      setSelectedObjectId(selectedTextObject.id);
      setStatus({
        kind: "ready",
        text:
          nextDocument === documentState
            ? "Selected text object is already up to date."
            : "Updated selected text object.",
      });
    } catch (error) {
      setStatus({ kind: "error", text: safeErrorMessage(error) });
    }
  }

  function applyOverlayTextContent(object: TextObject, text: string): void {
    setTextDraft(text);
    if (documentState === null || text.trim() === object.text) {
      return;
    }

    try {
      const nextDocument = updateTextObjectContent(
        documentState,
        object.id,
        text,
      );
      commitDocument(nextDocument);
      setSelectedObjectId(object.id);
      setStatus({
        kind: "ready",
        text: "Updated text box.",
      });
    } catch (error) {
      setStatus({ kind: "error", text: safeErrorMessage(error) });
    }
  }

  function applySelectedTextAppearanceChange(
    nextDraft: TextAppearanceDraft,
    statusText: string,
  ): void {
    setAppearanceDraft(nextDraft);

    if (documentState === null || selectedTextObject === null) {
      return;
    }

    const fontSize = Number.parseFloat(nextDraft.fontSize);
    if (!Number.isFinite(fontSize)) {
      return;
    }

    try {
      const nextDocument = updateTextObjectAppearance(
        documentState,
        selectedTextObject.id,
        {
          fontFamily: nextDraft.fontFamily,
          fontWeight: nextDraft.fontWeight,
          fontSize,
          color: hexToRgbaColor(nextDraft.color),
          horizontalAlignment: nextDraft.horizontalAlignment,
        },
      );
      commitDocument(nextDocument);
      setSelectedObjectId(selectedTextObject.id);
      setStatus({
        kind: "ready",
        text:
          nextDocument === documentState
            ? "Selected text appearance is already up to date."
            : statusText,
      });
    } catch (error) {
      setStatus({ kind: "error", text: safeErrorMessage(error) });
    }
  }

  async function pickSelectedTextColorFromPage(): Promise<void> {
    if (selectedTextObject === null) {
      return;
    }

    const EyeDropperConstructor = (
      window as Window & {
        readonly EyeDropper?: new () => {
          open: () => Promise<{ readonly sRGBHex: string }>;
        };
      }
    ).EyeDropper;
    if (EyeDropperConstructor === undefined) {
      setStatus({
        kind: "error",
        text: "This browser does not support picking a color from the page. Use the color box instead.",
      });
      return;
    }

    try {
      const color = await new EyeDropperConstructor().open();
      applySelectedTextAppearanceChange(
        {
          ...appearanceDraft,
          color: color.sRGBHex,
        },
        "Matched selected text color from the page.",
      );
    } catch {
      setStatus({
        kind: "ready",
        text: "Color pick cancelled.",
      });
    }
  }

  function applySelectedWhiteoutColor(colorValue: string): void {
    if (documentState === null || selectedWhiteoutObject === null) {
      return;
    }

    const nextDocument = updateWhiteoutObjectAppearance(
      documentState,
      selectedWhiteoutObject.id,
      {
        color: hexToRgbaColor(colorValue),
      },
    );
    commitDocument(nextDocument);
    setSelectedObjectId(selectedWhiteoutObject.id);
    setStatus({
      kind: "ready",
      text: "Updated selected whiteout color.",
    });
  }

  function applySelectedRedactionColor(colorValue: string): void {
    if (documentState === null || selectedRedactionObject === null) {
      return;
    }

    const nextDocument = updateRedactionObjectAppearance(
      documentState,
      selectedRedactionObject.id,
      { color: hexToRgbaColor(colorValue) },
    );
    commitDocument(nextDocument);
    setSelectedObjectId(selectedRedactionObject.id);
    setStatus({
      kind: "ready",
      text: "Updated selected redaction color.",
    });
  }

  function duplicateSelectedObject(): void {
    if (
      documentState === null ||
      selectedObject === null ||
      selectedPageSize === null
    ) {
      return;
    }

    const frame = createDuplicateFrame({
      frame: selectedObject.frame,
      pageSize: selectedPageSize,
    });
    const result = duplicateObject(documentState, selectedObject.id, frame);
    commitDocument(result.document);
    setSelectedObjectId(result.objectId);
    setStatus({
      kind: "ready",
      text: `Duplicated selected object at ${frame.x.toFixed(1)}, ${frame.y.toFixed(1)} pt.`,
    });
  }

  function removeSelectedObject(): void {
    if (selectedObjectId === null) {
      return;
    }

    removeObjectById(selectedObjectId);
  }

  function removeObjectById(objectId: ObjectId): void {
    if (documentState === null) {
      return;
    }

    const nextDocument = deleteObject(documentState, objectId);
    commitDocument(nextDocument);
    setSelectedObjectId(null);
    setStatus({
      kind: "ready",
      text: "Deleted selected object.",
    });
  }

  async function toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement === productionShellRef.current) {
        await document.exitFullscreen();
      } else {
        await productionShellRef.current?.requestFullscreen();
      }
    } catch {
      setStatus({
        kind: "error",
        text: "Fullscreen mode is unavailable in this browser.",
      });
    }
  }

  return (
    <div
      ref={productionShellRef}
      className="production-shell"
      data-has-document={documentState === null ? "false" : "true"}
      data-pages-open={pageStripVisible ? "true" : "false"}
      data-toolbar-open={toolbarVisible ? "true" : "false"}
      data-tools-open={toolRailVisible ? "true" : "false"}
      data-properties-open={propertiesVisible ? "true" : "false"}
    >
      <header className="production-toolbar">
        {documentState !== null ? (
          <label className="toolbar-file-switch" title="Open another PDF">
            <span aria-hidden="true">☰</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                void handleFileChange(event);
              }}
            />
          </label>
        ) : null}
        <div className="workspace-title">
          <h1>{activeSource?.originalName ?? "PDFMech"}</h1>
          <p data-testid="privacy-boundary">
            {documentState === null
              ? "Local browser workspace"
              : `${documentState.pages.length} page${documentState.pages.length === 1 ? "" : "s"} · ${activeSource === null ? "" : formatBytes(activeSource.byteLength)} · Saved locally`}
          </p>
          {documentState !== null ? (
            <button
              className="bar-collapse-arrow toolbar-collapse-arrow"
              type="button"
              aria-label="Hide toolbar"
              title="Hide toolbar"
              onClick={() => setToolbarVisible(false)}
            >
              ⌃
            </button>
          ) : null}
        </div>
        {documentState !== null ? (
          <details className="editor-view-menu">
            <summary>View</summary>
            <div className="editor-view-menu-panel">
              <strong>Workspace layout</strong>
              <button type="button" onClick={() => setToolbarVisible(false)}>
                Hide toolbar
              </button>
              <button type="button" onClick={() => setToolRailVisible((visible) => !visible)}>
                {toolRailVisible ? "Hide tools" : "Show tools"}
              </button>
              <button type="button" onClick={() => setPropertiesVisible((visible) => !visible)}>
                {propertiesVisible ? "Hide properties" : "Show properties"}
              </button>
              <button type="button" onClick={() => setPageStripVisible((visible) => !visible)}>
                {pageStripVisible ? "Hide pages" : "Show pages"}
              </button>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
              >
                {fullscreenEnabled ? "Exit fullscreen" : "Enter fullscreen"}
              </button>
            </div>
          </details>
        ) : null}
        {documentState !== null ? (
          <button
            className="pages-toggle"
            data-testid="production-toggle-pages"
            type="button"
            aria-pressed={pageStripVisible}
            aria-expanded={pageStripVisible}
            aria-label={pageStripVisible ? "Hide page thumbnails" : "Show page thumbnails"}
            title={pageStripVisible ? "Hide page thumbnails" : "Show page thumbnails"}
            onClick={() => setPageStripVisible((visible) => !visible)}
          >
            <span aria-hidden="true">▤</span>
            {pageStripVisible ? "Hide pages" : "Show pages"}
          </button>
        ) : null}
        {documentState !== null ? (
          <button
            className="fullscreen-toggle"
            data-testid="production-fullscreen"
            type="button"
            aria-pressed={fullscreenEnabled}
            title={fullscreenEnabled ? "Exit fullscreen" : "Open editor fullscreen"}
            onClick={() => void toggleFullscreen()}
          >
            <span aria-hidden="true">⛶</span>
            {fullscreenEnabled ? "Exit fullscreen" : "Full screen"}
          </button>
        ) : null}
        {documentState !== null ? (
          <label className="open-control">
            <span>Open another PDF</span>
            <input
              data-testid="production-file-input"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                void handleFileChange(event);
              }}
            />
          </label>
        ) : null}
        <button
          data-testid="production-clear"
          type="button"
          onClick={() => {
            void clearDocument();
          }}
          disabled={documentState === null}
        >
          Clear
        </button>
        <button
          data-testid="production-download"
          type="button"
          onClick={() => {
            void downloadDocument();
          }}
          disabled={documentState === null || isDownloading}
          data-downloading={isDownloading ? "true" : "false"}
        >
          {isDownloading ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              Generating PDF...
            </>
          ) : (
            <>
              <span aria-hidden="true">⇩</span> Download PDF
            </>
          )}
        </button>
        <button
          data-testid="production-undo"
          type="button"
          onClick={undoLastChange}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          ↶
        </button>
        <button
          data-testid="production-redo"
          type="button"
          onClick={redoLastChange}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
        >
          ↷
        </button>
      </header>

      {documentState !== null && !toolbarVisible ? (
        <button
          className="toolbar-restore bar-restore-tab"
          type="button"
          aria-label="Show toolbar"
          title="Show toolbar"
          onClick={() => setToolbarVisible(true)}
        >
          ⌄
        </button>
      ) : null}

      {documentState !== null && !toolRailVisible ? (
        <button
          className="tool-rail-restore bar-restore-tab"
          type="button"
          aria-label="Show tools"
          title="Show tools"
          onClick={() => setToolRailVisible(true)}
        >
          ›
        </button>
      ) : null}

      {documentState !== null && !propertiesVisible ? (
        <button
          className="properties-restore bar-restore-tab"
          type="button"
          aria-label="Show properties"
          title="Show properties"
          onClick={() => setPropertiesVisible(true)}
        >
          ‹
        </button>
      ) : null}

      {documentState !== null && !pageStripVisible ? (
        <button
          className="page-strip-restore bar-restore-tab"
          type="button"
          aria-label="Show page thumbnails"
          title="Show page thumbnails"
          onClick={() => setPageStripVisible(true)}
        >
          ⌃
        </button>
      ) : null}

      {currentTutorialStep !== undefined && currentTutorialStep !== null ? (
        <section
          className="editor-tutorial"
          data-testid="editor-tutorial"
          aria-label="PDFMech first-time guide"
        >
          <div>
            <span data-testid="editor-tutorial-position">
              {tutorialPosition}
            </span>
            <h2>{currentTutorialStep.title}</h2>
            <p>{currentTutorialStep.text}</p>
          </div>
          <div className="editor-tutorial-actions">
            <button
              type="button"
              className="secondary"
              onClick={goToPreviousTutorialStep}
              disabled={tutorialStepIndex === 0}
            >
              Back
            </button>
            <button type="button" className="secondary" onClick={skipTutorialStep}>
              Skip this step
            </button>
            <button type="button" className="secondary" onClick={finishTutorial}>
              Skip all steps
            </button>
            <button type="button" onClick={goToNextTutorialStep}>
              {tutorialStepIndex === tutorialSteps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="document-workspace" aria-label="PDF workspace">
        <aside className="document-panel" aria-label="Document">
          {documentState !== null ? (
            <nav className="editor-tool-rail" aria-label="PDFMech tools">
              <div className="panel-heading">
                <span>Tools</span>
                <button
                  className="bar-collapse-arrow"
                  type="button"
                  aria-label="Hide tools"
                  title="Hide tools"
                  onClick={() => setToolRailVisible(false)}
                >
                  ‹
                </button>
              </div>
              <button
                type="button"
                aria-pressed={!placementArmed && !panModeEnabled}
                onClick={() => {
                  setEditingEnabled(false);
                  setPlacementArmed(false);
                  setPanModeEnabled(false);
                  setSelectedObjectId(null);
                  setStatus({
                    kind: "ready",
                    text: "Select mode is on. You can view the document without adding objects.",
                  });
                }}
              >
                <span aria-hidden="true">↖</span>
                Select
              </button>
              <button
                type="button"
                aria-pressed={placementArmed && creationTool === "text"}
                onClick={() => {
                  setEditingEnabled(true);
                  setPlacementArmed(true);
                  setPanModeEnabled(false);
                  setCreationTool("text");
                  setStatus({
                    kind: "ready",
                    text: "Add Text is selected. Click the page to add a text box.",
                  });
                }}
              >
                <span aria-hidden="true">T</span>
                Add Text
              </button>
              <button
                type="button"
                aria-pressed={placementArmed && creationTool === "whiteout"}
                onClick={() => {
                  setEditingEnabled(true);
                  setPlacementArmed(true);
                  setPanModeEnabled(false);
                  setCreationTool("whiteout");
                  setStatus({
                    kind: "ready",
                    text: "Whiteout is selected. Click the page to add a visual cover.",
                  });
                }}
              >
                <span aria-hidden="true">▱</span>
                Whiteout
              </button>
              <button
                type="button"
                aria-pressed={placementArmed && creationTool === "redaction"}
                onClick={() => {
                  setEditingEnabled(true);
                  setPlacementArmed(true);
                  setPanModeEnabled(false);
                  setCreationTool("redaction");
                  setStatus({
                    kind: "ready",
                    text: "Redact is selected. Click the page to add a visual colored cover.",
                  });
                }}
              >
                <span aria-hidden="true">⊘</span>
                Redact
              </button>

              <div className="tool-rail-divider" />
              <div className="panel-heading">
                <span>Pages</span>
              </div>
              <button type="button" onClick={rotateCurrentPage}>
                <span aria-hidden="true">↻</span>
                Rotate
              </button>
              <button
                type="button"
                onClick={moveCurrentPageEarlier}
                disabled={selectedPageIndex === 0}
              >
                <span aria-hidden="true">↕</span>
                Move Pages
              </button>
              <button type="button" onClick={deleteCurrentPage}>
                <span aria-hidden="true">⌫</span>
                Delete Pages
              </button>

              <div className="tool-rail-divider" />
              <div className="panel-heading">
                <span>History</span>
              </div>
              <button type="button" onClick={undoLastChange} disabled={!canUndo}>
                <span aria-hidden="true">↶</span>
                Undo
              </button>
              <button type="button" onClick={redoLastChange} disabled={!canRedo}>
                <span aria-hidden="true">↷</span>
                Redo
              </button>

              <div className="editor-local-card">
                <strong>Everything stays in your browser</strong>
                <small>No uploads. No account. No watermark.</small>
              </div>
            </nav>
          ) : null}
          <div className="metric">
            <span>Pages</span>
            <strong data-testid="production-page-count">
              {documentState?.pages.length ?? 0}
            </strong>
          </div>
          <div className="metric">
            <span>Size</span>
            <strong data-testid="production-byte-length">
              {activeSource === null ? "-" : formatBytes(activeSource.byteLength)}
            </strong>
          </div>
          <div
            className="recovery-card"
            data-kind={recoveryStatus.kind}
            data-testid="production-recovery-card"
          >
            <span>Recovery</span>
            <strong data-testid="production-recovery-status">
              {recoveryStatus.text}
            </strong>
            {documentState === null && recoverableDocuments.length > 0 ? (
              <>
                <p data-testid="production-recovery-notice">
                  Saved edit state and source PDF are available locally.
                </p>
                <button
                  data-testid="production-restore-recovery"
                  type="button"
                  onClick={() => {
                    void restoreMostRecentDocument();
                  }}
                  disabled={!canRestoreRecoveredDocument}
                >
                  Restore latest
                </button>
              </>
            ) : null}
          </div>
          <div className="limits-card" data-testid="production-limits-card">
            <div className="panel-heading">
              <span>Local limits</span>
              <strong>Safe</strong>
            </div>
            <p>
              Optimized for private browser editing. Oversized PDFs are blocked
              before they can stress memory.
            </p>
            <dl>
              <div>
                <dt>File</dt>
                <dd>{localEditingLimits.maxFileSize}</dd>
              </div>
              <div>
                <dt>Pages</dt>
                <dd>{localEditingLimits.maxPages}</dd>
              </div>
              <div>
                <dt>Zoom</dt>
                <dd>{localEditingLimits.maxZoom}</dd>
              </div>
            </dl>
          </div>
          {documentState !== null ? (
            <nav className="page-strip" aria-label="Document pages">
              <div className="panel-heading">
                <span>Pages</span>
                <strong>{documentState.pages.length}</strong>
                <button
                  className="bar-collapse-arrow"
                  type="button"
                  aria-label="Hide page thumbnails"
                  title="Hide page thumbnails"
                  onClick={() => setPageStripVisible(false)}
                >
                  ⌄
                </button>
              </div>
              <ol className="page-list" data-testid="production-page-list">
                {documentState.pages.map((page, index) => {
                  const width =
                    page.geometry.cropBox.xMax - page.geometry.cropBox.xMin;
                  const height =
                    page.geometry.cropBox.yMax - page.geometry.cropBox.yMin;

                  return (
                    <li key={page.id}>
                      <button
                        type="button"
                        aria-current={
                          selectedPageIndex === index ? "page" : undefined
                        }
                        onClick={() => choosePage(index)}
                      >
                        <span>Page {index + 1}</span>
                        <strong>
                          {Math.round(width)} × {Math.round(height)} pt
                        </strong>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="page-strip-actions" aria-label="Page strip controls">
                <span className="page-view-mode"><span aria-hidden="true">▦</span> Thumbnails</span>
                <span className="page-list-mode"><span aria-hidden="true">☷</span> List</span>
                <span className="page-save-state"><span aria-hidden="true">●</span> Saved locally</span>
                <button
                  data-testid="production-move-page-up"
                  type="button"
                  aria-label="Move selected page up"
                  title="Move page up"
                  onClick={moveCurrentPageEarlier}
                  disabled={selectedPageIndex === 0}
                >
                  ↑
                </button>
                <button
                  data-testid="production-move-page-down"
                  type="button"
                  aria-label="Move selected page down"
                  title="Move page down"
                  onClick={moveCurrentPageLater}
                  disabled={selectedPageIndex === documentState.pages.length - 1}
                >
                  ↓
                </button>
                <strong>Page {selectedPageIndex + 1} of {documentState.pages.length}</strong>
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => movePage(-1)}
                  disabled={selectedPageIndex === 0}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() => movePage(1)}
                  disabled={selectedPageIndex === documentState.pages.length - 1}
                >
                  ›
                </button>
              </div>
            </nav>
          ) : null}
        </aside>

        <main className="page-panel" aria-label="Pages">
          {documentState === null ? (
            <section
              className="empty-state"
              data-drag-active={isPdfDragOver ? "true" : "false"}
              data-testid="production-empty"
              onDragOver={handlePdfDragOver}
              onDragLeave={handlePdfDragLeave}
              onDrop={handlePdfDrop}
            >
              <div className="empty-state-card">
                <span className="empty-state-kicker">Private PDF editing</span>
                <h2>No PDF selected</h2>
                <p>
                  Drop a PDF here or open one from your device. Your PDF stays
                  in this browser while you edit.
                </p>
                <label className="empty-open-control">
                  <span>Open PDF</span>
                  <input
                    data-testid="production-empty-file-input"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => {
                      void handleFileChange(event);
                    }}
                  />
                </label>
                <small>Supports PDFs up to {localEditingLimits.maxFileSize}.</small>
              </div>
              <div className="empty-state-drop-hint" aria-hidden="true">
                Drop your PDF here
              </div>
            </section>
          ) : (
            <>
              <div className="viewer-controls" aria-label="Page navigation">
                <section className="control-group page-controls" aria-label="Page tools">
                  <button
                    data-testid="production-prev-page"
                    type="button"
                    onClick={() => movePage(-1)}
                    disabled={selectedPageIndex === 0}
                  >
                    Previous
                  </button>
                  <output data-testid="production-page-position">
                    Page {selectedPageIndex + 1} of {documentState.pages.length}
                  </output>
                  <button
                    data-testid="production-next-page"
                    type="button"
                    onClick={() => movePage(1)}
                    disabled={
                      selectedPageIndex === documentState.pages.length - 1
                    }
                  >
                    Next
                  </button>
                  <button
                    data-testid="production-rotate-page"
                    type="button"
                    onClick={rotateCurrentPage}
                  >
                    Rotate
                  </button>
                  <button
                    data-testid="production-move-page-earlier"
                    type="button"
                    onClick={moveCurrentPageEarlier}
                    disabled={selectedPageIndex === 0}
                  >
                    Move earlier
                  </button>
                  <button
                    data-testid="production-move-page-later"
                    type="button"
                    onClick={moveCurrentPageLater}
                    disabled={
                      selectedPageIndex === documentState.pages.length - 1
                    }
                  >
                    Move later
                  </button>
                  <button
                    data-testid="production-delete-page"
                    type="button"
                    onClick={deleteCurrentPage}
                  >
                    Delete page
                  </button>
                  <label>
                    Zoom
                    <button
                      type="button"
                      aria-label="Zoom out"
                      onClick={() => changeZoom(String(Math.max(0.25, zoom - 0.25)))}
                    >
                      −
                    </button>
                    <select
                      data-testid="production-zoom"
                      value={zoom}
                      onChange={(event) => changeZoom(event.currentTarget.value)}
                    >
                      {ZOOM_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {formatZoom(level)}
                        </option>
                      ))}
                      {!isZoomLevel(zoom) ? (
                        <option value={zoom}>{formatZoom(zoom)}</option>
                      ) : null}
                    </select>
                    <button
                      type="button"
                      aria-label="Zoom in"
                      onClick={() => changeZoom(String(Math.min(4, zoom + 0.25)))}
                    >
                      +
                    </button>
                  </label>
                  <button
                    data-testid="production-fit-width"
                    type="button"
                    onClick={() => fitZoom("width")}
                  >
                    Fit width
                  </button>
                  <button
                    data-testid="production-fit-page"
                    type="button"
                    onClick={() => fitZoom("page")}
                  >
                    Fit page
                  </button>
                  <button
                    data-testid="production-edit-mode"
                    type="button"
                    aria-label="Select mode"
                    title="Select mode"
                    aria-pressed={!placementArmed && !panModeEnabled}
                    onClick={() => {
                      setEditingEnabled(false);
                      setPlacementArmed(false);
                      setPanModeEnabled(false);
                      setSelectedObjectId(null);
                      setStatus({ kind: "ready", text: "Select mode is on." });
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 3.5 18.5 13l-6 .9 3.4 5.4-2.7 1.7-3.3-5.5L6 20Z" />
                    </svg>
                  </button>
                  <button
                    data-testid="production-pan-view"
                    type="button"
                    aria-label="Drag view"
                    title="Drag view"
                    aria-pressed={documentPanEnabled}
                    onClick={() => {
                      setEditingEnabled(false);
                      setPlacementArmed(false);
                      setPanModeEnabled(true);
                      setSelectedObjectId(null);
                      setStatus({
                        kind: "ready",
                        text: "Drag view is on. Drag the document horizontally or vertically.",
                      });
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7.8 11V6.2a1.4 1.4 0 0 1 2.8 0v4.1-6a1.4 1.4 0 0 1 2.8 0v6-4.8a1.4 1.4 0 0 1 2.8 0v5.2-3.5a1.4 1.4 0 0 1 2.8 0v6.1c0 4.2-2.7 7.2-6.8 7.2h-.8c-2.4 0-4.4-1.1-5.8-3l-3-4.2a1.5 1.5 0 0 1 2.2-2Z" />
                    </svg>
                  </button>
                </section>
                <section className="control-group add-controls" aria-label="Add tools">
                  <label>
                    Add
                    <select
                      data-testid="production-creation-tool"
                      value={creationTool}
                      disabled={!editingEnabled}
                      onChange={(event) => {
                        setCreationTool(event.currentTarget.value as CreationTool);
                        setPlacementArmed(true);
                      }}
                    >
                      <option value="text">Add text</option>
                      <option value="whiteout">Whiteout cover</option>
                      <option value="redaction">Redact</option>
                    </select>
                  </label>
                  <output data-testid="production-selection-state">
                    {!editingEnabled
                      ? "View mode"
                      : selectedObjectId === null
                        ? "No object selected"
                        : "Object selected"}
                  </output>
                  {creationTool === "whiteout" ? (
                    <p
                      className="tool-safety-note"
                      data-testid="production-whiteout-warning"
                    >
                      Whiteout visually covers content only. It is not secure
                      redaction.
                    </p>
                  ) : null}
                  {creationTool === "redaction" ? (
                    <p
                      className="tool-safety-note"
                      data-testid="production-redaction-warning"
                    >
                      Redaction adds a visual colored cover to the downloaded PDF.
                      It is not secure removal of underlying PDF data.
                    </p>
                  ) : null}
                </section>
                {documentState !== null ? (
                  <section
                    className="control-group object-controls"
                    aria-label="Object tools"
                    data-empty={selectedObject === null ? "true" : "false"}
                    data-tool={propertiesTool}
                  >
                    <button
                      className="bar-collapse-arrow properties-collapse-arrow"
                      type="button"
                      aria-label="Hide properties"
                      title="Hide properties"
                      onClick={() => setPropertiesVisible(false)}
                    >
                      ›
                    </button>
                    {selectedObject === null ? (
                      <>
                        <p className="properties-empty-note">
                          {propertiesTool === "text"
                            ? "Click the page to add a text box, then edit its properties here."
                            : propertiesTool === "whiteout"
                              ? "Click the page to add a whiteout cover, then choose its color here."
                              : propertiesTool === "redaction"
                                ? "Click the page to add a redaction cover, then choose its color here."
                                : "Select an element to edit its properties. Choose a text box or cover to see its options here."}
                        </p>
                        <div className="document-properties">
                          <strong>Document</strong>
                          <div><span>{activeSource?.originalName ?? "PDF document"}</span><small>{documentState.pages.length} pages · {activeSource === null ? "" : formatBytes(activeSource.byteLength)}</small></div>
                          <label>Page <output>{selectedPageIndex + 1}</output></label>
                          <label>Canvas size <output>{selectedPageSize === null ? "–" : `${Math.round(selectedPageSize.width)} × ${Math.round(selectedPageSize.height)} pt`}</output></label>
                          <label>Zoom <output>{formatZoom(zoom)}</output></label>
                        </div>
                      </>
                    ) : null}
                    <label className="property-font-field">
                      Font
                      <select
                        data-testid="production-text-font-family"
                        value={appearanceDraft.fontFamily}
                        disabled={selectedTextObject === null}
                        onChange={(event) => {
                          const fontFamily = event.currentTarget
                            .value as TextObject["font"]["family"];
                          applySelectedTextAppearanceChange(
                            {
                              ...appearanceDraft,
                              fontFamily,
                            },
                            "Updated selected text font.",
                          );
                        }}
                      >
                        {textFontFamilyOptions.map((fontFamily) => (
                          <option key={fontFamily} value={fontFamily}>
                            {fontFamily}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="property-field property-size-style">
                      <span>Size</span>
                      <div className="property-row">
                        <input
                          data-testid="production-text-font-size"
                          type="number"
                          min="2"
                          max="96"
                          step="1"
                          value={appearanceDraft.fontSize}
                          disabled={selectedTextObject === null}
                          onChange={(event) => {
                            applySelectedTextAppearanceChange(
                              {
                                ...appearanceDraft,
                                fontSize: event.currentTarget.value,
                              },
                              "Updated selected text size.",
                            );
                          }}
                        />
                        <label className="property-icon-toggle">
                          <input
                            data-testid="production-text-bold"
                            type="checkbox"
                            checked={appearanceDraft.fontWeight === "bold"}
                            disabled={selectedTextObject === null}
                            onChange={(event) => {
                              const fontWeight = event.currentTarget.checked
                                ? "bold"
                                : "regular";
                              applySelectedTextAppearanceChange(
                                {
                                  ...appearanceDraft,
                                  fontWeight,
                                },
                                "Updated selected text bold style.",
                              );
                            }}
                          />
                          <span>B</span>
                        </label>
                        <button type="button" disabled title="Italic is not available yet">
                          <em>I</em>
                        </button>
                        <button type="button" disabled title="Underline is not available yet">
                          <u>U</u>
                        </button>
                      </div>
                    </div>
                    <div className="property-field property-color-field">
                      <span>Color</span>
                      <div className="property-row">
                        <input
                          data-testid="production-text-color"
                          type="color"
                          value={appearanceDraft.color}
                          disabled={selectedTextObject === null}
                          onChange={(event) => {
                            const color = event.currentTarget.value;
                            applySelectedTextAppearanceChange(
                              {
                                ...appearanceDraft,
                                color,
                              },
                              "Updated selected text color.",
                            );
                          }}
                        />
                        <input
                          type="text"
                          value={appearanceDraft.color.toUpperCase()}
                          disabled
                          aria-label="Selected color hex value"
                        />
                        <button
                          data-testid="production-pick-text-color"
                          type="button"
                          onClick={() => {
                            void pickSelectedTextColorFromPage();
                          }}
                          disabled={selectedTextObject === null}
                          aria-label="Pick color from page"
                        >
                          ⌕
                        </button>
                      </div>
                    </div>
                    <div className="property-field property-align-field">
                      <span>Alignment</span>
                      <div className="property-row">
                        {textAlignmentOptions.map((alignment) => (
                          <button
                            key={alignment}
                            type="button"
                            aria-pressed={
                              appearanceDraft.horizontalAlignment === alignment
                            }
                            disabled={selectedTextObject === null}
                            onClick={() => {
                              applySelectedTextAppearanceChange(
                                {
                                  ...appearanceDraft,
                                  horizontalAlignment: alignment,
                                },
                                "Updated selected text alignment.",
                              );
                            }}
                          >
                            {alignment === "left"
                              ? "≡"
                              : alignment === "center"
                                ? "≣"
                                : "☰"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="text-content-control">
                      Text
                      <input
                        data-testid="production-text-content"
                        type="text"
                        value={textDraft}
                        disabled={selectedTextObject === null}
                        onChange={(event) => setTextDraft(event.currentTarget.value)}
                      />
                    </label>
                    <button
                      data-testid="production-apply-text"
                      type="button"
                      onClick={applySelectedTextContent}
                      disabled={!canApplyTextDraft}
                    >
                      Apply text
                    </button>
                    {selectedWhiteoutObject !== null ? (
                      <label>
                        Whiteout color
                        <input
                          data-testid="production-whiteout-color"
                          type="color"
                          value={rgbaColorToHex(selectedWhiteoutObject.color)}
                          onChange={(event) =>
                            applySelectedWhiteoutColor(
                              event.currentTarget.value,
                            )
                          }
                        />
                      </label>
                    ) : null}
                    {selectedRedactionObject !== null ? (
                      <label>
                        Redaction color
                        <input
                          data-testid="production-redaction-color"
                          type="color"
                          value={rgbaColorToHex(selectedRedactionObject.color)}
                          onChange={(event) =>
                            applySelectedRedactionColor(
                              event.currentTarget.value,
                            )
                          }
                        />
                      </label>
                    ) : null}
                    <div className="property-layer-divider" />
                    <strong className="property-layer-title">Layer</strong>
                    <button type="button" disabled title="Layer ordering is not available yet">
                      ↥ Bring Forward
                    </button>
                    <button type="button" disabled title="Layer ordering is not available yet">
                      ↧ Send Backward
                    </button>
                    <button
                      data-testid="production-duplicate-object"
                      type="button"
                      onClick={duplicateSelectedObject}
                      disabled={selectedObject === null}
                    >
                      Duplicate
                    </button>
                    <button
                      data-testid="production-delete-object"
                      type="button"
                      onClick={removeSelectedObject}
                      disabled={selectedObjectId === null}
                    >
                      Delete
                    </button>
                  </section>
                ) : null}
              </div>
            </>
          )}
          {documentState !== null ? (
            <section
              ref={renderPanelRef}
              className="render-panel"
              data-pan-mode={documentPanEnabled ? "true" : "false"}
              aria-label="Rendered page"
              onWheel={zoomDocumentWithWheel}
              onTouchMove={zoomDocumentWithTouch}
              onTouchEnd={finishTouchZoom}
              onTouchCancel={finishTouchZoom}
              onPointerDown={startDocumentPan}
              onPointerMove={continueDocumentPan}
              onPointerUp={finishDocumentPan}
              onPointerCancel={cancelDocumentPan}
            >
              {renderState.kind === "loading" ? (
                <div className="render-message">Rendering locally...</div>
              ) : null}
              {renderState.kind === "error" ? (
                <div className="render-message">{renderState.text}</div>
              ) : null}
              <div
                className="render-surface"
                data-testid="production-render-surface"
                style={
                  selectedPageSize === null
                    ? undefined
                    : {
                        width: `${selectedPageSize.width * zoom}px`,
                        height: `${selectedPageSize.height * zoom}px`,
                      }
                }
              >
                <canvas
                  ref={canvasRef}
                  className="render-canvas"
                  data-testid="production-page-canvas"
                />
                <div
                  className="overlay-layer"
                  data-testid="production-overlay-layer"
                  onPointerDown={addOverlayObject}
                >
                  {selectedPageObjects.map((object) => {
                      const previewFrame =
                        dragPreview?.objectId === object.id
                          ? dragPreview.frame
                          : object.frame;
                      const cssFrame = canonicalFrameToCss(previewFrame, zoom);
                      const selected = selectedObjectId === object.id;
                      return (
                        <div
                          key={object.id}
                          aria-label={
                            object.kind === "whiteout"
                              ? "Whiteout visual replacement object"
                              : object.kind === "redaction"
                                ? "Redaction object"
                              : undefined
                          }
                          className={`overlay-object overlay-${object.kind}${selected ? " selected" : ""}`}
                          data-testid={
                            object.kind === "text"
                              ? "production-overlay-text"
                              : object.kind === "whiteout"
                                ? "production-overlay-whiteout"
                                : object.kind === "redaction"
                                  ? "production-overlay-redaction"
                                : "production-overlay-object"
                          }
                          data-selected={selected ? "true" : "false"}
                          onPointerDown={(event) =>
                            startObjectDrag(event, object)
                          }
                          onPointerMove={continueObjectDrag}
                          onPointerUp={finishObjectDrag}
                          onPointerCancel={cancelObjectDrag}
                          style={{
                            left: `${cssFrame.left}px`,
                            top: `${cssFrame.top}px`,
                            width: `${cssFrame.width}px`,
                            height: `${cssFrame.height}px`,
                            fontFamily:
                              object.kind === "text"
                                ? textFontFamilyToCss(object.font.family)
                                : undefined,
                            fontWeight:
                              object.kind === "text"
                                ? object.font.weight
                                : undefined,
                            fontSize:
                              object.kind === "text"
                                ? `${object.fontSize * zoom}px`
                                : undefined,
                            lineHeight:
                              object.kind === "text"
                                ? object.lineHeight
                                : undefined,
                            color:
                              object.kind === "text"
                                ? rgbaColorToCss(object.color)
                                : undefined,
                            textAlign:
                              object.kind === "text"
                                ? object.horizontalAlignment
                                : undefined,
                            background:
                              object.kind === "whiteout"
                                ? rgbaColorToCss(object.color)
                                : object.kind === "redaction"
                                  ? rgbaColorToCss(object.color)
                                : undefined,
                          }}
                        >
                          {object.kind === "text" ? (
                            <span
                              className="overlay-text-content"
                              contentEditable={selected && editingEnabled}
                              data-text-object-id={object.id}
                              suppressContentEditableWarning
                              onInput={(event) =>
                                setTextDraft(
                                  event.currentTarget.textContent ?? "",
                                )
                              }
                              onBlur={(event) =>
                                applyOverlayTextContent(
                                  object,
                                  event.currentTarget.textContent ?? "",
                                )
                              }
                              onPointerDown={(event) => {
                                if (selected && editingEnabled) {
                                  event.stopPropagation();
                                }
                              }}
                            >
                              {object.text}
                            </span>
                          ) : null}
                          {selected && object.kind === "text" ? (
                            <div
                              aria-label="Move selected text box"
                              className="overlay-move-handle"
                              data-testid="production-move-handle"
                              role="button"
                              tabIndex={0}
                              onPointerDown={(event) =>
                                startObjectDrag(event, object)
                              }
                              onPointerMove={continueObjectDrag}
                              onPointerUp={finishObjectDrag}
                              onPointerCancel={cancelObjectDrag}
                            >
                              Move
                            </div>
                          ) : null}
                          {selected ? (
                            <button
                              aria-label="Delete selected object"
                              className="overlay-delete-button"
                              data-testid="production-overlay-delete"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeObjectById(object.id);
                              }}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                            >
                              ×
                            </button>
                          ) : null}
                          {selected ? (
                            <div
                              aria-label="Resize selected object"
                              className="overlay-resize-handle"
                              data-testid="production-resize-handle"
                              role="presentation"
                              onPointerDown={(event) =>
                                startObjectResize(event, object)
                              }
                              onPointerMove={continueObjectResize}
                              onPointerUp={finishObjectResize}
                              onPointerCancel={cancelObjectResize}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>
          ) : null}
        </main>
      </section>

      <output
        className="production-status"
        data-testid="production-status"
        data-kind={status.kind}
      >
        {status.text}
      </output>
    </div>
  );
}

function getTouchDistance(
  firstTouch: { readonly clientX: number; readonly clientY: number },
  secondTouch: { readonly clientX: number; readonly clientY: number },
): number {
  return Math.hypot(
    firstTouch.clientX - secondTouch.clientX,
    firstTouch.clientY - secondTouch.clientY,
  );
}

function focusEditableTextAtEnd(element: HTMLElement): void {
  element.focus();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function clampScrollPosition(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return 0;
  }

  return Math.min(Math.max(value, 0), maxValue);
}
