import { describe, expect, it } from "vitest";
import {
  renderDynamicBlogArchive,
  renderDynamicSitemap,
} from "../../src/server/dynamic-blog-discovery";

const fallbackTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="https://www.pdfmech.com/blog" />
    <script id="route-structured-data" type="application/ld+json">{}</script>
    <script id="blog-posts-data" type="application/json">[]</script>
    <script type="module" src="/assets/index.js"></script>
    <title>PDFMech Blog</title>
  </head>
  <body>
    <div id="app"><main><h1>Build fallback archive</h1><a href="/blog/older-guide">Older guide</a></main></div>
  </body>
</html>`;

const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.pdfmech.com/</loc>
    <lastmod>2026-09-25</lastmod>
  </url>
  <url>
    <loc>https://www.pdfmech.com/blog</loc>
    <lastmod>2026-09-28</lastmod>
  </url>
  <url>
    <loc>https://www.pdfmech.com/blog/older-guide</loc>
    <lastmod>2026-09-29</lastmod>
  </url>
</urlset>`;

const latestPost = {
  id: 23,
  slug: "why-cant-i-type-on-a-pdf-how-to-fix-it-for-free",
  date: "2026-11-05T09:51:20",
  modified: "2026-11-05T09:51:22",
  title: { rendered: "Why Can&#8217;t I Type on a PDF?" },
  excerpt: { rendered: "Learn why PDF forms stop working." },
  _embedded: {
    "wp:term": [[{ taxonomy: "category", name: "PDF guide", slug: "pdf-guide" }]],
  },
};

function createFetcher({
  posts = [latestPost],
  wordpressStatus = 200,
}: {
  posts?: readonly unknown[];
  wordpressStatus?: number;
} = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://cms.pdfmech.com/wp-json/wp/v2/posts")) {
      return new Response(
        wordpressStatus === 200 ? JSON.stringify(posts) : "Unavailable",
        {
          status: wordpressStatus,
          headers: {
            "Content-Type": "application/json",
            "X-WP-TotalPages": "1",
          },
        },
      );
    }
    if (url === "https://www.pdfmech.com/_internal/blog") {
      return new Response(fallbackTemplate, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }
    if (url === "https://www.pdfmech.com/_internal/sitemap.xml") {
      return new Response(fallbackSitemap, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    }
    return new Response("Not found", { status: 404 });
  }) as typeof fetch;
}

describe("dynamic blog discovery routes", () => {
  it("renders the current WordPress inventory into crawlable archive HTML", async () => {
    const response = await renderDynamicBlogArchive(
      new Request("https://www.pdfmech.com/api/blog-archive"),
      createFetcher(),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-PDFMech-Content-Source")).toBe("wordpress");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain("s-maxage=300");
    expect(html).toContain("/blog/why-cant-i-type-on-a-pdf-how-to-fix-it-for-free");
    expect(html).toContain("Why Can’t I Type on a PDF?");
    expect(html).toContain('id="blog-posts-data"');
    expect(html).toContain('"slug":"why-cant-i-type-on-a-pdf-how-to-fix-it-for-free"');
    expect(html).not.toContain("Build fallback archive");
  });

  it("keeps the build-generated archive when WordPress is unavailable", async () => {
    const response = await renderDynamicBlogArchive(
      new Request("https://www.pdfmech.com/api/blog-archive"),
      createFetcher({ wordpressStatus: 503 }),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-PDFMech-Content-Source")).toBe("static-fallback");
    expect(html).toContain("Build fallback archive");
    expect(html).toContain("/blog/older-guide");
  });

  it("replaces stale article entries and refreshes the blog date in the sitemap", async () => {
    const response = await renderDynamicSitemap(
      new Request("https://www.pdfmech.com/api/sitemap"),
      createFetcher(),
    );
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");
    expect(response.headers.get("X-PDFMech-Content-Source")).toBe("wordpress");
    expect(xml).toContain(
      "<loc>https://www.pdfmech.com/blog/why-cant-i-type-on-a-pdf-how-to-fix-it-for-free</loc>",
    );
    expect(xml).toContain(
      "<loc>https://www.pdfmech.com/blog</loc>\n    <lastmod>2026-11-05</lastmod>",
    );
    expect(xml).not.toContain("/blog/older-guide");
  });

  it("keeps the build-generated sitemap when WordPress is unavailable", async () => {
    const response = await renderDynamicSitemap(
      new Request("https://www.pdfmech.com/api/sitemap"),
      createFetcher({ wordpressStatus: 503 }),
    );
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-PDFMech-Content-Source")).toBe("static-fallback");
    expect(xml).toBe(fallbackSitemap);
  });

  it("rejects an empty WordPress inventory instead of publishing an empty archive", async () => {
    const response = await renderDynamicBlogArchive(
      new Request("https://www.pdfmech.com/api/blog-archive"),
      createFetcher({ posts: [] }),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-PDFMech-Content-Source")).toBe("static-fallback");
    expect(html).toContain("/blog/older-guide");
  });
});
