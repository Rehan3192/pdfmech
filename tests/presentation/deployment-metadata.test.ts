import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("deployment metadata", () => {
  it("describes the production app with share-safe metadata and public assets", async () => {
    const indexHtml = await readFile(join(process.cwd(), "index.html"), "utf8");
    const manifest = JSON.parse(
      await readFile(
        join(process.cwd(), "public", "manifest.webmanifest"),
        "utf8",
      ),
    ) as {
      readonly name?: string;
      readonly short_name?: string;
      readonly theme_color?: string;
      readonly icons?: readonly { readonly src?: string; readonly type?: string }[];
    };
    const brandLogo = await readFile(
      join(process.cwd(), "public", "PDFMechLogo-small.webp"),
    );
    const icon192 = await readFile(join(process.cwd(), "public", "icon-192.webp"));
    const icon512 = await readFile(join(process.cwd(), "public", "icon-512.webp"));
    const robots = await readFile(
      join(process.cwd(), "public", "robots.txt"),
      "utf8",
    );

    expect(indexHtml).toContain(
      "<title>Free PDF Editor Online – Private &amp; No Upload | PDFMech</title>",
    );
    expect(indexHtml).toContain('name="description"');
    expect(indexHtml).toContain("no upload or account");
    expect(indexHtml).toContain('property="og:title"');
    expect(indexHtml).toContain('name="twitter:card"');
    expect(indexHtml).toContain('property="og:image"');
    expect(indexHtml).toContain('name="twitter:image"');
    expect(indexHtml).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(indexHtml).toContain('rel="icon" href="/PDFMechLogo-small.webp"');
    expect(indexHtml).toContain('id="route-structured-data"');

    expect(manifest).toMatchObject({
      name: "PDFMech",
      short_name: "PDFMech",
      theme_color: "#244b42",
    });
    expect(manifest.icons?.[0]).toMatchObject({
      src: "/icon-192.webp",
      type: "image/webp",
    });
    expect(manifest.icons?.[1]).toMatchObject({
      src: "/icon-512.webp",
      type: "image/webp",
    });
    expect(brandLogo.length).toBeGreaterThan(100);
    expect(icon192.length).toBeGreaterThan(100);
    expect(icon512.length).toBeGreaterThan(100);
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("https://www.pdfmech.com/sitemap.xml");
  });
});
