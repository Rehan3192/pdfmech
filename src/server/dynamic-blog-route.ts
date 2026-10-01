import sanitizeHtml from "sanitize-html";
import type { BlogPost } from "../blog";

const SITE_ORIGIN = "https://www.pdfmech.com";
const WORDPRESS_API = "https://cms.pdfmech.com/wp-json/wp/v2/posts";
const SOCIAL_IMAGE = `${SITE_ORIGIN}/PDFMechLogo.png`;
const FETCH_TIMEOUT_MS = 10_000;

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

interface WordPressPostResponse {
  readonly id: number;
  readonly slug: string;
  readonly date: string;
  readonly modified: string;
  readonly title: WordPressRenderedField;
  readonly excerpt: WordPressRenderedField;
  readonly content: WordPressRenderedField;
  readonly _embedded?: {
    readonly "wp:featuredmedia"?: readonly WordPressMedia[];
    readonly "wp:term"?: readonly (readonly WordPressTerm[])[];
  };
}

type Fetcher = typeof fetch;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function rewriteWordPressHref(href: string): string {
  try {
    const url = new URL(href, "https://cms.pdfmech.com");
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) return "#";
    if (href.startsWith("//")) return url.toString();
    if (url.origin !== "https://cms.pdfmech.com") return href;

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 1 && segments[0] !== undefined) {
      return `/blog/${segments[0]}${url.hash}`;
    }
  } catch {
    return "#";
  }

  return href;
}

function sanitizePostHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      "a", "blockquote", "br", "caption", "code", "col", "colgroup", "del",
      "div", "em", "figcaption", "figure", "h2", "h3", "h4", "h5", "hr",
      "img", "li", "ol", "p", "pre", "s", "span", "strong", "sub", "sup",
      "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
    ],
    allowedAttributes: {
      "*": ["class", "id"],
      a: ["href", "title", "target", "rel"],
      col: ["span"],
      img: ["src", "alt", "width", "height", "loading"],
      ol: ["start", "reversed", "type"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => {
        const href = rewriteWordPressHref(attributes.href ?? "#");
        const isExternal =
          /^https?:\/\//i.test(href) && !href.startsWith(SITE_ORIGIN);
        return {
          tagName: "a",
          attribs: {
            ...attributes,
            href,
            ...(isExternal
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {}),
          },
        };
      },
      img: (_tagName, attributes) => ({
        tagName: "img",
        attribs: { ...attributes, loading: "lazy", alt: attributes.alt ?? "" },
      }),
    },
  });
}

function normalizePost(post: WordPressPostResponse): BlogPost {
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
    contentHtml: sanitizePostHtml(post.content.rendered),
    date: post.date,
    modified: post.modified,
    featuredImageUrl: safeHttpsUrl(media?.source_url),
    featuredImageAlt: plainText(media?.alt_text ?? ""),
    categories,
  };
}

