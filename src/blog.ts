import DOMPurify from "dompurify";

export const WORDPRESS_SITE_ORIGIN = "https://cms.pdfmech.com";
export const WORDPRESS_API_BASE = `${WORDPRESS_SITE_ORIGIN}/wp-json/wp/v2`;

const HIDDEN_POST_SLUGS = new Set(["hello-world"]);
const FETCH_TIMEOUT_MS = 12_000;

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

export interface BlogCategory {
  readonly name: string;
  readonly slug: string;
}

export interface BlogPost {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly contentHtml: string;
  readonly date: string;
  readonly modified: string;
  readonly featuredImageUrl: string | null;
  readonly featuredImageAlt: string;
  readonly categories: readonly BlogCategory[];
}

let embeddedBlogPostCache: BlogPost | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getEmbeddedBlogPost(slug: string): BlogPost | null {
  if (embeddedBlogPostCache !== undefined) {
    return embeddedBlogPostCache?.slug === slug ? embeddedBlogPostCache : null;
  }
  embeddedBlogPostCache = null;
  if (typeof document === "undefined") return null;

  const element = document.querySelector<HTMLScriptElement>("#blog-post-data");
  if (element?.textContent === null || element?.textContent === undefined) return null;

  try {
    const value: unknown = JSON.parse(element.textContent);
    if (
      !isRecord(value) ||
      typeof value.id !== "number" ||
      typeof value.slug !== "string" ||
      typeof value.title !== "string" ||
      typeof value.excerpt !== "string" ||
      typeof value.contentHtml !== "string" ||
      typeof value.date !== "string" ||
      typeof value.modified !== "string" ||
      !Array.isArray(value.categories)
    ) {
      return null;
    }

    const categories = value.categories
      .filter(
        (category): category is Record<string, unknown> =>
          isRecord(category) &&
          typeof category.name === "string" &&
          typeof category.slug === "string",
      )
      .map((category) => ({
        name: category.name as string,
        slug: category.slug as string,
      }));
    const featuredImageUrl =
      value.featuredImageUrl === null
        ? null
        : typeof value.featuredImageUrl === "string"
          ? safeHttpsUrl(value.featuredImageUrl)
          : null;

    embeddedBlogPostCache = {
      id: value.id,
      slug: value.slug,
      title: value.title,
      excerpt: value.excerpt,
      contentHtml: sanitizeWordPressHtml(value.contentHtml),
      date: value.date,
      modified: value.modified,
      featuredImageUrl,
      featuredImageAlt:
        typeof value.featuredImageAlt === "string" ? value.featuredImageAlt : "",
      categories,
    };
  } catch {
    embeddedBlogPostCache = null;
  }

  return embeddedBlogPostCache?.slug === slug ? embeddedBlogPostCache : null;
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    nbsp: " ",
    quot: '"',
    rdquo: "”",
    rsquo: "’",
    ndash: "–",
    mdash: "—",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, key: string) => {
    if (key.startsWith("#")) {
      const hexadecimal = key[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return namedEntities[key.toLowerCase()] ?? entity;
  });
}

export function htmlToPlainText(value: string): string {
  return decodeHtmlEntities(
    value
      .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replaceAll(/<[^>]*>/g, " "),
  )
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function rewriteWordPressHref(href: string): string {
  try {
    const url = new URL(href, WORDPRESS_SITE_ORIGIN);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) return "#";
    if (href.startsWith("//")) return url.toString();
    if (url.origin !== WORDPRESS_SITE_ORIGIN) return href;

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 1 && segments[0] !== undefined) {
      return `/blog/${segments[0]}${url.hash}`;
    }
  } catch {
    return "#";
  }

  return href;
}

