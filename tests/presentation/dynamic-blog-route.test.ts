import { describe, expect, it } from "vitest";
import { renderDynamicBlogRoute } from "../../src/server/dynamic-blog-route";

const template = `<!doctype html>
<html lang="en">
  <head>
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="https://www.pdfmech.com/blog" />
    <meta name="description" content="Blog archive" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://www.pdfmech.com/blog" />
    <meta property="og:title" content="PDFMech Blog" />
    <meta property="og:description" content="Blog archive" />
    <meta property="og:image" content="https://www.pdfmech.com/PDFMechLogo.png" />
    <meta name="twitter:title" content="PDFMech Blog" />
    <meta name="twitter:description" content="Blog archive" />
    <meta name="twitter:image" content="https://www.pdfmech.com/PDFMechLogo.png" />
    <script id="route-structured-data" type="application/ld+json">{}</script>
    <title>PDFMech Blog</title>
  </head>
  <body>
    <div id="app"><main><h1>Stale archive</h1></main></div>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>`;

const post = {
  id: 10,
  slug: "how-to-make-a-scanned-pdf-searchable",
  date: "2026-09-29T19:51:07",
  modified: "2026-09-30T10:00:00",
  title: { rendered: "How to Make a Scanned PDF Searchable" },
  excerpt: { rendered: "Make a scanned PDF searchable without uploading it." },
  content: {
    rendered:
      '<h2>Use browser OCR</h2><p>Private processing.</p><script>alert("x")</script>',
  },
  _embedded: {
    "wp:featuredmedia": [
      {
        source_url: "https://cms.pdfmech.com/wp-content/uploads/ocr.webp",
        alt_text: "OCR workflow",
      },
    ],
    "wp:term": [[{ taxonomy: "category", name: "OCR guides", slug: "ocr-guides" }]],
  },
};

function createFetcher(posts: readonly unknown[]): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("cms.pdfmech.com/wp-json/")) {
      return new Response(JSON.stringify(posts), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "https://www.pdfmech.com/blog") {
      return new Response(template, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }
    return new Response("Not found", { status: 404 });
  }) as typeof fetch;
}

describe("dynamic WordPress blog route", () => {
  it("returns a crawlable server-rendered article without a fallback flash", async () => {
    const response = await renderDynamicBlogRoute(
      new Request(
        "https://www.pdfmech.com/api/blog-post?slug=how-to-make-a-scanned-pdf-searchable",
      ),
      createFetcher([post]),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(
      '<meta name="robots" content="index,follow,max-image-preview:large" />',
    );
    expect(html).toContain(
      '<link rel="canonical" href="https://www.pdfmech.com/blog/how-to-make-a-scanned-pdf-searchable" />',
    );
    expect(html).toContain("<h1>How to Make a Scanned PDF Searchable</h1>");
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain('id="blog-post-data"');
    expect(html).not.toContain("Stale archive");
    expect(html).not.toContain("alert(&quot;x&quot;)");
  });

  it("returns a genuine noindex 404 when WordPress has no published post", async () => {
    const response = await renderDynamicBlogRoute(
      new Request("https://www.pdfmech.com/api/blog-post?slug=missing-guide"),
      createFetcher([]),
    );
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(html).toContain('<meta name="robots" content="noindex,follow" />');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain("This PDFMech guide is unavailable.");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe("no-store");
  });

  it("returns a retryable 503 instead of a false 404 when WordPress fails", async () => {
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("cms.pdfmech.com/wp-json/")) {
        return new Response("Unavailable", { status: 503 });
      }
      return new Response(template, { status: 200 });
    }) as typeof fetch;
    const response = await renderDynamicBlogRoute(
      new Request("https://www.pdfmech.com/api/blog-post?slug=published-guide"),
      fetcher,
    );
    const html = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(html).toContain('<meta name="robots" content="noindex,follow" />');
    expect(html).toContain("This guide is temporarily unavailable.");
  });
});