function postDescription(post: BlogPost): string {
  const source = post.excerpt || plainText(post.contentHtml);
  return source.length <= 160 ? source : `${source.slice(0, 157).trimEnd()}…`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.split("T")[0] ?? value;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
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

async function fetchPublishedPost(slug: string, fetcher: Fetcher): Promise<BlogPost | null> {
  const url = new URL(WORDPRESS_API);
  url.searchParams.set("slug", slug);
  url.searchParams.set("status", "publish");
  url.searchParams.set("_embed", "wp:featuredmedia,wp:term");
  url.searchParams.set(
    "_fields",
    "id,slug,date,modified,title,excerpt,content,_embedded",
  );

  const response = await fetchWithTimeout(fetcher, url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`WordPress returned ${response.status}.`);

  const posts = (await response.json()) as WordPressPostResponse[];
  const post = posts.find((candidate) => candidate.slug === slug);
  return post === undefined ? null : normalizePost(post);
}

async function fetchHtmlTemplate(request: Request, fetcher: Fetcher): Promise<string> {
  const requestUrl = new URL(request.url);
  const templateUrl = new URL("/blog", requestUrl.origin);
  const response = await fetchWithTimeout(fetcher, templateUrl.toString(), {
    headers: { Accept: "text/html" },
  });
  if (!response.ok) throw new Error(`PDFMech template returned ${response.status}.`);
  return response.text();
}

function replaceMeta(html: string, selector: string, value: string): string {
  const attribute = selector.startsWith("og:") ? "property" : "name";
  const pattern = new RegExp(`<meta\\s+${attribute}="${selector}"[^>]*>`, "i");
  return html.replace(
    pattern,
    `<meta ${attribute}="${selector}" content="${escapeHtml(value)}" />`,
  );
}

function replaceApplicationMarkup(html: string, markup: string): string {
  const bodyStart = html.search(/<body[^>]*>/i);
  if (bodyStart === -1) throw new Error("Template is missing the body element.");
  const bodyOpenEnd = html.indexOf(">", bodyStart) + 1;
  const moduleScriptStart = html.indexOf('<script type="module"', bodyOpenEnd);
  if (moduleScriptStart === -1) throw new Error("Template is missing the application script.");

  return `${html.slice(0, bodyOpenEnd)}\n    <div id="app">${markup}</div>\n    ${html.slice(moduleScriptStart)}`;
}

function serializeEmbeddedPost(post: BlogPost): string {
  return JSON.stringify(post)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function renderArticleSnapshot(post: BlogPost): string {
  const description = postDescription(post);
  const category =
    post.categories.find((item) => item.slug !== "uncategorized")?.name ?? "PDF guide";
  const updated = post.modified.split("T")[0] !== post.date.split("T")[0];
  const featuredImage = post.featuredImageUrl === null
    ? ""
    : `<img class="blog-featured-image" src="${escapeHtml(post.featuredImageUrl)}" alt="${escapeHtml(post.featuredImageAlt)}" width="1200" height="675">`;

  return `<div class="seo-snapshot"><header><a href="/" aria-label="PDFMech home"><img src="/PDFMechLogo-small.webp" width="55" height="55" alt=""><strong>PDFMech</strong></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/editor">PDF Editor</a><a href="/ocr-pdf">OCR PDF</a><a href="/features">Features</a><a href="/how-it-works">How It Works</a><a href="/blog">Blog</a></nav></header><main class="blog-article-page"><nav class="blog-article-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog">Guides</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(post.title)}</span></nav><article class="blog-article-shell"><header class="blog-article-header"><span class="hero-kicker">${escapeHtml(category)}</span><h1>${escapeHtml(post.title)}</h1><p>${escapeHtml(description)}</p><div class="blog-article-dates"><span>Published <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time></span>${updated ? `<span>Updated <time datetime="${escapeHtml(post.modified)}">${escapeHtml(formatDate(post.modified))}</time></span>` : ""}</div>${featuredImage}</header><div class="blog-prose">${post.contentHtml}</div><aside class="blog-inline-cta"><div><span>PDFMech browser tools</span><h2>Edit the document while it stays on your device.</h2></div><a href="/editor">Open PDF Editor</a></aside></article><nav class="blog-article-footer-nav" aria-label="Article navigation"><a href="/blog">← Back to all PDF guides</a><a href="/features">Explore PDFMech tools →</a></nav></main><footer><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/security">Security</a><a href="/terms">Terms</a><a href="/sitemap.xml">Sitemap</a></footer></div>`;
}

function renderArticleDocument(template: string, post: BlogPost): string {
  const url = `${SITE_ORIGIN}/blog/${post.slug}`;
  const title = `${post.title} | PDFMech`;
  const description = postDescription(post);
  const image = post.featuredImageUrl ?? SOCIAL_IMAGE;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: post.title,
        description,
        datePublished: post.date,
        dateModified: post.modified,
        mainEntityOfPage: url,
        image,
        author: { "@type": "Organization", name: "PDFMech", url: `${SITE_ORIGIN}/` },
        publisher: { "@type": "Organization", name: "PDFMech", url: `${SITE_ORIGIN}/` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_ORIGIN}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<link rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${url}" />`,
    )
    .replace(
      /<script id="route-structured-data"[^>]*>[\s\S]*?<\/script>/i,
      `<script id="route-structured-data" type="application/ld+json">${JSON.stringify(structuredData).replaceAll("<", "\\u003c")}</script>`,
    )
    .replace(
      /<\/head>/i,
      `<script id="blog-post-data" type="application/json">${serializeEmbeddedPost(post)}</script>\n  </head>`,
    );

  html = replaceMeta(html, "description", description);
  html = replaceMeta(html, "robots", "index,follow,max-image-preview:large");
  html = replaceMeta(html, "og:type", "article");
  html = replaceMeta(html, "og:url", url);
  html = replaceMeta(html, "og:title", title);
  html = replaceMeta(html, "og:description", description);
  html = replaceMeta(html, "og:image", image);
  html = replaceMeta(html, "twitter:title", title);
  html = replaceMeta(html, "twitter:description", description);
  html = replaceMeta(html, "twitter:image", image);
  return replaceApplicationMarkup(html, renderArticleSnapshot(post));
}

function renderStatusDocument(
  template: string,
  status: 404 | 503,
  requestedUrl: string,
): string {
  const unavailable = status === 503;
  const title = unavailable
    ? "Guide Temporarily Unavailable | PDFMech"
    : "Article Not Found | PDFMech";
  const heading = unavailable
    ? "This guide is temporarily unavailable."
    : "This PDFMech guide is unavailable.";
  const message = unavailable
    ? "Please try again shortly."
    : "It may have moved or not yet been published.";
  const label = unavailable ? "Temporary issue" : "Article not found";
  const markup = `<main class="blog-article-state"><span class="hero-kicker">${label}</span><h1>${heading}</h1><p>${message}</p><a href="/blog">Return to all guides</a></main>`;

  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<link rel="canonical"[^>]*>\s*/i, "")
    .replace(/<script id="route-structured-data"[^>]*>[\s\S]*?<\/script>\s*/i, "");
  html = replaceMeta(html, "description", message);
  html = replaceMeta(html, "robots", "noindex,follow");
  html = replaceMeta(html, "og:type", "website");
  html = replaceMeta(html, "og:url", requestedUrl);
  html = replaceMeta(html, "og:title", title);
  html = replaceMeta(html, "og:description", message);
  html = replaceMeta(html, "twitter:title", title);
  html = replaceMeta(html, "twitter:description", message);
  return replaceApplicationMarkup(html, markup);
}

