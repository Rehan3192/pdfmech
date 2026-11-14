import sanitizeHtml from "sanitize-html";

const SITE_ORIGIN = "https://www.pdfmech.com";
const WORDPRESS_POSTS_API = "https://cms.pdfmech.com/wp-json/wp/v2/posts";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_ARCHIVE_POSTS = 100;
const MAX_SITEMAP_POSTS = 500;
const CDN_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=86400";

interface WordPressRenderedField {
  readonly rendered: string;
}

interface WordPressMedia {
  readonly source_url?: string;
  readonly alt_text?: string;
}

interface WordPressTerm {
  readonly taxonomy?: string;
  readonly name?: string;
  readonly slug?: string;
}

interface WordPressPostSummaryResponse {
  readonly id: number;
  readonly slug: string;
  readonly date: string;
  readonly modified: string;
  readonly title: WordPressRenderedField;
  readonly excerpt: WordPressRenderedField;
  readonly _embedded?: {
    readonly "wp:featuredmedia"?: readonly WordPressMedia[];
    readonly "wp:term"?: readonly (readonly WordPressTerm[])[];
  };
}

interface BlogPostSummary {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly contentHtml: "";
  readonly date: string;
  readonly modified: string;
  readonly featuredImageUrl: string | null;
  readonly featuredImageAlt: string;
  readonly categories: readonly { readonly name: string; readonly slug: string }[];
}

interface SitemapEntry {
  readonly url: string;
  readonly modified: string;
}

type Fetcher = typeof fetch;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeXml(value: string): string {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

function plainText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replaceAll(/\s+/g, " ")
    .trim();
}

function safeHttpsUrl(value: string | undefined): string | null {
  if (value === undefined) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isValidDate(value: string): boolean {
  return value.length > 0 && !Number.isNaN(new Date(value).getTime());
}

function isPublishedPostSummary(value: unknown): value is WordPressPostSummaryResponse {
  if (value === null || typeof value !== "object") return false;
  const post = value as Partial<WordPressPostSummaryResponse>;
  return (
    typeof post.id === "number" &&
    typeof post.slug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(post.slug) &&
    typeof post.date === "string" &&
    isValidDate(post.date) &&
    typeof post.modified === "string" &&
    isValidDate(post.modified) &&
    typeof post.title?.rendered === "string" &&
    typeof post.excerpt?.rendered === "string"
  );
}

function normalizePostSummary(post: WordPressPostSummaryResponse): BlogPostSummary {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const categories = (post._embedded?.["wp:term"] ?? [])
    .flat()
    .filter((term) => term.taxonomy === "category" && term.name && term.slug)
    .map((term) => ({ name: term.name ?? "", slug: term.slug ?? "" }));

  return {
    id: post.id,
    slug: post.slug,
    title: plainText(post.title.rendered),
    excerpt: plainText(post.excerpt.rendered),
    contentHtml: "",
    date: post.date,
    modified: post.modified,
    featuredImageUrl: safeHttpsUrl(media?.source_url),
    featuredImageAlt: plainText(media?.alt_text ?? ""),
    categories,
  };
}

async function fetchWithTimeout(
  fetcher: Fetcher,
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPublishedPosts(
  fetcher: Fetcher,
  maxPosts: number,
): Promise<readonly BlogPostSummary[]> {
  const posts: BlogPostSummary[] = [];
  const seenSlugs = new Set<string>();
  const perPage = 100;

  for (let page = 1; posts.length < maxPosts; page += 1) {
    const url = new URL(WORDPRESS_POSTS_API);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(Math.min(perPage, maxPosts - posts.length)));
    url.searchParams.set("status", "publish");
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "desc");
    url.searchParams.set("_embed", "wp:featuredmedia,wp:term");
    url.searchParams.set(
      "_fields",
      "id,slug,date,modified,title,excerpt,_embedded",
    );

    const response = await fetchWithTimeout(fetcher, url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`WordPress returned ${response.status}.`);

    const value: unknown = await response.json();
    if (!Array.isArray(value) || !value.every(isPublishedPostSummary)) {
      throw new Error("WordPress returned an invalid published-post inventory.");
    }

    for (const rawPost of value) {
      if (seenSlugs.has(rawPost.slug)) {
        throw new Error(`WordPress returned duplicate slug: ${rawPost.slug}.`);
      }
      seenSlugs.add(rawPost.slug);
      posts.push(normalizePostSummary(rawPost));
    }

    const totalPagesHeader = response.headers.get("x-wp-totalpages");
    const totalPages = totalPagesHeader === null
      ? page
      : Number.parseInt(totalPagesHeader, 10);
    if (!Number.isSafeInteger(totalPages) || totalPages < page) {
      throw new Error("WordPress returned an invalid pagination header.");
    }
    if (page >= totalPages || value.length === 0) break;
  }

  if (posts.length === 0) {
    throw new Error("WordPress returned no published posts.");
  }
  return posts;
}

