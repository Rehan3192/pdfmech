import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import "regenerator-runtime/runtime.js";
import fontkit from "@pdf-lib/fontkit";
import notoSansArabicBoldUrl from "@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff?url";
import notoSansArabicRegularUrl from "@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff?url";
import notoSansChinese118BoldUrl from "@fontsource/noto-sans-sc/files/noto-sans-sc-118-700-normal.woff?url";
import notoSansChinese118RegularUrl from "@fontsource/noto-sans-sc/files/noto-sans-sc-118-400-normal.woff?url";
import notoSansChinese119BoldUrl from "@fontsource/noto-sans-sc/files/noto-sans-sc-119-700-normal.woff?url";
import notoSansChinese119RegularUrl from "@fontsource/noto-sans-sc/files/noto-sans-sc-119-400-normal.woff?url";
import notoSansDevanagariBoldUrl from "@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff?url";
import notoSansDevanagariRegularUrl from "@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff?url";
import notoSansJapanese113BoldUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-113-700-normal.woff?url";
import notoSansJapanese113RegularUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-113-400-normal.woff?url";
import notoSansJapanese117BoldUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-117-700-normal.woff?url";
import notoSansJapanese117RegularUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-117-400-normal.woff?url";
import notoSansJapanese118BoldUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-118-700-normal.woff?url";
import notoSansJapanese118RegularUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-118-400-normal.woff?url";
import notoSansJapanese119BoldUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-119-700-normal.woff?url";
import notoSansJapanese119RegularUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-119-400-normal.woff?url";
import notoSansKorean113BoldUrl from "@fontsource/noto-sans-kr/files/noto-sans-kr-113-700-normal.woff?url";
import notoSansKorean113RegularUrl from "@fontsource/noto-sans-kr/files/noto-sans-kr-113-400-normal.woff?url";
import notoSansKorean117BoldUrl from "@fontsource/noto-sans-kr/files/noto-sans-kr-117-700-normal.woff?url";
import notoSansKorean117RegularUrl from "@fontsource/noto-sans-kr/files/noto-sans-kr-117-400-normal.woff?url";
import notoSansKorean118BoldUrl from "@fontsource/noto-sans-kr/files/noto-sans-kr-118-700-normal.woff?url";
import notoSansKorean118RegularUrl from "@fontsource/noto-sans-kr/files/noto-sans-kr-118-400-normal.woff?url";
import notoSansKorean119BoldUrl from "@fontsource/noto-sans-kr/files/noto-sans-kr-119-700-normal.woff?url";
import notoSansKorean119RegularUrl from "@fontsource/noto-sans-kr/files/noto-sans-kr-119-400-normal.woff?url";
import liberationSansBoldUrl from "pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url";
import liberationSansBoldItalicUrl from "pdfjs-dist/standard_fonts/LiberationSans-BoldItalic.ttf?url";
import liberationSansItalicUrl from "pdfjs-dist/standard_fonts/LiberationSans-Italic.ttf?url";
import liberationSansRegularUrl from "pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url";

import type {
  EditObject,
  RedactionObject,
  RgbaColor,
  TextObject,
  WhiteoutObject,
} from "../../domain/document";
import type { PageId, SourceId } from "../../domain/primitives";
import type {
  ExportSnapshot,
  GeneratedPdf,
  LocalPdfSource,
  PdfExporter,
} from "../../ports/pdf";

type UnicodeFontVariant = "regular" | "bold" | "italic" | "boldItalic";
type UnicodeFontKey =
  | `latin:${UnicodeFontVariant}`
  | "arabic:regular"
  | "arabic:bold"
  | "devanagari:regular"
  | "devanagari:bold"
  | `japanese:${"113" | "117" | "118" | "119"}:${"regular" | "bold"}`
  | `korean:${"113" | "117" | "118" | "119"}:${"regular" | "bold"}`
  | `chinese:${"118" | "119"}:${"regular" | "bold"}`;

export type UnicodeFontLoader = (
  fontKey: UnicodeFontKey,
) => Promise<Uint8Array>;

