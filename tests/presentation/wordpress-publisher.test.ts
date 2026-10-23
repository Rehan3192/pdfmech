import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pluginSource = readFileSync(
  join(
    process.cwd(),
    "wordpress-plugin",
    "pdfmech-vercel-publisher",
    "pdfmech-vercel-publisher.php",
  ),
  "utf8",
);

describe("WordPress publishing trigger", () => {
  it("keeps the Vercel hook server-side and limits deployments to published posts", () => {
    expect(pluginSource).toContain("PDFMECH_VERCEL_DEPLOY_HOOK_URL");
    expect(pluginSource).toContain("!($post instanceof WP_Post)");
    expect(pluginSource).toContain("$post->post_type !== 'post'");
    expect(pluginSource).toContain("$post->post_status !== 'publish'");
    expect(pluginSource).toContain("wp_is_post_revision($post_id)");
    expect(pluginSource).toContain("wp_is_post_autosave($post_id)");
    expect(pluginSource).toContain("$host !== 'api.vercel.com'");
    expect(pluginSource).toContain("wp_remote_post");
    expect(pluginSource).toContain("PDFMECH_VERCEL_PUBLISH_LOCK");
    expect(pluginSource).toContain("transition_post_status");
    expect(pluginSource).toContain("$old_status !== 'publish'");
    expect(pluginSource).toContain("add_action('shutdown'");
    expect(pluginSource).not.toContain("wp_schedule_single_event");
    expect(pluginSource).not.toMatch(/https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_-]{8,}/);
  });
});
