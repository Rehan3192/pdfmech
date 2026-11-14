import type { BlogPost } from "./blog.ts";

// Last-known published inventory used only when WordPress is unavailable during
// a production build. Live archive and sitemap routes still refresh from the CMS.
export const BUILD_BLOG_FALLBACK: readonly BlogPost[] = [
  {
    id: 23,
    slug: "why-cant-i-type-on-a-pdf-how-to-fix-it-for-free",
    title: "Why Can’t I Type on a PDF? How to Fix It for Free",
    excerpt: "Learn why PDF forms stop working and how to add text to non-fillable, scanned, or protected PDFs with browser-based tools.",
    contentHtml: "",
    date: "2026-11-05T09:51:20",
    modified: "2026-11-05T09:51:22",
    featuredImageUrl: null,
    featuredImageAlt: "",
    categories: [{ name: "PDF guide", slug: "pdf-guide" }],
  },
  {
    id: 22,
    slug: "how-to-split-a-pdf-and-rename-each-file",
    title: "How to Split a PDF and Rename Each File Automatically Free",
    excerpt: "Learn how to split a PDF into separate files and rename each one using CSV or TXT while reviewing page ranges and preventing naming mistakes.",
    contentHtml: "",
    date: "2026-10-19T00:00:00",
    modified: "2026-10-19T00:00:00",
    featuredImageUrl: null,
    featuredImageAlt: "",
    categories: [{ name: "PDF guide", slug: "pdf-guide" }],
  },
  {
    id: 21,
    slug: "how-to-make-a-scanned-pdf-searchable",
    title: "How to Make a Scanned PDF Searchable Without Uploading It",
    excerpt: "Learn how to make a scanned PDF searchable with private browser-based OCR so you can search, select, copy, and extract text.",
    contentHtml: "",
    date: "2026-09-29T00:00:00",
    modified: "2026-09-29T00:00:00",
    featuredImageUrl: null,
    featuredImageAlt: "",
    categories: [{ name: "PDF guide", slug: "pdf-guide" }],
  },
];