const unicodeFontUrlByKey: Readonly<Record<UnicodeFontKey, string>> = {
  "latin:regular": liberationSansRegularUrl,
  "latin:bold": liberationSansBoldUrl,
  "latin:italic": liberationSansItalicUrl,
  "latin:boldItalic": liberationSansBoldItalicUrl,
  "arabic:regular": notoSansArabicRegularUrl,
  "arabic:bold": notoSansArabicBoldUrl,
  "devanagari:regular": notoSansDevanagariRegularUrl,
  "devanagari:bold": notoSansDevanagariBoldUrl,
  "japanese:113:regular": notoSansJapanese113RegularUrl,
  "japanese:113:bold": notoSansJapanese113BoldUrl,
  "japanese:117:regular": notoSansJapanese117RegularUrl,
  "japanese:117:bold": notoSansJapanese117BoldUrl,
  "japanese:118:regular": notoSansJapanese118RegularUrl,
  "japanese:118:bold": notoSansJapanese118BoldUrl,
  "japanese:119:regular": notoSansJapanese119RegularUrl,
  "japanese:119:bold": notoSansJapanese119BoldUrl,
  "korean:113:regular": notoSansKorean113RegularUrl,
  "korean:113:bold": notoSansKorean113BoldUrl,
  "korean:117:regular": notoSansKorean117RegularUrl,
  "korean:117:bold": notoSansKorean117BoldUrl,
  "korean:118:regular": notoSansKorean118RegularUrl,
  "korean:118:bold": notoSansKorean118BoldUrl,
  "korean:119:regular": notoSansKorean119RegularUrl,
  "korean:119:bold": notoSansKorean119BoldUrl,
  "chinese:118:regular": notoSansChinese118RegularUrl,
  "chinese:118:bold": notoSansChinese118BoldUrl,
  "chinese:119:regular": notoSansChinese119RegularUrl,
  "chinese:119:bold": notoSansChinese119BoldUrl,
};

async function loadUnicodeFont(fontKey: UnicodeFontKey): Promise<Uint8Array> {
  const response = await fetch(unicodeFontUrlByKey[fontKey]);
  if (!response.ok) {
    throw new Error("PDFMech could not load the Unicode export font.");
  }
  return new Uint8Array(await response.arrayBuffer());
}

export class BrowserPdfExporter implements PdfExporter {
  readonly #sourceBytesById = new Map<SourceId, Uint8Array>();
  readonly #loadUnicodeFont: UnicodeFontLoader;

  constructor({ loadUnicodeFont: unicodeFontLoader = loadUnicodeFont }: {
    readonly loadUnicodeFont?: UnicodeFontLoader;
  } = {}) {
    this.#loadUnicodeFont = unicodeFontLoader;
  }

  async registerSource(source: LocalPdfSource): Promise<void> {
    this.#sourceBytesById.set(
      source.sourceId,
      new Uint8Array(await source.blob.arrayBuffer()),
    );
  }

  async disposeSource(sourceId: SourceId): Promise<void> {
    this.#sourceBytesById.delete(sourceId);
  }

  async export(snapshot: ExportSnapshot): Promise<GeneratedPdf> {
    assertSnapshotHasOnlySupportedObjects(snapshot);

    const sourceDocuments = new Map<SourceId, PDFDocument>();
    const outputDocument = await PDFDocument.create();
    const fontCache = new Map<string, PDFFont>();

    for (const source of snapshot.sources) {
      const sourceBytes = this.#sourceBytesById.get(source.sourceId);
      if (sourceBytes === undefined) {
        throw new Error("Cannot export without the registered source PDF bytes.");
      }

      sourceDocuments.set(source.sourceId, await PDFDocument.load(sourceBytes));
    }

    for (const page of snapshot.pages) {
      const sourceDocument = sourceDocuments.get(page.sourceId);
      if (sourceDocument === undefined) {
        throw new Error("Cannot export a page with a missing source document.");
      }

      if (
        page.sourcePageIndex < 0 ||
        page.sourcePageIndex >= sourceDocument.getPageCount()
      ) {
        throw new Error("Cannot export a page with an invalid source index.");
      }

      const [copiedPage] = await outputDocument.copyPages(sourceDocument, [
        page.sourcePageIndex,
      ]);
      if (copiedPage === undefined) {
        throw new Error("Cannot export a page that could not be copied.");
      }

      if (page.userRotation !== 0) {
        copiedPage.setRotation(degrees(page.userRotation));
      }
      outputDocument.addPage(copiedPage);

      for (const object of snapshot.objectsByPage[page.pageId] ?? []) {
        await drawSupportedObject({
          pdfDocument: outputDocument,
          pdfPage: copiedPage,
          object,
          fontCache,
          loadUnicodeFont: this.#loadUnicodeFont,
        });
      }
    }

    const bytes = new Uint8Array(await outputDocument.save());
    return {
      bytes,
      sha256: await sha256Hex(bytes),
    };
  }
}

