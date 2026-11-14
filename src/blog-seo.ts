const ARTICLE_TITLE_OVERRIDES: Readonly<Record<string, string>> = {
  "how-to-make-a-scanned-pdf-searchable": "Make a Scanned PDF Searchable | PDFMech",
  "how-to-split-a-pdf-and-rename-each-file": "Split and Rename PDF Files in Bulk | PDFMech",
  "why-cant-i-type-on-a-pdf-how-to-fix-it-for-free": "Can't Type on a PDF? Fix It Free | PDFMech",
};

function trimAtWordBoundary(value: string, maximumLength: number): string {
  if (value.length <= maximumLength) return value;
  const candidate = value.slice(0, maximumLength + 1);
  const boundary = candidate.lastIndexOf(" ");
  return (boundary >= Math.floor(maximumLength * 0.65)
    ? candidate.slice(0, boundary)
    : value.slice(0, maximumLength)).trimEnd();
}

export function blogArticleDocumentTitle(slug: string, articleTitle: string): string {
  const override = ARTICLE_TITLE_OVERRIDES[slug];
  if (override !== undefined) return override;
  const suffix = " | PDFMech";
  const complete = `${articleTitle}${suffix}`;
  if (complete.length <= 60) return complete;
  return `${trimAtWordBoundary(articleTitle, 47)}...${suffix}`;
}

export function blogMetaDescription(source: string): string {
  const normalized = source.replaceAll(/\s+/g, " ").trim();
  if (normalized.length <= 150) return normalized;
  return `${trimAtWordBoundary(normalized, 149)}…`;
}
