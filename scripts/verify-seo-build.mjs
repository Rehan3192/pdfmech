import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalUrl, SEO_PAGE_KEYS, SEO_PAGES } from "../src/seo-config.ts";

const outputDirectory = join(process.cwd(), "dist");
const titles = new Set();
const descriptions = new Set();

function match(html, pattern, label, filename) {
  const value = html.match(pattern)?.[1];
  if (!value) throw new Error(`${filename} is missing ${label}.`);
  return value;
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
  JSON.parse(jsonLd);
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
