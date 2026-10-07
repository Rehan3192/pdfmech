import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  canonicalUrl,
  SEO_PAGE_KEYS,
  SEO_PAGES,
  TOOL_ROUTE_FAQS,
  TOOL_SEO_PAGE_KEYS,
} from "../src/seo-config.ts";

const outputDirectory = join(process.cwd(), "dist");
const titles = new Set();
const descriptions = new Set();

function match(html, pattern, label, filename) {
  const value = html.match(pattern)?.[1];
  if (!value) throw new Error(`${filename} is missing ${label}.`);
  return value;
}

function escapeForHtmlCheck(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

for (const page of SEO_PAGE_KEYS) {
  const config = SEO_PAGES[page];
  const filename = page === "home" ? "index.html" : `${config.path.slice(1)}.html`;
  const html = await readFile(join(outputDirectory, filename), "utf8");
  const title = match(html, /<title>(.*?)<\/title>/i, "a title", filename);
  const description = match(
    html,
    /<meta name="description" content="([^"]+)"\s*\/>/i,
    "a meta description",
    filename,
  );
  const canonical = match(
    html,
    /<link rel="canonical" href="([^"]+)"\s*\/>/i,
    "a canonical URL",
    filename,
  );
  const jsonLd = match(
    html,
    /<script id="route-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/i,
    "route structured data",
    filename,
  );

  if (canonical !== canonicalUrl(page)) {
    throw new Error(`${filename} has an incorrect canonical URL: ${canonical}`);
  }
  if (!html.includes('name="robots" content="index,follow,max-image-preview:large"')) {
    throw new Error(`${filename} is not indexable.`);
  }
  if ((html.match(/<h1>/gi) ?? []).length !== 1) {
    throw new Error(`${filename} must contain exactly one crawlable H1.`);
  }
  if (
    page === "addTextToPdf" &&
    (!html.includes("How to add text to a PDF") ||
      !html.includes("Local browser processing") ||
      !html.includes('/add-text-to-pdf#add-text-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable task instructions and a same-route action.`,
    );
  }
  if (
    page === "deletePdfPages" &&
    (!html.includes("How to delete PDF pages") ||
      !html.includes("Local browser processing") ||
      !html.includes('/delete-pdf-pages#delete-pages-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable page-deletion instructions and a same-route action.`,
    );
  }
  if (
    page === "reorderPdfPages" &&
    (!html.includes("How to reorder PDF pages") ||
      !html.includes("Local browser processing") ||
      !html.includes('/reorder-pdf-pages#reorder-pages-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable page-reordering instructions and a same-route action.`,
    );
  }
  if (
    page === "rotatePdfPages" &&
    (!html.includes("How to rotate PDF pages") ||
      !html.includes("Local browser processing") ||
      !html.includes('/rotate-pdf-pages#rotate-pages-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable page-rotation instructions and a same-route action.`,
    );
  }
  if (
    page === "whiteoutPdf" &&
    (!html.includes("How to white out PDF content") ||
      !html.includes("Visual cover, not secure redaction") ||
      !html.includes('/whiteout-pdf#whiteout-pdf-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable whiteout instructions, its security limit, and a same-route action.`,
    );
  }
  if (
    page === "ocrPdf" &&
    (!html.includes("How to make a scanned PDF searchable") ||
      !html.includes("Private browser OCR") ||
      !html.includes("Preserves the scanned page") ||
      !html.includes('/ocr-pdf#ocr-pdf-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable OCR instructions, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "batesNumberingPdf" &&
    (!html.includes("How to add Bates numbers to a PDF") ||
      !html.includes("Continuous numbering across PDFs") ||
      !html.includes("Private local processing") ||
      !html.includes('/bates-numbering-pdf#bates-numbering-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable Bates numbering instructions, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "flattenPdf" &&
    (!html.includes("How to flatten PDF form fields") ||
      !html.includes("AcroForm fields become fixed content") ||
      !html.includes("Private local form processing") ||
      !html.includes("Clear product limits") ||
      !html.includes('/flatten-pdf#flatten-pdf-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable form-flattening instructions, scope, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "deskewPdf" &&
    (!html.includes("How to straighten a scanned PDF") ||
      !html.includes("Automatic and manual deskew") ||
      !html.includes("Private scan processing") ||
      !html.includes("Scan-specific raster output") ||
      !html.includes('/deskew-pdf#deskew-pdf-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable deskew instructions, output limits, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "metadataPdf" &&
    (!html.includes("How to remove PDF metadata") ||
      !html.includes("Standard, custom, and XMP metadata") ||
      !html.includes("Private metadata processing") ||
      !html.includes("Important privacy limit") ||
      !html.includes('/remove-pdf-metadata#pdf-metadata-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable metadata-removal instructions, scope, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "comparePdf" &&
    (!html.includes("How to compare two PDF files") ||
      !html.includes("Page-by-page text differences") ||
      !html.includes("Private local comparison") ||
      !html.includes("Text-only comparison limits") ||
      !html.includes('/compare-pdf#compare-pdf-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable PDF comparison instructions, text-only scope, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "extractPdfPages" &&
    (!html.includes("How to extract pages from a PDF") ||
      !html.includes("Native PDF page extraction") ||
      !html.includes("Private local page processing") ||
      !html.includes("Document-level transfer limits") ||
      !html.includes('/extract-pdf-pages#extract-pdf-pages-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable page-extraction instructions, transfer limits, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "mergePdf" &&
    (!html.includes("How to merge PDF files online") ||
      !html.includes("Native PDF page merging") ||
      !html.includes("Private local PDF merging") ||
      !html.includes("Document-level merge limits") ||
      !html.includes('/merge-pdf#merge-pdf-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable PDF merging instructions, transfer limits, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "splitPdf" &&
    (!html.includes("How to split a PDF online") ||
      !html.includes("Native PDF page splitting") ||
      !html.includes("Private local PDF splitting") ||
      !html.includes("Document-level split limits") ||
      !html.includes('/split-pdf#split-pdf-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable PDF splitting instructions, transfer limits, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "compressPdf" &&
    (!html.includes("How to compress a PDF online") ||
      !html.includes("Private local PDF compression") ||
      !html.includes("Best for scanned and image-heavy PDFs") ||
      !html.includes("Raster compression limits") ||
      !html.includes('/compress-pdf#compress-pdf-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable PDF compression instructions, raster limits, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "redactPdf" &&
    (!html.includes("How to redact a PDF securely online") ||
      !html.includes("Permanent redaction instead of visual whiteout") ||
      !html.includes("Private browser-local PDF redaction") ||
      !html.includes("Redaction limits and verification") ||
      !html.includes('/redact-pdf#redact-pdf-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable secure-redaction instructions, verification limits, privacy details, and a same-route action.`,
    );
  }
  if (
    page === "protectPdf" &&
    (!html.includes("How to password protect a PDF online") ||
      !html.includes("Private browser-local PDF encryption") ||
      !html.includes("AES-256 open-password protection") ||
      !html.includes("PDF permission limits") ||
      !html.includes('/protect-pdf#protect-pdf-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable password-protection instructions, encryption details, permission limits, and a same-route action.`,
    );
  }
  if (
    page === "privatePdfEditor" &&
    (!html.includes("How private browser PDF editing works") ||
      !html.includes("Local recovery under your control") ||
      !html.includes("Verify local processing") ||
      !html.includes('/private-pdf-editor#private-pdf-editor-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable local-processing proof and a same-route action.`,
    );
  }
  if (
    page === "editPdfOnIphone" &&
    (!html.includes("How to edit a PDF on iPhone in Safari") ||
      !html.includes("Where iPhone downloads are saved") ||
      !html.includes("Mobile PDF editing limits") ||
      !html.includes('/edit-pdf-on-iphone#iphone-pdf-editor-tool'))
  ) {
    throw new Error(
      `${filename} must expose crawlable iPhone instructions, limitations, and a same-route action.`,
    );
  }
  const structuredData = JSON.parse(jsonLd);
  const graph = structuredData["@graph"];
  if (!Array.isArray(graph)) {
    throw new Error(`${filename} must expose a Schema.org graph.`);
  }
  if (TOOL_ROUTE_FAQS[page] !== undefined) {
    const faqSchema = graph.find((item) => item["@type"] === "FAQPage");
    const routeFaqs = TOOL_ROUTE_FAQS[page] ?? [];
    if (
      faqSchema === undefined ||
      faqSchema.mainEntity?.length !== routeFaqs.length ||
      routeFaqs.some(
        (item) =>
          !html.includes(escapeForHtmlCheck(item.question)) ||
          !html.includes(escapeForHtmlCheck(item.answer)),
      )
    ) {
      throw new Error(`${filename} must expose matching visible and structured FAQ content.`);
    }
  }
  if (page === "tools") {
    const toolList = graph.find((item) => item["@type"] === "ItemList");
    if (
      toolList === undefined ||
      toolList.numberOfItems !== TOOL_SEO_PAGE_KEYS.length ||
      TOOL_SEO_PAGE_KEYS.some(
        (toolPage) =>
          !JSON.stringify(toolList).includes(canonicalUrl(toolPage)) ||
          !html.includes(`href="${SEO_PAGES[toolPage].path}"`),
      )
    ) {
      throw new Error(`${filename} must identify every focused PDF tool in its ItemList schema.`);
    }
  }
  if (
    page === "editPdfOnIphone" &&
    !graph.some((item) => item["@type"] === "Article")
  ) {
    throw new Error(`${filename} must expose Article structured data.`);
  }
  titles.add(title);
  descriptions.add(description);
}

if (titles.size !== SEO_PAGE_KEYS.length || descriptions.size !== SEO_PAGE_KEYS.length) {
  throw new Error("Every indexable route must have a unique title and description.");
}

const notFound = await readFile(join(outputDirectory, "404.html"), "utf8");
if (!notFound.includes('name="robots" content="noindex,follow"')) {
  throw new Error("404.html must be noindex,follow.");
}
if (notFound.includes('rel="canonical"')) {
  throw new Error("404.html must not claim a canonical indexable URL.");
}

const sitemap = await readFile(join(outputDirectory, "sitemap.xml"), "utf8");
for (const page of SEO_PAGE_KEYS) {
  if (!sitemap.includes(`<loc>${canonicalUrl(page)}</loc>`)) {
    throw new Error(`sitemap.xml is missing ${canonicalUrl(page)}.`);
  }
}

const blogArchive = await readFile(join(outputDirectory, "blog.html"), "utf8");
if (blogArchive.includes("Hello world!")) {
  throw new Error("The default WordPress Hello world post must not be published on PDFMech.");
}

let blogFiles = [];
try {
  blogFiles = (await readdir(join(outputDirectory, "blog"))).filter((file) => file.endsWith(".html"));
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
}
if (blogFiles.length > 0) {
  throw new Error(
    "Blog post HTML must be served by the dynamic Vercel route, not static files.",
  );
}

const vercelConfig = JSON.parse(await readFile(join(process.cwd(), "vercel.json"), "utf8"));
const dynamicBlogRewrite = vercelConfig.rewrites?.find(
  (rewrite) =>
    rewrite.source === "/blog/:slug" &&
    rewrite.destination === "/api/blog-post?slug=:slug",
);
if (dynamicBlogRewrite === undefined) {
  throw new Error("vercel.json must route dynamic blog posts through the server renderer.");
}

console.log(`Verified SEO output for ${SEO_PAGE_KEYS.length} routes, the dynamic blog renderer, and the custom 404 page.`);
