import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildStructuredData,
  canonicalUrl,
  SEO_PAGE_KEYS,
  SEO_PAGES,
  SITE_ORIGIN,
  SOCIAL_IMAGE_PATH,
  TOOL_ROUTE_FAQS,
} from "../src/seo-config.ts";

const outputDirectory = join(process.cwd(), "dist");
const template = await readFile(join(outputDirectory, "index.html"), "utf8");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function replaceMeta(html, selector, value) {
  const attribute = selector.startsWith("og:") ? "property" : "name";
  const pattern = new RegExp(`<meta\\s+${attribute}="${selector}"[^>]*>`, "i");
  return html.replace(pattern, `<meta ${attribute}="${selector}" content="${escapeHtml(value)}" />`);
}

function renderSnapshot(page) {
  const config = SEO_PAGES[page];
  const routeLabels = {
    home: "Home",
    editor: "PDF Editor",
    addTextToPdf: "Add Text to PDF",
    deletePdfPages: "Delete PDF Pages",
    reorderPdfPages: "Reorder PDF Pages",
    rotatePdfPages: "Rotate PDF Pages",
    whiteoutPdf: "White Out PDF",
    privatePdfEditor: "Private PDF Editor",
    features: "Features",
    howItWorks: "How It Works",
    faq: "FAQ",
    about: "About",
    contact: "Contact",
  };
  const nav = SEO_PAGE_KEYS
    .filter((key) => !["security", "privacy", "terms"].includes(key))
    .map((key) => `<a href="${SEO_PAGES[key].path}">${routeLabels[key] ?? key}</a>`)
    .join("");
  const related = SEO_PAGE_KEYS
    .filter((key) => key !== page)
    .slice(0, 5)
    .map((key) => `<a href="${SEO_PAGES[key].path}">${escapeHtml(SEO_PAGES[key].h1)}</a>`)
    .join("");

  const isAddTextTool = page === "addTextToPdf";
  const isDeletePagesTool = page === "deletePdfPages";
  const isReorderPagesTool = page === "reorderPdfPages";
  const isRotatePagesTool = page === "rotatePdfPages";
  const isWhiteoutTool = page === "whiteoutPdf";
  const isPrivateEditor = page === "privatePdfEditor";
  const toolContent = isAddTextTool
    ? `<section><h2>How to add text to a PDF</h2><ol><li>Choose a PDF from your device.</li><li>Click or tap where the new text should appear.</li><li>Adjust font, size, color, bold style, and alignment.</li><li>Review and download a separate edited copy.</li></ol><h2>Local browser processing</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>What the Text tool changes</h2><p>PDFMech adds a new editable text box above the PDF page. It does not rewrite text already embedded in the original PDF.</p></section>`
    : isDeletePagesTool
      ? `<section><h2>How to delete PDF pages</h2><ol><li>Choose a PDF from your device.</li><li>Select an unwanted page from the thumbnails.</li><li>Delete the selected page and review the remaining page count.</li><li>Download a separate edited copy.</li></ol><h2>Local browser processing</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Remove complete pages</h2><p>PDFMech removes selected pages from the working document used for export. Your original PDF file remains unchanged on your device.</p></section>`
      : isReorderPagesTool
        ? `<section><h2>How to reorder PDF pages</h2><ol><li>Choose a PDF from your device.</li><li>Select a page from the thumbnails.</li><li>Move the selected page earlier or later in the document.</li><li>Review the sequence and download a separate organized copy.</li></ol><h2>Local browser processing</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Move complete pages</h2><p>PDFMech changes the page sequence in the working document used for export. Your original PDF file remains unchanged on your device.</p></section>`
        : isRotatePagesTool
          ? `<section><h2>How to rotate PDF pages</h2><ol><li>Choose a PDF from your device.</li><li>Select a sideways or upside-down page from the thumbnails.</li><li>Rotate the selected page clockwise by 90 degrees.</li><li>Review the orientation and download a separate corrected copy.</li></ol><h2>Local browser processing</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Correct individual page orientation</h2><p>PDFMech rotates only the selected page in the working document used for export. Your original PDF file remains unchanged on your device.</p></section>`
          : isWhiteoutTool
            ? `<section><h2>How to white out PDF content</h2><ol><li>Choose a PDF from your device.</li><li>Click or tap where a visual cover should appear.</li><li>Move, resize, and recolor the whiteout cover.</li><li>Review the page and download a separate edited copy.</li></ol><h2>Local browser processing</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Visual cover, not secure redaction</h2><p>Whiteout places an opaque cover over visible content. It does not guarantee removal of underlying PDF text, metadata, or other data.</p></section>`
            : isPrivateEditor
              ? `<section><h2>How private browser PDF editing works</h2><ol><li>Choose a PDF from your device.</li><li>The browser reads and renders the document locally.</li><li>Make supported text, visual cover, or page changes.</li><li>Validate and download a separate PDF generated in your browser.</li></ol><h2>Local recovery under your control</h2><p>Recovery may store the source PDF and editing state in IndexedDB in the current browser. Clear Document removes the current local checkpoint.</p><h2>Verify local processing</h2><p>Open the browser Network panel before choosing a test PDF. The source document is processed locally rather than posted to a PDFMech editing endpoint.</p></section>`
              : "";
  const routeFaqs = TOOL_ROUTE_FAQS[page] ?? [];
  const faqContent = routeFaqs.length > 0
    ? `<section aria-label="Frequently asked questions"><h2>${escapeHtml(config.h1.replace(/\.$/, ""))} FAQ</h2>${routeFaqs.map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join("")}</section>`
    : "";
  const actionPath = isAddTextTool
    ? "/add-text-to-pdf#add-text-tool"
    : isDeletePagesTool
      ? "/delete-pdf-pages#delete-pages-tool"
      : isReorderPagesTool
        ? "/reorder-pdf-pages#reorder-pages-tool"
        : isRotatePagesTool
          ? "/rotate-pdf-pages#rotate-pages-tool"
          : isWhiteoutTool
            ? "/whiteout-pdf#whiteout-pdf-tool"
            : isPrivateEditor
              ? "/private-pdf-editor#private-pdf-editor-tool"
              : "/editor";
  const actionLabel = isAddTextTool
    ? "Choose a PDF to add text"
    : isDeletePagesTool
      ? "Choose a PDF to delete pages"
      : isReorderPagesTool
        ? "Choose a PDF to reorder pages"
        : isRotatePagesTool
          ? "Choose a PDF to rotate pages"
          : isWhiteoutTool
            ? "Choose a PDF to white out content"
            : isPrivateEditor
              ? "Choose a PDF to edit privately"
              : "Open PDFMech";

  return `<div class="seo-snapshot"><header><a href="/" aria-label="PDFMech home"><img src="/PDFMechLogo-small.webp" width="55" height="55" alt=""><strong>PDFMech</strong></a><nav aria-label="Main navigation">${nav}</nav></header><main><nav aria-label="Breadcrumb"><a href="/">Home</a>${page === "home" ? "" : `<span aria-hidden="true">/</span><span>${escapeHtml(config.h1)}</span>`}</nav><section><p>Private browser PDF editing</p><h1>${escapeHtml(config.h1)}</h1><p>${escapeHtml(config.intro)}</p><a href="${actionPath}">${actionLabel}</a></section>${toolContent}${faqContent}<nav aria-label="Related PDFMech pages"><strong>Explore PDFMech</strong>${related}</nav></main><footer><a href="/privacy">Privacy</a><a href="/security">Security</a><a href="/terms">Terms</a><a href="/sitemap.xml">Sitemap</a></footer></div>`;
}