async function fetchStaticFallback(
  request: Request,
  fetcher: Fetcher,
  pathname: string,
): Promise<string> {
  const url = new URL(pathname, new URL(request.url).origin);
  const response = await fetchWithTimeout(fetcher, url.toString(), {
    headers: { Accept: pathname.endsWith(".xml") ? "application/xml" : "text/html" },
  });
  if (!response.ok) throw new Error(`Static fallback returned ${response.status}.`);
  return response.text();
}

function serializeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function replaceApplicationMarkup(html: string, markup: string): string {
  const bodyStart = html.search(/<body[^>]*>/i);
  if (bodyStart === -1) throw new Error("Template is missing the body element.");
  const bodyOpenEnd = html.indexOf(">", bodyStart) + 1;
  const bodyCloseStart = html.search(/<\/body\s*>/i);
  if (bodyCloseStart === -1 || bodyCloseStart < bodyOpenEnd) {
    throw new Error("Template is missing the closing body element.");
  }
  return `${html.slice(0, bodyOpenEnd)}\n    <div id="app">${markup}</div>\n  ${html.slice(bodyCloseStart)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function renderArchiveSnapshot(posts: readonly BlogPostSummary[]): string {
  const cards = posts.map((post) => {
    const description = post.excerpt || "Read this practical PDF guide from PDFMech.";
    return `<article><h3><a href="/blog/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(description)}</p><time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time></article>`;
  }).join("");

  return `<div class="seo-snapshot" data-page="blog"><header><a href="/" aria-label="PDFMech home"><img src="/PDFMechLogo-small.webp" width="55" height="55" alt=""><strong>PDFMech</strong></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/tools">All PDF Tools</a><a href="/features">Features</a><a href="/how-it-works">How It Works</a><a href="/blog">Blog</a><a href="/faq">FAQ</a><a href="/about">About</a><a href="/contact">Contact</a></nav><a class="seo-snapshot-cta" href="/editor">Open PDF</a><span class="seo-snapshot-menu" aria-hidden="true">Menu</span></header><main><nav aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Practical PDF guides and privacy-first tips.</span></nav><section><p>Private browser PDF editing</p><h1>Practical PDF guides and privacy-first tips.</h1><p>Clear instructions for editing, organizing, searching, and protecting PDF documents with browser-based tools.</p><a href="/editor">Open PDFMech</a></section><section aria-label="Latest PDF guides"><h2>Latest articles</h2>${cards}</section><section class="seo-snapshot-details" aria-label="About PDFMech guides"><article><h2>Practical answers connected to working tools</h2><p>PDFMech guides explain common document problems, show the browser-based steps that solve them, and link directly to the relevant tool. Articles cover editing, OCR, forms, page organization, privacy, conversion, and safer document handling without turning a simple task into a wall of theory.</p></article><article><h2>Written for careful document work</h2><p>Each guide identifies important limits and review points, including when content becomes an image, when a signature may stop being valid, and why visual whiteout is different from secure redaction. Keep the original file and verify every important output before sharing it.</p></article></section></main><footer><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/security">Security</a><a href="/terms">Terms</a><a href="/sitemap.xml">Sitemap</a></footer></div>`;
}

function renderArchiveDocument(
  template: string,
  posts: readonly BlogPostSummary[],
): string {
  const archiveUrl = `${SITE_ORIGIN}/blog`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "PDFMech PDF guides",
        url: archiveUrl,
      },
      {
        "@type": "ItemList",
        itemListElement: posts.map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: post.title,
          url: `${SITE_ORIGIN}/blog/${post.slug}`,
        })),
      },
    ],
  };
  const embeddedPosts = serializeInlineJson(posts);

  let html = template.replace(
    /<script id="route-structured-data"[^>]*>[\s\S]*?<\/script>/i,
    `<script id="route-structured-data" type="application/ld+json">${serializeInlineJson(structuredData)}</script>`,
  );
  const dataScript = `<script id="blog-posts-data" type="application/json">${embeddedPosts}</script>`;
  if (/<script id="blog-posts-data"[^>]*>[\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(
      /<script id="blog-posts-data"[^>]*>[\s\S]*?<\/script>/i,
      dataScript,
    );
  } else {
    html = html.replace(/<\/head>/i, `${dataScript}\n  </head>`);
  }
  return replaceApplicationMarkup(html, renderArchiveSnapshot(posts));
}

