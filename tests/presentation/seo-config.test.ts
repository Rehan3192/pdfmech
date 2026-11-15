import { describe, expect, it } from "vitest";
import {
  buildStructuredData,
  canonicalUrl,
  SEO_PAGE_KEYS,
  SEO_PAGES,
  TOOL_ROUTE_FAQS,
  TOOL_SEO_PAGE_KEYS,
} from "../../src/seo-config";

describe("SEO configuration", () => {
  it("gives every indexable route unique metadata and an absolute canonical URL", () => {
    const titles = SEO_PAGE_KEYS.map((page) => SEO_PAGES[page].title);
    const descriptions = SEO_PAGE_KEYS.map((page) => SEO_PAGES[page].description);

    expect(new Set(titles).size).toBe(SEO_PAGE_KEYS.length);
    expect(new Set(descriptions).size).toBe(SEO_PAGE_KEYS.length);
    for (const page of SEO_PAGE_KEYS) {
      expect(SEO_PAGES[page].title.length).toBeLessThanOrEqual(60);
      expect(SEO_PAGES[page].description.length).toBeGreaterThanOrEqual(100);
      expect(SEO_PAGES[page].description.length).toBeLessThanOrEqual(155);
      expect(canonicalUrl(page)).toMatch(/^https:\/\/www\.pdfmech\.com\//);
    }
  });

  it("includes suitable structured data without unsupported app rich-result claims", () => {
    const home = JSON.stringify(buildStructuredData("home"));
    const faq = JSON.stringify(buildStructuredData("faq"));

    expect(home).toContain("Organization");
    expect(home).toContain("WebSite");
    expect(home).toContain("WebPage");
    expect(home).not.toContain("WebApplication");
    expect(home).not.toContain("aggregateRating");
    expect(home).not.toContain("review");
    expect(faq).toContain("FAQPage");
    expect(faq).toContain("BreadcrumbList");
  });

  it("uses self-referencing WebPage metadata for every focused route", () => {
    for (const page of TOOL_SEO_PAGE_KEYS) {
      const config = SEO_PAGES[page];
      const structuredData = JSON.stringify(buildStructuredData(page));

      expect(structuredData).toContain(canonicalUrl(page));
      expect(structuredData).toContain(config.description);
      expect(structuredData).toContain('"@type":"WebPage"');
      expect(structuredData).not.toContain("WebApplication");
      expect(structuredData).not.toContain("aggregateRating");
    }
  });

  it("publishes FAQ schema that matches every focused tool route", () => {
    for (const page of SEO_PAGE_KEYS.filter(
      (candidate) => TOOL_ROUTE_FAQS[candidate] !== undefined,
    )) {
      const structuredData = JSON.stringify(buildStructuredData(page));

      expect(structuredData).toContain('"@type":"FAQPage"');
      expect(structuredData).toContain(`${canonicalUrl(page)}#faq`);
      for (const item of TOOL_ROUTE_FAQS[page] ?? []) {
        expect(structuredData).toContain(item.question);
        expect(structuredData).toContain(item.answer);
      }
    }
  });

  it("publishes Article schema for the first-hand iPhone guide", () => {
    const config = SEO_PAGES.editPdfOnIphone;
    const structuredData = JSON.stringify(buildStructuredData("editPdfOnIphone"));

    expect(config.path).toBe("/edit-pdf-on-iphone");
    expect(structuredData).toContain('"@type":"Article"');
    expect(structuredData).toContain(config.h1);
    expect(structuredData).toContain('"dateModified":"2026-09-27"');
    expect(structuredData).toContain('"image":"https://www.pdfmech.com/PDFMechLogo.png"');
  });

  it("describes the Tools page as the hub for every focused PDF tool", () => {
    const structuredData = JSON.stringify(buildStructuredData("tools"));

    expect(structuredData).toContain('"@type":"ItemList"');
    expect(structuredData).toContain(
      `"numberOfItems":${TOOL_SEO_PAGE_KEYS.length}`,
    );
    for (const page of TOOL_SEO_PAGE_KEYS) {
      expect(structuredData).toContain(canonicalUrl(page));
    }
  });

  it("publishes dedicated PNG conversion routes", () => {
    expect(SEO_PAGES.pdfToPng.path).toBe("/pdf-to-png");
    expect(SEO_PAGES.pngToPdf.path).toBe("/png-to-pdf");
    expect(TOOL_SEO_PAGE_KEYS).toContain("pdfToPng");
    expect(TOOL_SEO_PAGE_KEYS).toContain("pngToPdf");
  });

  it("publishes dedicated Word conversion routes", () => {
    expect(SEO_PAGES.pdfToWord.path).toBe("/pdf-to-word");
    expect(SEO_PAGES.wordToPdf.path).toBe("/word-to-pdf");
    expect(TOOL_SEO_PAGE_KEYS).toContain("pdfToWord");
    expect(TOOL_SEO_PAGE_KEYS).toContain("wordToPdf");
  });

  it("publishes dedicated CSV conversion routes", () => {
    expect(SEO_PAGES.csvToPdf.path).toBe("/csv-to-pdf");
    expect(SEO_PAGES.pdfToCsv.path).toBe("/pdf-to-csv");
    expect(TOOL_SEO_PAGE_KEYS).toContain("csvToPdf");
    expect(TOOL_SEO_PAGE_KEYS).toContain("pdfToCsv");
  });
});
