const WORDPRESS_ORIGIN = "https://cms.pdfmech.com";
const PUBLIC_ORIGIN = "https://www.pdfmech.com";

function removeInternalTrackingParameters(url: URL): void {
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key)) url.searchParams.delete(key);
  }
}

export function rewritePublishedWordPressHref(href: string): string {
  try {
    const url = new URL(href, WORDPRESS_ORIGIN);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) return "#";

    if (url.origin === PUBLIC_ORIGIN) {
      removeInternalTrackingParameters(url);
      return `${url.pathname}${url.search}${url.hash}`;
    }

    if (url.origin === WORDPRESS_ORIGIN) {
      removeInternalTrackingParameters(url);
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length === 1 && segments[0] !== undefined) {
        return `/blog/${segments[0]}${url.hash}`;
      }
    }

    return href.startsWith("//") ? url.toString() : href;
  } catch {
    return "#";
  }
}
