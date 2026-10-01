import { renderDynamicBlogRoute } from "../src/server/dynamic-blog-route.js";

export function GET(request: Request): Promise<Response> {
  return renderDynamicBlogRoute(request);
}