function htmlResponse(html: string, source: "wordpress" | "static-fallback"): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Vercel-CDN-Cache-Control": CDN_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
      "X-PDFMech-Content-Source": source,
    },
  });
}

function parseStaticSitemap(xml: string): readonly SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/gi)) {
    const url = match[1]?.trim() ?? "";
    const modified = match[2]?.trim() ?? "";
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Static sitemap contains an invalid URL.");
    }
    if (parsed.origin !== SITE_ORIGIN || !isValidDate(modified) || seen.has(url)) {
      throw new Error("Static sitemap contains an invalid or duplicate entry.");
    }
    seen.add(url);
    entries.push({ url, modified });
  }
  if (entries.length === 0) throw new Error("Static sitemap contains no entries.");
  return entries;
}

function renderSitemap(
  staticXml: string,
  posts: readonly BlogPostSummary[],
): string {
  const latestBlogDate = posts.reduce(
    (latest, post) => post.modified > latest ? post.modified : latest,
    posts[0]?.modified ?? "",
  ).split("T")[0] ?? "";
  const staticEntries = parseStaticSitemap(staticXml)
    .filter((entry) => !entry.url.startsWith(`${SITE_ORIGIN}/blog/`))
    .map((entry) => entry.url === `${SITE_ORIGIN}/blog`
      ? { ...entry, modified: latestBlogDate }
      : entry);
  if (!staticEntries.some((entry) => entry.url === `${SITE_ORIGIN}/blog`)) {
    throw new Error("Static sitemap is missing the blog archive.");
  }

  const entries: SitemapEntry[] = [
    ...staticEntries,
    ...posts.map((post) => ({
      url: `${SITE_ORIGIN}/blog/${post.slug}`,
      modified: post.modified.split("T")[0] ?? post.modified,
    })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((entry) => `  <url>\n    <loc>${escapeXml(entry.url)}</loc>\n    <lastmod>${escapeXml(entry.modified)}</lastmod>\n  </url>`).join("\n")}\n</urlset>\n`;
}

function xmlResponse(xml: string, source: "wordpress" | "static-fallback"): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Vercel-CDN-Cache-Control": CDN_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
      "X-PDFMech-Content-Source": source,
    },
  });
}

function unavailableResponse(contentType: "html" | "xml"): Response {
  const body = contentType === "xml"
    ? "Service temporarily unavailable."
    : "<!doctype html><html lang=\"en\"><head><meta name=\"robots\" content=\"noindex,follow\"><title>Blog Temporarily Unavailable | PDFMech</title></head><body><main><h1>The PDFMech blog is temporarily unavailable.</h1><p>Please try again shortly.</p></main></body></html>";
  return new Response(body, {
    status: 503,
    headers: {
      "Content-Type": contentType === "xml"
        ? "text/plain; charset=utf-8"
        : "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function renderDynamicBlogArchive(
  request: Request,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  try {
    const [posts, template] = await Promise.all([
      fetchPublishedPosts(fetcher, MAX_ARCHIVE_POSTS),
      fetchStaticFallback(request, fetcher, "/_internal/blog"),
    ]);
    return htmlResponse(renderArchiveDocument(template, posts), "wordpress");
  } catch (error) {
    console.error("Unable to refresh the dynamic blog archive.", error);
    try {
      const fallback = await fetchStaticFallback(request, fetcher, "/_internal/blog");
      return htmlResponse(fallback, "static-fallback");
    } catch (fallbackError) {
      console.error("Unable to load the static blog archive fallback.", fallbackError);
      return unavailableResponse("html");
    }
  }
}

export async function renderDynamicSitemap(
  request: Request,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  try {
    const [posts, staticXml] = await Promise.all([
      fetchPublishedPosts(fetcher, MAX_SITEMAP_POSTS),
      fetchStaticFallback(request, fetcher, "/_internal/sitemap.xml"),
    ]);
    return xmlResponse(renderSitemap(staticXml, posts), "wordpress");
  } catch (error) {
    console.error("Unable to refresh the dynamic sitemap.", error);
    try {
      const fallback = await fetchStaticFallback(request, fetcher, "/_internal/sitemap.xml");
      return xmlResponse(fallback, "static-fallback");
    } catch (fallbackError) {
      console.error("Unable to load the static sitemap fallback.", fallbackError);
      return unavailableResponse("xml");
    }
  }
}
