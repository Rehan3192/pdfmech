import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildStructuredData,
  canonicalUrl,
  SEO_PAGE_KEYS,
  SEO_PAGES,
  SITE_ORIGIN,
  SOCIAL_IMAGE_PATH,
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
  const nav = SEO_PAGE_KEYS
    .filter((key) => !["security", "privacy", "terms"].includes(key))
    .map((key) => `<a href="${SEO_PAGES[key].path}">${key === "howItWorks" ? "How It Works" : key === "editor" ? "PDF Editor" : key[0].toUpperCase() + key.slice(1)}</a>`)
    .join("");
  const related = SEO_PAGE_KEYS
    .filter((key) => key !== page)
    .slice(0, 5)
    .map((key) => `<a href="${SEO_PAGES[key].path}">${escapeHtml(SEO_PAGES[key].h1)}</a>`)
    .join("");

  return `<div class="seo-snapshot"><header><a href="/" aria-label="PDFMech home"><img src="/PDFMechLogo-small.webp" width="55" height="55" alt=""><strong>PDFMech</strong></a><nav aria-label="Main navigation">${nav}</nav></header><main><nav aria-label="Breadcrumb"><a href="/">Home</a>${page === "home" ? "" : `<span aria-hidden="true">/</span><span>${escapeHtml(config.h1)}</span>`}</nav><section><p>Private browser PDF editing</p><h1>${escapeHtml(config.h1)}</h1><p>${escapeHtml(config.intro)}</p><a href="/editor">Open PDFMech</a></section><nav aria-label="Related PDFMech pages"><strong>Explore PDFMech</strong>${related}</nav></main><footer><a href="/privacy">Privacy</a><a href="/security">Security</a><a href="/terms">Terms</a><a href="/sitemap.xml">Sitemap</a></footer></div>`;
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

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${SEO_PAGE_KEYS.map((page) => `  <url>\n    <loc>${canonicalUrl(page)}</loc>\n    <lastmod>2026-09-14</lastmod>\n  </url>`).join("\n")}\n</urlset>\n`;
await writeFile(join(outputDirectory, "sitemap.xml"), sitemap);

if (!template.includes(`content="${SITE_ORIGIN}${SOCIAL_IMAGE_PATH}"`)) {
  throw new Error("The social sharing image metadata is missing from index.html.");
}
