export interface BlogContentHeading {
  readonly id: string;
  readonly level: 2 | 3 | 4;
  readonly text: string;
}

export interface NormalizedBlogContent {
  readonly html: string;
  readonly headings: readonly BlogContentHeading[];
}

const GENERATED_TOC_PATTERN = /<nav\b[^>]*\bdata-pdfmech-toc(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>[\s\S]*?<\/nav>/gi;
const HEADING_PATTERN = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;

/**
 * Repairs article structure after untrusted WordPress HTML has been sanitized.
 * It changes only the rendered copy; the source post in WordPress is untouched.
 */
export function normalizeBlogArticleHtml(value: string): NormalizedBlogContent {
  const headings: BlogContentHeading[] = [];
  const usedIds = new Set<string>();
  let previousLevel: 2 | 3 | 4 = 2;
  const contentWithoutGeneratedToc = value.replace(GENERATED_TOC_PATTERN, "");

  const normalizedContent = contentWithoutGeneratedToc.replace(
    HEADING_PATTERN,
    (_match, rawLevel: string, rawAttributes: string, innerHtml: string) => {
      const sourceLevel = Number(rawLevel);
      const requestedLevel = Math.min(4, Math.max(2, sourceLevel)) as 2 | 3 | 4;
      const level = headings.length === 0
        ? 2
        : Math.min(requestedLevel, previousLevel + 1) as 2 | 3 | 4;
      previousLevel = level;

      const text = headingText(innerHtml) || `Section ${headings.length + 1}`;
      const id = uniqueHeadingId(text, usedIds, headings.length + 1);
      headings.push({ id, level, text });

      const attributes = rawAttributes.replace(/\s+id\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      return `<h${level}${attributes} id="${id}">${innerHtml}</h${level}>`;
    },
  );

  if (headings.length === 0) return { html: normalizedContent, headings };

  const links = headings
    .map((heading) => `<li class="blog-toc-level-${heading.level}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`)
    .join("");
  const toc = `<nav class="blog-table-of-contents" data-pdfmech-toc="true" aria-label="Table of contents"><strong>On this page</strong><ol>${links}</ol></nav>`;
  return { html: `${toc}${normalizedContent}`, headings };
}

function uniqueHeadingId(text: string, usedIds: Set<string>, position: number): string {
  const normalized = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || `section-${position}`;
  let candidate = normalized;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${normalized}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function headingText(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, key: string) => {
    if (!key.startsWith("#")) return named[key.toLocaleLowerCase("en")] ?? entity;
    const hexadecimal = key[1]?.toLocaleLowerCase("en") === "x";
    const codePoint = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
