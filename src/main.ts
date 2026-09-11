import "./styles.css";
import type { Edit, Tool } from "./model";
import {
  exportEditedPdf,
  openLocalPdf,
  renderPage,
  validateGeneratedPdf,
  type OpenedPdf,
} from "./pdf-engine";

const app = document.querySelector<HTMLElement>("#app");
if (app === null) {
  throw new Error("Application root is missing.");
}

app.innerHTML = `
  <div class="shell">
    <div class="notice">Local-only spike: the selected PDF is processed in this browser and is not uploaded.</div>
    <header class="toolbar">
      <h1>PDF Editor Technical Spike</h1>
      <label class="file-button">
        Open PDF
        <input id="file-input" data-testid="file-input" type="file" accept="application/pdf,.pdf" />
      </label>
      <button id="text-tool" data-testid="text-tool" type="button" aria-pressed="true">Add text</button>
      <input id="text-value" data-testid="text-value" value="Corrected text" aria-label="Text to add" />
      <button id="whiteout-tool" data-testid="whiteout-tool" type="button" aria-pressed="false">Whiteout</button>
      <label>
        Zoom
        <select id="zoom" data-testid="zoom">
          <option value="0.5">50%</option>
          <option value="0.75">75%</option>
          <option value="1" selected>100%</option>
          <option value="1.5">150%</option>
          <option value="2">200%</option>
        </select>
      </label>
      <button id="download" data-testid="download" type="button" disabled>Validate & download</button>
      <button id="clear" data-testid="clear" type="button" disabled>Clear</button>
    </header>
    <div class="workspace">
      <aside class="sidebar">
        <h2>Pages</h2>
        <nav id="page-list" class="page-list" aria-label="PDF pages"></nav>
      </aside>
      <section id="stage" class="stage" aria-label="PDF editor">
        <div class="empty">
          <h2>Open a PDF to run the experiment</h2>
          <p>Add text or whiteout, change zoom, drag the edits, and export a locally validated result.</p>
        </div>
      </section>
    </div>
    <output id="status" class="status" data-testid="status" data-kind="info">Ready. No PDF loaded.</output>
  </div>
`;

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Required element is missing: ${selector}`);
  }
  return element;
}

const fileInput = requiredElement<HTMLInputElement>("#file-input");
const textTool = requiredElement<HTMLButtonElement>("#text-tool");
const whiteoutTool = requiredElement<HTMLButtonElement>("#whiteout-tool");
const textValue = requiredElement<HTMLInputElement>("#text-value");
const zoomSelect = requiredElement<HTMLSelectElement>("#zoom");
const downloadButton = requiredElement<HTMLButtonElement>("#download");
const clearButton = requiredElement<HTMLButtonElement>("#clear");
const pageList = requiredElement<HTMLElement>("#page-list");
const stage = requiredElement<HTMLElement>("#stage");
const status = requiredElement<HTMLOutputElement>("#status");

let opened: OpenedPdf | null = null;
let edits: Edit[] = [];
let selectedPage = 0;
let selectedTool: Tool = "text";
let zoom = 1;
let editSequence = 0;
let renderGeneration = 0;

function setStatus(message: string, kind: "info" | "error" = "info"): void {
  status.value = message;
  status.dataset.kind = kind;
}

function setTool(tool: Tool): void {
  selectedTool = tool;
  textTool.setAttribute("aria-pressed", String(tool === "text"));
  whiteoutTool.setAttribute("aria-pressed", String(tool === "whiteout"));
}

function updateControls(): void {
  const active = opened !== null;
  downloadButton.disabled = !active || edits.length === 0;
  clearButton.disabled = !active;
}

function renderPageList(): void {
  pageList.replaceChildren();
  if (opened === null) {
    return;
  }
  for (const page of opened.pages) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `Page ${page.pageIndex + 1} · ${Math.round(page.width)} × ${Math.round(page.height)} pt`;
    button.setAttribute(
      "aria-current",
      page.pageIndex === selectedPage ? "page" : "false",
    );
    button.addEventListener("click", () => {
      selectedPage = page.pageIndex;
      renderPageList();
      void renderSelectedPage();
    });
    pageList.append(button);
  }
}

function createOverlayEdit(edit: Edit): HTMLElement {
  const element = document.createElement("div");
  element.className = `edit ${edit.kind}`;
  element.dataset.editId = edit.id;
  element.dataset.testid = `edit-${edit.kind}`;
  element.style.left = `${edit.frame.x * zoom}px`;
  element.style.top = `${edit.frame.y * zoom}px`;
  element.style.width = `${edit.frame.width * zoom}px`;
  element.style.height = `${edit.frame.height * zoom}px`;
  if (edit.kind === "text") {
    element.textContent = edit.text;
    element.style.fontSize = `${edit.fontSize * zoom}px`;
  }

  element.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    element.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = edit.frame.x;
    const initialY = edit.frame.y;

    const move = (moveEvent: PointerEvent): void => {
      const page = opened?.pages[edit.pageIndex];
      if (page === undefined) {
        return;
      }
      const nextX = initialX + (moveEvent.clientX - startX) / zoom;
      const nextY = initialY + (moveEvent.clientY - startY) / zoom;
      edit.frame.x = Math.max(
        0,
        Math.min(nextX, page.width - edit.frame.width),
      );
      edit.frame.y = Math.max(
        0,
        Math.min(nextY, page.height - edit.frame.height),
      );
      element.style.left = `${edit.frame.x * zoom}px`;
      element.style.top = `${edit.frame.y * zoom}px`;
    };
    const finish = (): void => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", finish);
      element.removeEventListener("pointercancel", finish);
      setStatus(
        `Moved ${edit.kind} to ${edit.frame.x.toFixed(1)}, ${edit.frame.y.toFixed(1)} points.`,
      );
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", finish);
    element.addEventListener("pointercancel", finish);
  });
  return element;
}

async function renderSelectedPage(): Promise<void> {
  const current = opened;
  if (current === null) {
    return;
  }
  const generation = ++renderGeneration;
  const geometry = current.pages[selectedPage];
  if (geometry === undefined) {
    throw new Error("Selected page geometry is missing.");
  }

  stage.replaceChildren();
  const pageElement = document.createElement("div");
  pageElement.className = "page";
  pageElement.dataset.testid = "page";
  pageElement.style.width = `${geometry.width * zoom}px`;
  pageElement.style.height = `${geometry.height * zoom}px`;

  const canvas = document.createElement("canvas");
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.dataset.testid = "overlay";
  pageElement.append(canvas, overlay);
  stage.append(pageElement);

  overlay.addEventListener("pointerdown", (event) => {
    if (event.target !== overlay) {
      return;
    }
    const bounds = overlay.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / zoom;
    const y = (event.clientY - bounds.top) / zoom;
    editSequence += 1;
    const base = {
      id: `edit-${editSequence}`,
      pageIndex: selectedPage,
    };
    const edit: Edit =
      selectedTool === "text"
        ? {
            ...base,
            kind: "text",
            text: textValue.value.trim() || "Text",
            fontSize: 16,
            color: [0.07, 0.09, 0.15],
            frame: {
              x,
              y,
              width: Math.min(220, geometry.width - x),
              height: 22,
            },
          }
        : {
            ...base,
            kind: "whiteout",
            frame: {
              x,
              y,
              width: Math.min(150, geometry.width - x),
              height: Math.min(28, geometry.height - y),
            },
          };
    edits.push(edit);
    overlay.append(createOverlayEdit(edit));
    updateControls();
    setStatus(
      `Added ${edit.kind} at ${edit.frame.x.toFixed(1)}, ${edit.frame.y.toFixed(1)} points.`,
    );
  });

  for (const edit of edits.filter(
    (candidate) => candidate.pageIndex === selectedPage,
  )) {
    overlay.append(createOverlayEdit(edit));
  }

  setStatus(`Rendering page ${selectedPage + 1} locally…`);
  try {
    await renderPage(current, selectedPage, canvas, zoom);
    if (generation === renderGeneration) {
      setStatus(
        `Page ${selectedPage + 1} rendered locally at ${Math.round(zoom * 100)}%.`,
      );
    }
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Page rendering failed.",
      "error",
    );
  }
}

async function closeDocument(): Promise<void> {
  renderGeneration += 1;
  if (opened !== null) {
    await opened.loadingTask.destroy();
  }
  opened = null;
  edits = [];
  selectedPage = 0;
  editSequence = 0;
  fileInput.value = "";
  pageList.replaceChildren();
  stage.innerHTML = `
    <div class="empty">
      <h2>Open a PDF to run the experiment</h2>
      <p>Add text or whiteout, change zoom, drag the edits, and export a locally validated result.</p>
    </div>
  `;
  updateControls();
}

fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files ?? [];
  if (file === undefined) {
    return;
  }
  try {
    await closeDocument();
    setStatus("Reading and inspecting the local PDF…");
    opened = await openLocalPdf(file);
    renderPageList();
    updateControls();
    await renderSelectedPage();
    setStatus(
      `Opened ${opened.pages.length} page${opened.pages.length === 1 ? "" : "s"} locally. Nothing was uploaded.`,
    );
  } catch (error) {
    await closeDocument();
    setStatus(
      error instanceof Error ? error.message : "Unable to open the PDF.",
      "error",
    );
  }
});

textTool.addEventListener("click", () => setTool("text"));
whiteoutTool.addEventListener("click", () => setTool("whiteout"));

zoomSelect.addEventListener("change", () => {
  const value = Number(zoomSelect.value);
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }
  zoom = value;
  void renderSelectedPage();
});

clearButton.addEventListener("click", () => {
  void closeDocument().then(() => setStatus("Document cleared from memory."));
});

downloadButton.addEventListener("click", async () => {
  const current = opened;
  if (current === null) {
    return;
  }
  downloadButton.disabled = true;
  try {
    setStatus("Exporting locally…");
    const generated = await exportEditedPdf(current, edits);
    const evidence = await validateGeneratedPdf(
      generated,
      current.pages.length,
      edits.map((edit) => edit.pageIndex),
    );
    const blob = new Blob([generated as Uint8Array<ArrayBuffer>], {
      type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "edited-local.pdf";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus(
      `Validated ${evidence.pageCount} page(s), rendered ${evidence.renderedPages.length} changed page(s), and downloaded ${evidence.byteLength} bytes locally.`,
    );
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Export validation failed.",
      "error",
    );
  } finally {
    updateControls();
  }
});

updateControls();
