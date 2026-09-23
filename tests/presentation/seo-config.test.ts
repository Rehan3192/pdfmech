import { describe, expect, it } from "vitest";
import {
  buildStructuredData,
  canonicalUrl,
  SEO_PAGE_KEYS,
  SEO_PAGES,
} from "../../src/seo-config";

describe("SEO configuration", () => {
  it("gives every indexable route unique metadata and an absolute canonical URL", () => {
    const titles = SEO_PAGE_KEYS.map((page) => SEO_PAGES[page].title);
    const descriptions = SEO_PAGE_KEYS.map((page) => SEO_PAGES[page].description);

    expect(new Set(titles).size).toBe(SEO_PAGE_KEYS.length);
    expect(new Set(descriptions).size).toBe(SEO_PAGE_KEYS.length);
    for (const page of SEO_PAGE_KEYS) {
      expect(SEO_PAGES[page].title.length).toBeLessThanOrEqual(65);
      expect(SEO_PAGES[page].description.length).toBeGreaterThanOrEqual(100);
      expect(canonicalUrl(page)).toMatch(/^https:\/\/www\.pdfmech\.com\//);
    }
  });

  it("includes suitable structured data for product and FAQ routes", () => {
    const home = JSON.stringify(buildStructuredData("home"));
    const faq = JSON.stringify(buildStructuredData("faq"));

    expect(home).toContain("WebApplication");
    expect(home).toContain("Organization");
    expect(faq).toContain("FAQPage");
    expect(faq).toContain("BreadcrumbList");
  });

  it("uses self-referencing metadata and honest product schema for add text", () => {
    const config = SEO_PAGES.addTextToPdf;
    const structuredData = JSON.stringify(buildStructuredData("addTextToPdf"));

    expect(config.path).toBe("/add-text-to-pdf");
    expect(canonicalUrl("addTextToPdf")).toBe(
      "https://www.pdfmech.com/add-text-to-pdf",
    );
    expect(structuredData).toContain(canonicalUrl("addTextToPdf"));
    expect(structuredData).toContain(config.description);
    expect(structuredData).toContain('"price":"0"');
    expect(structuredData).not.toContain("aggregateRating");
    expect(structuredData).not.toContain("review");
  });

  it("uses self-referencing metadata and product schema for deleting pages", () => {
    const config = SEO_PAGES.deletePdfPages;
    const structuredData = JSON.stringify(buildStructuredData("deletePdfPages"));

    expect(config.path).toBe("/delete-pdf-pages");
    expect(canonicalUrl("deletePdfPages")).toBe(
      "https://www.pdfmech.com/delete-pdf-pages",
    );
    expect(structuredData).toContain(canonicalUrl("deletePdfPages"));
    expect(structuredData).toContain('"price":"0"');
    expect(structuredData).not.toContain("aggregateRating");
  });

  it("uses self-referencing metadata and product schema for reordering pages", () => {
    const config = SEO_PAGES.reorderPdfPages;
    const structuredData = JSON.stringify(buildStructuredData("reorderPdfPages"));

    expect(config.path).toBe("/reorder-pdf-pages");
    expect(canonicalUrl("reorderPdfPages")).toBe(
      "https://www.pdfmech.com/reorder-pdf-pages",
    );
    expect(structuredData).toContain(canonicalUrl("reorderPdfPages"));
    expect(structuredData).toContain('"price":"0"');
    expect(structuredData).not.toContain("aggregateRating");
  });
});
