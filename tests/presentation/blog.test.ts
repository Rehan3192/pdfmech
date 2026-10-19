import { describe, expect, it } from "vitest";
import {
  blogPostDescription,
  htmlToPlainText,
  rewriteWordPressHref,
  type BlogPost,
} from "../../src/blog";
import { normalizeBlogArticleHtml } from "../../src/blog-content";

describe("WordPress blog content", () => {
  it("rewrites public WordPress post links to the PDFMech blog", () => {
    expect(rewriteWordPressHref("https://cms.pdfmech.com/private-pdf-guide/")).toBe(
      "/blog/private-pdf-guide",
    );
    expect(rewriteWordPressHref("https://example.com/guide")).toBe(
      "https://example.com/guide",
    );
  });

  it("normalizes rendered text and creates a bounded description", () => {
    expect(htmlToPlainText("PDF &amp; OCR&nbsp;guide")).toBe("PDF & OCR guide");

    const post: BlogPost = {
      id: 1,
      slug: "sample-guide",
      title: "Sample guide",
      excerpt: "A".repeat(200),
      contentHtml: "<p>Body</p>",
      date: "2026-09-28T00:00:00",
      modified: "2026-09-28T00:00:00",
      featuredImageUrl: null,
      featuredImageAlt: "",
      categories: [],
    };

    expect(blogPostDescription(post)).toHaveLength(158);
    expect(blogPostDescription(post)).toMatch(/…$/);
  });

  it("repairs WordPress heading structure and generates a stable table of contents", () => {
    const html = normalizeBlogArticleHtml(
      '<h1>First Section</h1><p>Intro</p><h4>Skipped Level</h4><h5>Deep Topic</h5><h2>First Section</h2>',
    ).html;

    expect(html).not.toMatch(/<h1\b/i);
    expect(html).toContain('<h2 id="first-section">First Section</h2>');
    expect(html).toContain('<h3 id="skipped-level">Skipped Level</h3>');
    expect(html).toContain('<h4 id="deep-topic">Deep Topic</h4>');
    expect(html).toContain('<h2 id="first-section-2">First Section</h2>');
    expect(html).toContain('aria-label="Table of contents"');
    expect(html).toContain('href="#skipped-level"');
  });
});
