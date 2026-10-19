import sanitizeHtml from "sanitize-html";
import { rewriteWordPressHref } from "../src/blog.ts";
import { normalizeBlogArticleHtml } from "../src/blog-content.ts";

export function sanitizeBlogHtmlForBuild(value) {
  const sanitized = sanitizeHtml(value, {
    allowedTags: [
      "a", "blockquote", "br", "caption", "code", "col", "colgroup", "del",
      "div", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
      "img", "li", "nav", "ol", "p", "pre", "s", "span", "strong", "sub", "sup",
      "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
    ],
    allowedAttributes: {
      "*": ["class", "id", "aria-label", "data-pdfmech-toc"],
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
        const isExternal = /^https?:\/\//i.test(href) && !href.startsWith("https://www.pdfmech.com");
        return {
          tagName: "a",
          attribs: {
            ...attributes,
            href,
            ...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {}),
          },
        };
      },
      img: (_tagName, attributes) => ({
        tagName: "img",
        attribs: { ...attributes, loading: "lazy", alt: attributes.alt ?? "" },
      }),
    },
  });
  return normalizeBlogArticleHtml(sanitized).html;
}
