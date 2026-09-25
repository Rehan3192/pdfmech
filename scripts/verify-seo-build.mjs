import { readFile } from "node:fs/promises";
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
  const structuredData = JSON.parse(jsonLd);
  const graph = structuredData["@graph"];
  if (!Array.isArray(graph)) {
    throw new Error(`${filename} must expose a Schema.org graph.`);
  }
  if (TOOL_SEO_PAGE_KEYS.includes(page)) {
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
  if (page === "features") {
    const toolList = graph.find((item) => item["@type"] === "ItemList");
    if (
      toolList === undefined ||
      toolList.numberOfItems !== TOOL_SEO_PAGE_KEYS.length ||
      TOOL_SEO_PAGE_KEYS.some(
        (toolPage) =>
          !JSON.stringify(toolList).includes(canonicalUrl(toolPage)),
      )
    ) {
      throw new Error(`${filename} must identify every focused PDF tool in its ItemList schema.`);
    }
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

console.log(`Verified SEO output for ${SEO_PAGE_KEYS.length} routes plus the custom 404 page.`);
