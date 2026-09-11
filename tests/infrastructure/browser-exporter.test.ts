import { promises as fs } from "node:fs";
import path from "node:path";

import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";

import { BrowserPdfExporter } from "../../src/infrastructure/pdflib/browser-exporter";
import { asPdfPoint, asUnitInterval } from "../../src/domain/primitives";
import { unsafeBrand } from "../../src/shared/brand";
import type {
  RedactionObject,
  RectangleObject,
  TextObject,
  WhiteoutObject,
} from "../../src/domain/document";
import type { ExportSnapshot } from "../../src/ports/pdf";

const fixturePath = path.resolve("tests/fixtures/representative.pdf");

function createSnapshot(input?: {
  readonly objectsByPage?: ExportSnapshot["objectsByPage"];
  readonly userRotation?: ExportSnapshot["pages"][number]["userRotation"];
}): ExportSnapshot {
  const sourceId = unsafeBrand<string, "SourceId">("source_export_test");
  const pageId = unsafeBrand<string, "PageId">("page_export_test");

  return {
    documentId: unsafeBrand("document_export_test"),
    revision: 1,
    sources: [
      {
        sourceId,
        fingerprint: "fixture_fingerprint",
        byteLength: 0,
      },
    ],
    pages: [
      {
        pageId,
        sourceId,
        sourcePageIndex: 0,
        geometry: {
          mediaBox: {
            xMin: asPdfPoint(0),
            yMin: asPdfPoint(0),
            xMax: asPdfPoint(612),
            yMax: asPdfPoint(792),
          },
          cropBox: {
            xMin: asPdfPoint(0),
            yMin: asPdfPoint(0),
            xMax: asPdfPoint(612),
            yMax: asPdfPoint(792),
          },
          intrinsicRotation: 0,
        },
        userRotation: input?.userRotation ?? 0,
      },
    ],
    objectsByPage: input?.objectsByPage ?? {
      [pageId]: [],
    },
    formValues: {},
    assets: [],
  };
}

async function createRegisteredExporter(): Promise<{
  readonly exporter: BrowserPdfExporter;
  readonly sourceId: ExportSnapshot["sources"][number]["sourceId"];
}> {
  const snapshot = createSnapshot();
  const sourceId = snapshot.sources[0]!.sourceId;
  const bytes = await fs.readFile(fixturePath);
  const exporter = new BrowserPdfExporter({
    loadUnicodeFont: async (variant) => {
      const fileName = {
        "latin:regular": "pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf",
        "latin:bold": "pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf",
        "latin:italic": "pdfjs-dist/standard_fonts/LiberationSans-Italic.ttf",
        "latin:boldItalic":
          "pdfjs-dist/standard_fonts/LiberationSans-BoldItalic.ttf",
        "arabic:regular":
          "@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff",
        "arabic:bold":
          "@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff",
        "devanagari:regular":
          "@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff",
        "devanagari:bold":
          "@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff",
        "japanese:113:regular":
          "@fontsource/noto-sans-jp/files/noto-sans-jp-113-400-normal.woff",
        "japanese:113:bold":
          "@fontsource/noto-sans-jp/files/noto-sans-jp-113-700-normal.woff",
        "japanese:117:regular":
          "@fontsource/noto-sans-jp/files/noto-sans-jp-117-400-normal.woff",
        "japanese:117:bold":
          "@fontsource/noto-sans-jp/files/noto-sans-jp-117-700-normal.woff",
        "japanese:118:regular":
          "@fontsource/noto-sans-jp/files/noto-sans-jp-118-400-normal.woff",
        "japanese:118:bold":
          "@fontsource/noto-sans-jp/files/noto-sans-jp-118-700-normal.woff",
        "japanese:119:regular":
          "@fontsource/noto-sans-jp/files/noto-sans-jp-119-400-normal.woff",
        "japanese:119:bold":
          "@fontsource/noto-sans-jp/files/noto-sans-jp-119-700-normal.woff",
        "korean:113:regular":
          "@fontsource/noto-sans-kr/files/noto-sans-kr-113-400-normal.woff",
        "korean:113:bold":
          "@fontsource/noto-sans-kr/files/noto-sans-kr-113-700-normal.woff",
        "korean:117:regular":
          "@fontsource/noto-sans-kr/files/noto-sans-kr-117-400-normal.woff",
        "korean:117:bold":
          "@fontsource/noto-sans-kr/files/noto-sans-kr-117-700-normal.woff",
        "korean:118:regular":
          "@fontsource/noto-sans-kr/files/noto-sans-kr-118-400-normal.woff",
        "korean:118:bold":
          "@fontsource/noto-sans-kr/files/noto-sans-kr-118-700-normal.woff",
        "korean:119:regular":
          "@fontsource/noto-sans-kr/files/noto-sans-kr-119-400-normal.woff",
        "korean:119:bold":
          "@fontsource/noto-sans-kr/files/noto-sans-kr-119-700-normal.woff",
        "chinese:118:regular":
          "@fontsource/noto-sans-sc/files/noto-sans-sc-118-400-normal.woff",
        "chinese:118:bold":
          "@fontsource/noto-sans-sc/files/noto-sans-sc-118-700-normal.woff",
        "chinese:119:regular":
          "@fontsource/noto-sans-sc/files/noto-sans-sc-119-400-normal.woff",
        "chinese:119:bold":
          "@fontsource/noto-sans-sc/files/noto-sans-sc-119-700-normal.woff",
      }[variant];
      return new Uint8Array(
        await fs.readFile(path.resolve("node_modules", fileName)),
      );
    },
  });

  await exporter.registerSource({
    sourceId,
    blob: new Blob([bytes], { type: "application/pdf" }),
    originalName: "PRIVATE_FILENAME_CANARY.pdf",
  });

  return { exporter, sourceId };
}