function renderRoute(page) {
  const config = SEO_PAGES[page];
  const url = canonicalUrl(page);
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(config.title)}</title>`)
    .replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${url}" />`)
    .replace(/<script id="route-structured-data"[^>]*>[\s\S]*?<\/script>/i, `<script id="route-structured-data" type="application/ld+json">${JSON.stringify(buildStructuredData(page))}</script>`)
    .replace('<div id="app"></div>', `<div id="app">${renderSnapshot(page)}</div>`);

  html = replaceMeta(html, "description", config.description);
  html = replaceMeta(html, "robots", "index,follow,max-image-preview:large");
  html = replaceMeta(html, "og:url", url);
  html = replaceMeta(html, "og:title", config.title);
  html = replaceMeta(html, "og:description", config.description);
  html = replaceMeta(html, "twitter:title", config.title);
  html = replaceMeta(html, "twitter:description", config.description);
  return html;
}

for (const page of SEO_PAGE_KEYS) {
  const config = SEO_PAGES[page];
  const filename = page === "home" ? "index.html" : `${config.path.slice(1)}.html`;
  await writeFile(join(outputDirectory, filename), renderRoute(page));
}

const notFoundTitle = "Page Not Found | PDFMech";
let notFound = template
  .replace(/<title>[\s\S]*?<\/title>/i, `<title>${notFoundTitle}</title>`)
  .replace(/<link rel="canonical"[^>]*>\s*/i, "")
  .replace(/<script id="route-structured-data"[^>]*>[\s\S]*?<\/script>/i, "")
  .replace('<div id="app"></div>', '<div id="app"><main class="seo-snapshot seo-not-found"><section><p>404</p><h1>Page not found</h1><p>The PDFMech page you requested does not exist or may have moved.</p><a href="/">Return home</a><a href="/editor">Open the PDF editor</a></section></main></div>');
notFound = replaceMeta(notFound, "description", "The requested PDFMech page could not be found. Return home or open the free browser PDF editor.");
notFound = replaceMeta(notFound, "robots", "noindex,follow");
notFound = replaceMeta(notFound, "og:url", `${SITE_ORIGIN}/404`);
notFound = replaceMeta(notFound, "og:title", notFoundTitle);
notFound = replaceMeta(notFound, "og:description", "The requested PDFMech page could not be found.");
notFound = replaceMeta(notFound, "twitter:title", notFoundTitle);
notFound = replaceMeta(notFound, "twitter:description", "The requested PDFMech page could not be found.");
await writeFile(join(outputDirectory, "404.html"), notFound);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${SEO_PAGE_KEYS.map((page) => `  <url>\n    <loc>${canonicalUrl(page)}</loc>\n    <lastmod>2026-09-25</lastmod>\n  </url>`).join("\n")}\n</urlset>\n`;
await writeFile(join(outputDirectory, "sitemap.xml"), sitemap);

if (!template.includes(`content="${SITE_ORIGIN}${SOCIAL_IMAGE_PATH}"`)) {
  throw new Error("The social sharing image metadata is missing from index.html.");
}