function htmlResponse(html: string, status: number, cacheControl: string): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Vercel-CDN-Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function renderDynamicBlogRoute(
  request: Request,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const slug = requestUrl.searchParams.get("slug") ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
    const template = await fetchHtmlTemplate(request, fetcher);
    return htmlResponse(
      renderStatusDocument(template, 404, `${SITE_ORIGIN}/blog/${slug}`),
      404,
      "no-store",
    );
  }

  try {
    const [post, template] = await Promise.all([
      fetchPublishedPost(slug, fetcher),
      fetchHtmlTemplate(request, fetcher),
    ]);
    if (post === null) {
      return htmlResponse(
        renderStatusDocument(template, 404, `${SITE_ORIGIN}/blog/${slug}`),
        404,
        "no-store",
      );
    }

    return htmlResponse(
      renderArticleDocument(template, post),
      200,
      "public, s-maxage=60",
    );
  } catch {
    try {
      const template = await fetchHtmlTemplate(request, fetcher);
      const response = htmlResponse(
        renderStatusDocument(template, 503, `${SITE_ORIGIN}/blog/${slug}`),
        503,
        "no-store",
      );
      response.headers.set("Retry-After", "60");
      return response;
    } catch {
      return new Response(
        "<!doctype html><html lang=\"en\"><head><meta name=\"robots\" content=\"noindex,follow\"><title>Guide Temporarily Unavailable | PDFMech</title></head><body><main><h1>This guide is temporarily unavailable.</h1><p>Please try again shortly.</p><a href=\"/blog\">Return to all guides</a></main></body></html>",
        {
          status: 503,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Retry-After": "60",
          },
        },
      );
    }
  }
}
