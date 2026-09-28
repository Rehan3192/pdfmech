import { describe, expect, it } from "vitest";
import {
  blogPostDescription,
  htmlToPlainText,
  rewriteWordPressHref,
  type BlogPost,
} from "../../src/blog";

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
});