function assertSnapshotHasOnlySupportedObjects(snapshot: ExportSnapshot): void {
  const knownPageIds = new Set<PageId>(snapshot.pages.map((page) => page.pageId));
  const orphanObjectsPage = Object.entries(snapshot.objectsByPage).find(
    ([pageId, objects]) =>
      !knownPageIds.has(pageId as PageId) && objects.length > 0,
  );

  if (orphanObjectsPage !== undefined) {
    throw new Error(
      "Export adapter skeleton cannot export objects for an unknown page.",
    );
  }

  const unsupportedObject = Object.values(snapshot.objectsByPage)
    .flat()
    .find(
      (object) =>
        object.kind !== "text" &&
        object.kind !== "whiteout" &&
        object.kind !== "redaction",
    );

  if (unsupportedObject !== undefined) {
    throw new Error(
      `Export adapter cannot export ${unsupportedObject.kind} objects yet. Object drawing must be implemented before download is enabled.`,
    );
  }
}

interface DrawSupportedObjectInput {
  readonly pdfDocument: PDFDocument;
  readonly pdfPage: PDFPage;
  readonly object: EditObject;
  readonly fontCache: Map<string, PDFFont>;
  readonly loadUnicodeFont: UnicodeFontLoader;
}

async function drawSupportedObject({
  pdfDocument,
  pdfPage,
  object,
  fontCache,
  loadUnicodeFont,
}: DrawSupportedObjectInput): Promise<void> {
  switch (object.kind) {
    case "text":
      await drawTextObject({
        pdfDocument,
        pdfPage,
        object,
        fontCache,
        loadUnicodeFont,
      });
      return;
    case "whiteout":
      drawWhiteoutObject(pdfPage, object);
      return;
    case "redaction":
      drawRedactionObject(pdfPage, object);
      return;
    default:
      throw new Error(
        `Export adapter cannot export ${object.kind} objects yet. Object drawing must be implemented before download is enabled.`,
      );
  }
}

interface DrawTextObjectInput {
  readonly pdfDocument: PDFDocument;
  readonly pdfPage: PDFPage;
  readonly object: TextObject;
  readonly fontCache: Map<string, PDFFont>;
  readonly loadUnicodeFont: UnicodeFontLoader;
}

async function drawTextObject({
  pdfDocument,
  pdfPage,
  object,
  fontCache,
  loadUnicodeFont,
}: DrawTextObjectInput): Promise<void> {
  const font = await getEmbeddedFont(
    pdfDocument,
    fontCache,
    object,
    loadUnicodeFont,
  );
  const cropBox = pdfPage.getCropBox();
  const fontSize = object.fontSize;
  const lineHeight = fontSize * object.lineHeight;
  const lines = object.text.split(/\r\n|\r|\n/);

  for (const [index, line] of lines.entries()) {
    const measuredWidth = measureStandardFontText(font, line, fontSize);
    const alignmentOffset = getAlignmentOffset({
      availableWidth: object.frame.width,
      measuredWidth,
      alignment: object.horizontalAlignment,
    });
    const baselineY =
      cropBox.y + cropBox.height - object.frame.y - fontSize - index * lineHeight;

    if (baselineY < cropBox.y) {
      return;
    }

    try {
      pdfPage.drawText(line, {
        x: cropBox.x + object.frame.x + alignmentOffset,
        y: baselineY,
        size: fontSize,
        font,
        color: rgbaToRgb(object.color),
        opacity: object.opacity * object.color.alpha,
        lineHeight,
        maxWidth: object.frame.width,
      });
    } catch (error) {
      throw createTextEncodingError(error);
    }
  }
}

