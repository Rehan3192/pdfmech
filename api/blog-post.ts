import { renderDynamicBlogRoute } from "../src/server/dynamic-blog-route";

export function GET(request: Request): Promise<Response> {
  return renderDynamicBlogRoute(request);
}
