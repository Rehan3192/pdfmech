import "regenerator-runtime/runtime.js";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import liberationSansBoldUrl from "pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url";
import liberationSansItalicUrl from "pdfjs-dist/standard_fonts/LiberationSans-Italic.ttf?url";
import liberationSansRegularUrl from "pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url";
import mammoth from "mammoth";

import type { WordConversionProgress, WordInspection, WordPdfOptions, WordPdfResult, WordToPdfProcessor } from "../../ports/word-conversion";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const MARGINS = { compact: 36, normal: 54, wide: 72 } as const;

interface PdfContext {
  readonly document: PDFDocument;
  readonly regular: PDFFont;
  readonly bold: PDFFont;
  readonly italic: PDFFont;
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  page: PDFPage;
  y: number;
}

export class BrowserWordToPdfProcessor implements WordToPdfProcessor {
  async inspect(file: File, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<WordInspection> {
    assertDocx(file);
    throwIfAborted(signal);
    onProgress({ message: "Reading the Word document" });
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      { externalFileAccess: false, ignoreEmptyParagraphs: false },
    );
    throwIfAborted(signal);
    const parsed = new DOMParser().parseFromString(result.value, "text/html");
    parsed.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());
    parsed.querySelectorAll("a").forEach((link) => link.removeAttribute("href"));
    const text = parsed.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (text.length === 0 && parsed.querySelector("img") === null) throw new Error("No readable document content was found in this DOCX file.");
    const html = parsed.body.innerHTML;
    return {
      fileName: file.name,
      byteLength: file.size,
      html,
      wordCount: text === "" ? 0 : text.split(/\s+/).length,
      blockCount: parsed.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,table,img").length,
      warnings: result.messages.map((message) => message.message).slice(0, 8),
    };
  }

  async convert(inspection: WordInspection, options: WordPdfOptions, onProgress: (progress: WordConversionProgress) => void, signal?: AbortSignal): Promise<WordPdfResult> {
    throwIfAborted(signal);
    onProgress({ message: "Laying out the document" });
    const document = await PDFDocument.create();
    document.registerFontkit(fontkit);
    const [regularBytes, boldBytes, italicBytes] = await Promise.all([
      loadFont(liberationSansRegularUrl), loadFont(liberationSansBoldUrl), loadFont(liberationSansItalicUrl),
    ]);
    const regular = await document.embedFont(regularBytes, { subset: true });
    const bold = await document.embedFont(boldBytes, { subset: true });
    const italic = await document.embedFont(italicBytes, { subset: true });
    const base = PAGE_SIZES[options.pageSize];
    const [width, height] = options.orientation === "portrait" ? base : [base[1], base[0]];
    const margin = MARGINS[options.margin];
    const page = document.addPage([width, height]);
    const context: PdfContext = { document, regular, bold, italic, width, height, margin, page, y: height - margin };
    const parsed = new DOMParser().parseFromString(inspection.html, "text/html");
    const blocks = [...parsed.body.children];
    for (const [index, block] of blocks.entries()) {
      throwIfAborted(signal);
      await drawBlock(context, block);
      onProgress({ message: `Formatting section ${index + 1} of ${blocks.length}`, current: index + 1, total: blocks.length });
    }
    throwIfAborted(signal);
    onProgress({ message: "Validating the generated PDF" });
    document.setCreator("PDFMech");
    document.setProducer("PDFMech browser-local Word to PDF converter");
    document.setTitle(withoutExtension(inspection.fileName));
    const bytes = await document.save({ useObjectStreams: true });
    const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
    return { blob, downloadName: `${withoutExtension(inspection.fileName)}.pdf`, outputBytes: blob.size, pageCount: document.getPageCount() };
  }
}