function measureStandardFontText(
  font: PDFFont,
  line: string,
  fontSize: number,
): number {
  try {
    return font.widthOfTextAtSize(line, fontSize);
  } catch (error) {
    throw createTextEncodingError(error);
  }
}

function createTextEncodingError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const unsupportedCharacter = extractWinAnsiCharacter(message);

  if (unsupportedCharacter !== null) {
    return new Error(
      `PDFMech cannot export added text containing "${unsupportedCharacter}" yet. Use Latin letters, numbers, or symbols for added text, then download again.`,
    );
  }

  return error instanceof Error
    ? error
    : new Error("PDFMech could not export added text.");
}

function extractWinAnsiCharacter(message: string): string | null {
  const match = /WinAnsi cannot encode "([^"]+)"/.exec(message);
  return match?.[1] ?? null;
}

function drawWhiteoutObject(pdfPage: PDFPage, object: WhiteoutObject): void {
  const cropBox = pdfPage.getCropBox();
  pdfPage.drawRectangle({
    x: cropBox.x + object.frame.x,
    y: cropBox.y + cropBox.height - object.frame.y - object.frame.height,
    width: object.frame.width,
    height: object.frame.height,
    color: rgbaToRgb(object.color),
    opacity: object.opacity * object.color.alpha,
    borderWidth: 0,
  });
}

function drawRedactionObject(pdfPage: PDFPage, object: RedactionObject): void {
  const cropBox = pdfPage.getCropBox();
  const color = object.color ?? {
    red: 0,
    green: 0,
    blue: 0,
    alpha: 1,
  };
  pdfPage.drawRectangle({
    x: cropBox.x + object.frame.x,
    y: cropBox.y + cropBox.height - object.frame.y - object.frame.height,
    width: object.frame.width,
    height: object.frame.height,
    color: rgbaToRgb(color),
    opacity: object.opacity * color.alpha,
    borderWidth: 0,
  });
}

async function getEmbeddedFont(
  pdfDocument: PDFDocument,
  fontCache: Map<string, PDFFont>,
  object: TextObject,
  unicodeFontLoader: UnicodeFontLoader,
): Promise<PDFFont> {
  const standardFont = getStandardFont(object);
  const standardCacheKey = `standard:${standardFont}`;
  const cachedStandardFont = fontCache.get(standardCacheKey);
  const font =
    cachedStandardFont ?? (await pdfDocument.embedFont(standardFont));

  if (cachedStandardFont === undefined) {
    fontCache.set(standardCacheKey, font);
  }

  if (canFontEncode(font, object.text, object.fontSize)) {
    return font;
  }

  for (const fontKey of getUnicodeFontFallbackKeys(object)) {
    const cacheKey = `unicode:${fontKey}`;
    const cachedFont = fontCache.get(cacheKey);
    if (cachedFont !== undefined) {
      if (canFontEncode(cachedFont, object.text, object.fontSize)) {
        return cachedFont;
      }
      continue;
    }

    pdfDocument.registerFontkit(fontkit);
    const font = await pdfDocument.embedFont(await unicodeFontLoader(fontKey), {
      subset: true,
    });
    fontCache.set(cacheKey, font);
    if (canFontEncode(font, object.text, object.fontSize)) {
      return font;
    }
  }

  throw createTextEncodingError(
    new Error("PDFMech could not find an export font for this added text."),
  );
}

function canFontEncode(font: PDFFont, text: string, fontSize: number): boolean {
  try {
    for (const line of text.split(/\r\n|\r|\n/)) {
      font.widthOfTextAtSize(line, fontSize);
    }
    return true;
  } catch {
    return false;
  }
}

function getUnicodeFontVariant(object: TextObject): UnicodeFontVariant {
  if (object.font.weight === "bold" && object.font.style === "italic") {
    return "boldItalic";
  }
  if (object.font.weight === "bold") {
    return "bold";
  }
  if (object.font.style === "italic") {
    return "italic";
  }
  return "regular";
}