async function extractPageText(bytes: Uint8Array): Promise<string> {
  const task = getDocument({
    data: Uint8Array.from(bytes),
  });
  const document = await task.promise;
  try {
    const page = await document.getPage(1);
    try {
      const content = await page.getTextContent();
      return content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
    } finally {
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
}

function createTextObject(pageId: ExportSnapshot["pages"][number]["pageId"]): TextObject {
  return {
    id: unsafeBrand("object_export_text"),
    pageId,
    kind: "text",
    frame: {
      x: asPdfPoint(100),
      y: asPdfPoint(120),
      width: asPdfPoint(140),
      height: asPdfPoint(32),
    },
    rotation: 0,
    opacity: asUnitInterval(1),
    locked: false,
    createdAtRevision: 1,
    text: "PRIVATE_TEXT_CANARY",
    font: {
      family: "helvetica",
      weight: "regular",
      style: "normal",
    },
    fontSize: asPdfPoint(16),
    color: {
      red: 0,
      green: 0,
      blue: 0,
      alpha: asUnitInterval(1),
    },
    horizontalAlignment: "left",
    lineHeight: 1.2,
  };
}

function createWhiteoutObject(
  pageId: ExportSnapshot["pages"][number]["pageId"],
): WhiteoutObject {
  return {
    id: unsafeBrand("object_export_whiteout"),
    pageId,
    kind: "whiteout",
    frame: {
      x: asPdfPoint(100),
      y: asPdfPoint(120),
      width: asPdfPoint(140),
      height: asPdfPoint(32),
    },
    rotation: 0,
    opacity: asUnitInterval(1),
    locked: false,
    createdAtRevision: 1,
    color: {
      red: 1,
      green: 1,
      blue: 1,
      alpha: asUnitInterval(1),
    },
  };
}

function createRedactionObject(
  pageId: ExportSnapshot["pages"][number]["pageId"],
): RedactionObject {
  return {
    id: unsafeBrand("object_export_redaction"),
    pageId,
    kind: "redaction",
    frame: {
      x: asPdfPoint(100),
      y: asPdfPoint(120),
      width: asPdfPoint(140),
      height: asPdfPoint(32),
    },
    color: {
      red: 0,
      green: 0,
      blue: 0,
      alpha: asUnitInterval(1),
    },
    rotation: 0,
    opacity: asUnitInterval(1),
    locked: false,
    createdAtRevision: 1,
  };
}

describe("BrowserPdfExporter", () => {
  it("copies registered source pages into a fresh generated PDF", async () => {
    const { exporter } = await createRegisteredExporter();

    const generated = await exporter.export(createSnapshot());

    expect(generated.bytes.byteLength).toBeGreaterThan(0);
    expect(generated.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(generated)).not.toContain("PRIVATE_FILENAME_CANARY");

    const exportedDocument = await PDFDocument.load(generated.bytes);
    expect(exportedDocument.getPageCount()).toBe(1);
  });

  it("exports text objects instead of rejecting them", async () => {
    const { exporter } = await createRegisteredExporter();
    const snapshot = createSnapshot();
    const pageId = snapshot.pages[0]!.pageId;
    const textObject = createTextObject(pageId);

    const generated = await exporter.export(
      createSnapshot({
        objectsByPage: {
          [pageId]: [textObject],
        },
      }),
    );

    expect(generated.bytes.byteLength).toBeGreaterThan(0);
    expect(generated.sha256).toMatch(/^[a-f0-9]{64}$/);

    const exportedDocument = await PDFDocument.load(generated.bytes);
    expect(exportedDocument.getPageCount()).toBe(1);
    await expect(extractPageText(generated.bytes)).resolves.toContain(
      "PRIVATE_TEXT_CANARY",
    );
  });

  it("exports Russian text as selectable Unicode text", async () => {
    const { exporter } = await createRegisteredExporter();
    const snapshot = createSnapshot();
    const pageId = snapshot.pages[0]!.pageId;
    const textObject: TextObject = {
      ...createTextObject(pageId),
      text: "\u041f\u0440\u0438\u0432\u0435\u0442, \u043c\u0438\u0440! Russian text 123",
    };

    const generated = await exporter.export(
      createSnapshot({
        objectsByPage: {
          [pageId]: [textObject],
        },
      }),
    );

    await expect(extractPageText(generated.bytes)).resolves.toContain(
      "\u041f\u0440\u0438\u0432\u0435\u0442, \u043c\u0438\u0440! Russian text 123",
    );
  });

  it("exports common symbols as selectable Unicode text", async () => {
    const { exporter } = await createRegisteredExporter();
    const snapshot = createSnapshot();
    const pageId = snapshot.pages[0]!.pageId;
    const textObject: TextObject = {
      ...createTextObject(pageId),
      text: "Invoice № A1 • total €25 — paid",
    };

    const generated = await exporter.export(
      createSnapshot({
        objectsByPage: {
          [pageId]: [textObject],
        },
      }),
    );

    await expect(extractPageText(generated.bytes)).resolves.toContain(
      "Invoice № A1 • total €25 — paid",
    );
  });

  it("exports added text for major non-Latin scripts without font encoding crashes", async () => {
    const samples = [
      "Russian: Привет мир",
      "Arabic: مرحبا بالعالم",
      "Persian: سلام دنیا",
      "Hindi: नमस्ते दुनिया",
      "Japanese: こんにちは",
      "Chinese: 中文你好",
      "Korean: 한국어 안녕하세요",
      "Vietnamese: Xin chào thế giới",
      "Greek: Γεια σου κόσμε",
      "Turkish: İstanbul şğüöçı",
      "Polish: Zażółć gęślą jaźń",
    ];

    for (const sample of samples) {
      const { exporter } = await createRegisteredExporter();
      const snapshot = createSnapshot();
      const pageId = snapshot.pages[0]!.pageId;
      const textObject: TextObject = {
        ...createTextObject(pageId),
        text: sample,
      };

      const generated = await exporter.export(
        createSnapshot({
          objectsByPage: {
            [pageId]: [textObject],
          },
        }),
      );

      expect(generated.bytes.byteLength).toBeGreaterThan(0);
      expect(generated.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("exports whiteout objects instead of rejecting them", async () => {
    const { exporter } = await createRegisteredExporter();
    const snapshot = createSnapshot();
    const pageId = snapshot.pages[0]!.pageId;
    const whiteoutObject = createWhiteoutObject(pageId);

    const generated = await exporter.export(
      createSnapshot({
        objectsByPage: {
          [pageId]: [whiteoutObject],
        },
      }),
    );

    expect(generated.bytes.byteLength).toBeGreaterThan(0);
    expect(generated.sha256).toMatch(/^[a-f0-9]{64}$/);

    const exportedDocument = await PDFDocument.load(generated.bytes);
    expect(exportedDocument.getPageCount()).toBe(1);
  });

  it("exports redaction objects instead of rejecting them", async () => {
    const { exporter } = await createRegisteredExporter();
    const snapshot = createSnapshot();
    const pageId = snapshot.pages[0]!.pageId;
    const redactionObject = createRedactionObject(pageId);

    const generated = await exporter.export(
      createSnapshot({
        objectsByPage: {
          [pageId]: [redactionObject],
        },
      }),
    );

    expect(generated.bytes.byteLength).toBeGreaterThan(0);
    expect(generated.sha256).toMatch(/^[a-f0-9]{64}$/);

    const exportedDocument = await PDFDocument.load(generated.bytes);
    expect(exportedDocument.getPageCount()).toBe(1);
  });

  it("preserves user page rotation in the generated PDF", async () => {
    const { exporter } = await createRegisteredExporter();

    const generated = await exporter.export(
      createSnapshot({
        userRotation: 90,
      }),
    );

    const exportedDocument = await PDFDocument.load(generated.bytes);
    expect(exportedDocument.getPage(0).getRotation().angle).toBe(90);
  });

  it("exports text and whiteout together from page object order", async () => {
    const { exporter } = await createRegisteredExporter();
    const snapshot = createSnapshot();
    const pageId = snapshot.pages[0]!.pageId;

    const generated = await exporter.export(
      createSnapshot({
        objectsByPage: {
          [pageId]: [createWhiteoutObject(pageId), createTextObject(pageId)],
        },
      }),
    );

    expect(generated.bytes.byteLength).toBeGreaterThan(0);
    await expect(extractPageText(generated.bytes)).resolves.toContain(
      "PRIVATE_TEXT_CANARY",
    );
  });

  it("keeps unsupported future objects blocked", async () => {
    const { exporter } = await createRegisteredExporter();
    const snapshot = createSnapshot();
    const pageId = snapshot.pages[0]!.pageId;
    const rectangleObject: RectangleObject = {
      id: unsafeBrand("object_export_rectangle"),
      pageId,
      kind: "rectangle",
      frame: {
        x: asPdfPoint(100),
        y: asPdfPoint(120),
        width: asPdfPoint(140),
        height: asPdfPoint(32),
      },
      rotation: 0,
      opacity: asUnitInterval(1),
      locked: false,
      createdAtRevision: 1,
      stroke: {
        red: 0,
        green: 0,
        blue: 0,
        alpha: asUnitInterval(1),
      },
      fill: null,
      strokeWidth: asPdfPoint(1),
    };

    await expect(
      exporter.export(
        createSnapshot({
          objectsByPage: {
            [pageId]: [rectangleObject],
          },
        }),
      ),
    ).rejects.toThrow("cannot export rectangle objects yet");
  });

  it("requires source bytes to be registered before export", async () => {
    const exporter = new BrowserPdfExporter();

    await expect(exporter.export(createSnapshot())).rejects.toThrow(
      "registered source PDF bytes",
    );
  });

  it("forgets source bytes after disposal", async () => {
    const { exporter, sourceId } = await createRegisteredExporter();
    await exporter.disposeSource(sourceId);

    await expect(exporter.export(createSnapshot())).rejects.toThrow(
      "registered source PDF bytes",
    );
  });
});