async function drawBlock(context: PdfContext, element: Element): Promise<void> {
  const tag = element.tagName.toLocaleLowerCase("en");
  if (tag === "table") {
    for (const row of element.querySelectorAll(":scope > tbody > tr, :scope > thead > tr, :scope > tr")) {
      const cells = [...row.querySelectorAll(":scope > th, :scope > td")].map((cell) => cleanText(cell.textContent ?? ""));
      if (cells.length > 0) drawText(context, cells.join("  |  "), 9.5, row.querySelector("th") !== null ? context.bold : context.regular, 5, 0);
    }
    context.y -= 6;
    return;
  }
  if (tag === "ul" || tag === "ol") {
    const ordered = tag === "ol";
    [...element.children].filter((child) => child.tagName.toLocaleLowerCase("en") === "li").forEach((item, index) => {
      drawText(context, `${ordered ? `${index + 1}.` : "•"} ${cleanText(item.textContent ?? "")}`, 10.5, context.regular, 5, 16);
    });
    return;
  }
  if (tag === "img") {
    await drawImage(context, element.getAttribute("src") ?? "");
    return;
  }
  const size = tag === "h1" ? 22 : tag === "h2" ? 18 : tag === "h3" ? 15 : /^h[4-6]$/.test(tag) ? 12.5 : 10.5;
  const font = /^h[1-6]$/.test(tag) || tag === "strong" ? context.bold : tag === "em" ? context.italic : context.regular;
  const before = /^h[1-6]$/.test(tag) ? 10 : 2;
  drawText(context, cleanText(element.textContent ?? ""), size, font, /^h[1-6]$/.test(tag) ? 8 : 6, 0, before);
  for (const image of element.querySelectorAll("img")) await drawImage(context, image.getAttribute("src") ?? "");
}

function drawText(context: PdfContext, value: string, size: number, font: PDFFont, after: number, indent = 0, before = 0): void {
  if (value.length === 0) { context.y -= Math.max(6, after); return; }
  context.y -= before;
  const maxWidth = context.width - context.margin * 2 - indent;
  const safe = supportedText(value, font);
  const lines = wrapText(safe, font, size, maxWidth);
  const lineHeight = size * 1.36;
  for (const line of lines) {
    ensureSpace(context, lineHeight);
    context.page.drawText(line, { x: context.margin + indent, y: context.y - size, size, font, color: rgb(.06, .13, .2) });
    context.y -= lineHeight;
  }
  context.y -= after;
}

async function drawImage(context: PdfContext, src: string): Promise<void> {
  if (!src.startsWith("data:image/")) return;
  const match = src.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (match === null) return;
  try {
    const imageType = match[1] ?? "";
    const base64 = match[2] ?? "";
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const image = imageType.toLocaleLowerCase("en") === "png" ? await context.document.embedPng(bytes) : await context.document.embedJpg(bytes);
    const maxWidth = context.width - context.margin * 2;
    const maxHeight = Math.min(context.height * .45, 360);
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ensureSpace(context, height + 10);
    context.page.drawImage(image, { x: context.margin, y: context.y - height, width, height });
    context.y -= height + 10;
  } catch {
    drawText(context, "[Embedded image could not be converted]", 9, context.italic, 6);
  }
}

function ensureSpace(context: PdfContext, required: number): void {
  if (context.y - required >= context.margin) return;
  context.page = context.document.addPage([context.width, context.height]);
  context.y = context.height - context.margin;
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): readonly string[] {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { current = candidate; continue; }
    if (current !== "") lines.push(current);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) { current = word; continue; }
    let segment = "";
    for (const character of word) {
      if (font.widthOfTextAtSize(segment + character, size) > maxWidth && segment !== "") { lines.push(segment); segment = character; }
      else segment += character;
    }
    current = segment;
  }
  if (current !== "") lines.push(current);
  return lines;
}

function assertDocx(file: File): void {
  if (file.size === 0) throw new Error(`${file.name || "This file"} is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 50 MB limit.`);
  if (!file.name.toLocaleLowerCase("en").endsWith(".docx")) throw new Error("Choose a .docx Word document. The older .doc binary format is not supported.");
}

function cleanText(value: string): string { return value.replace(/\s+/g, " ").trim(); }
function withoutExtension(fileName: string): string { return fileName.replace(/\.docx$/i, "") || "converted-document"; }
async function loadFont(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("The local document font could not be loaded.");
  return new Uint8Array(await response.arrayBuffer());
}
function supportedText(value: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return [...value].map((character) => supported.has(character.codePointAt(0) ?? 0) ? character : "?").join("");
}
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted === true) throw new DOMException("The conversion was cancelled.", "AbortError"); }