function getUnicodeFontWeight(object: TextObject): "regular" | "bold" {
  return object.font.weight === "bold" ? "bold" : "regular";
}

function getUnicodeFontFallbackKeys(object: TextObject): UnicodeFontKey[] {
  const variant = getUnicodeFontVariant(object);
  const weight = getUnicodeFontWeight(object);
  const keys: UnicodeFontKey[] = [];

  if (containsArabicScript(object.text)) {
    keys.push(`arabic:${weight}`);
  }
  if (containsDevanagariScript(object.text)) {
    keys.push(`devanagari:${weight}`);
  }
  if (containsJapaneseScript(object.text)) {
    keys.push(
      `japanese:119:${weight}`,
      `japanese:118:${weight}`,
      `japanese:117:${weight}`,
      `japanese:113:${weight}`,
    );
  }
  if (containsKoreanScript(object.text)) {
    keys.push(
      `korean:119:${weight}`,
      `korean:118:${weight}`,
      `korean:117:${weight}`,
      `korean:113:${weight}`,
    );
  }
  if (containsChineseScript(object.text)) {
    keys.push(`chinese:119:${weight}`, `chinese:118:${weight}`);
  }

  keys.push(`latin:${variant}`);
  return [...new Set(keys)];
}

function containsArabicScript(text: string): boolean {
  return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(text);
}

function containsDevanagariScript(text: string): boolean {
  return /[\u0900-\u097f]/u.test(text);
}

function containsJapaneseScript(text: string): boolean {
  return /[\u3040-\u30ff]/u.test(text);
}

function containsKoreanScript(text: string): boolean {
  return /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(text);
}

function containsChineseScript(text: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(text);
}

function getStandardFont(object: TextObject): StandardFonts {
  switch (object.font.family) {
    case "arial":
    case "helvetica":
    case "roboto":
    case "open-sans":
    case "montserrat":
    case "lato":
    case "poppins":
    case "inter":
    case "source-sans-pro":
      if (object.font.weight === "bold" && object.font.style === "italic") {
        return StandardFonts.HelveticaBoldOblique;
      }
      if (object.font.weight === "bold") {
        return StandardFonts.HelveticaBold;
      }
      if (object.font.style === "italic") {
        return StandardFonts.HelveticaOblique;
      }
      return StandardFonts.Helvetica;
    case "playfair-display":
      if (object.font.weight === "bold" && object.font.style === "italic") {
        return StandardFonts.TimesRomanBoldItalic;
      }
      if (object.font.weight === "bold") {
        return StandardFonts.TimesRomanBold;
      }
      if (object.font.style === "italic") {
        return StandardFonts.TimesRomanItalic;
      }
      return StandardFonts.TimesRoman;
    case "times":
      if (object.font.weight === "bold" && object.font.style === "italic") {
        return StandardFonts.TimesRomanBoldItalic;
      }
      if (object.font.weight === "bold") {
        return StandardFonts.TimesRomanBold;
      }
      if (object.font.style === "italic") {
        return StandardFonts.TimesRomanItalic;
      }
      return StandardFonts.TimesRoman;
    case "courier":
      if (object.font.weight === "bold" && object.font.style === "italic") {
        return StandardFonts.CourierBoldOblique;
      }
      if (object.font.weight === "bold") {
        return StandardFonts.CourierBold;
      }
      if (object.font.style === "italic") {
        return StandardFonts.CourierOblique;
      }
      return StandardFonts.Courier;
  }
}

function getAlignmentOffset(input: {
  readonly availableWidth: number;
  readonly measuredWidth: number;
  readonly alignment: TextObject["horizontalAlignment"];
}): number {
  const freeWidth = Math.max(0, input.availableWidth - input.measuredWidth);

  switch (input.alignment) {
    case "left":
      return 0;
    case "center":
      return freeWidth / 2;
    case "right":
      return freeWidth;
  }
}

function rgbaToRgb(color: RgbaColor) {
  return rgb(color.red, color.green, color.blue);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digestInput = Uint8Array.from(bytes);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    digestInput.buffer,
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