export function sanitizeWordPressHtml(value: string): string {
  const cleanHtml = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      "a",
      "blockquote",
      "br",
      "caption",
      "code",
      "col",
      "colgroup",
      "del",
      "div",
      "em",
      "figcaption",
      "figure",
      "h2",
      "h3",
      "h4",
      "h5",
      "hr",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "s",
      "span",
      "strong",
      "sub",
      "sup",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "thead",
      "tr",
      "u",
      "ul",
    ],
    ALLOWED_ATTR: [
      "alt",
      "class",
      "colspan",
      "height",
      "href",
      "id",
      "rel",
      "reversed",
      "rowspan",
      "scope",
      "span",
      "src",
      "start",
      "target",
      "title",
      "type",
      "width",
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/|#)/i,
  });

  const document = new DOMParser().parseFromString(String(cleanHtml), "text/html");
  for (const anchor of document.querySelectorAll("a")) {
    const href = rewriteWordPressHref(anchor.getAttribute("href") ?? "#");
    anchor.setAttribute("href", href);
    if (/^https?:\/\//i.test(href) && !href.startsWith("https://www.pdfmech.com")) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  }
  for (const image of document.querySelectorAll("img")) {
    const source = safeHttpsUrl(image.getAttribute("src") ?? undefined);
    if (source === null) {
      image.remove();
      continue;
    }
    image.setAttribute("src", source);
    image.setAttribute("loading", "lazy");
    if (!image.hasAttribute("alt")) image.setAttribute("alt", "");
  }
  return document.body.innerHTML;
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

function normalizePost(
  post: WordPressPostResponse,
  sanitizeContent: (value: string) => string,
): BlogPost {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const categories = (post._embedded?.["wp:term"] ?? [])
    .flat()
    .filter((term) => term.taxonomy === "category" && term.name && term.slug)
    .map((term) => ({ name: term.name ?? "", slug: term.slug ?? "" }));

  return {
    id: post.id,
    slug: post.slug,
    title: htmlToPlainText(post.title.rendered),
    excerpt: htmlToPlainText(post.excerpt.rendered),
    contentHtml: sanitizeContent(post.content.rendered),
    date: post.date,
    modified: post.modified,
    featuredImageUrl: safeHttpsUrl(media?.source_url),
    featuredImageAlt: htmlToPlainText(media?.alt_text ?? ""),
    categories,
  };
}

async function fetchWordPress<T>(path: string, query: Readonly<Record<string, string>>): Promise<T> {
  const url = new URL(`${WORDPRESS_API_BASE}/${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  let lastError: unknown = new Error("WordPress request failed.");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`WordPress returned ${response.status}.`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function visiblePosts(
  posts: readonly WordPressPostResponse[],
  sanitizeContent: (value: string) => string,
): BlogPost[] {
  return posts
    .filter((post) => !HIDDEN_POST_SLUGS.has(post.slug))
    .map((post) => normalizePost(post, sanitizeContent));
}

const postFields = "id,slug,date,modified,title,excerpt,content,_embedded";

export async function getBlogPosts(
  limit = 24,
  sanitizeContent: (value: string) => string = sanitizeWordPressHtml,
): Promise<BlogPost[]> {
  const posts = await fetchWordPress<WordPressPostResponse[]>("posts", {
    _embed: "wp:featuredmedia,wp:term",
    _fields: postFields,
    order: "desc",
    orderby: "date",
    per_page: String(Math.min(Math.max(limit, 1), 100)),
    status: "publish",
  });
  return visiblePosts(posts, sanitizeContent);
}

export async function getBlogPostBySlug(
  slug: string,
  sanitizeContent: (value: string) => string = sanitizeWordPressHtml,
): Promise<BlogPost | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) || HIDDEN_POST_SLUGS.has(slug)) {
    return null;
  }

  const posts = await fetchWordPress<WordPressPostResponse[]>("posts", {
    _embed: "wp:featuredmedia,wp:term",
    _fields: postFields,
    slug,
    status: "publish",
  });
  return visiblePosts(posts, sanitizeContent)[0] ?? null;
}

export function blogPostDescription(post: BlogPost): string {
  const source = post.excerpt || htmlToPlainText(post.contentHtml);
  return source.length <= 160 ? source : `${source.slice(0, 157).trimEnd()}…`;
}

export function formatBlogDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.split("T")[0] ?? value;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
