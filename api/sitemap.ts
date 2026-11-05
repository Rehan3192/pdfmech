import { renderDynamicSitemap } from "../src/server/dynamic-blog-discovery.js";

export function GET(request: Request): Promise<Response> {
  return renderDynamicSitemap(request);
}
