# PDFMech Vercel Publisher

This small WordPress plugin starts a PDFMech production deployment after a
published post is created, updated, unpublished, or trashed. The deployment
regenerates `/blog` and `/sitemap.xml` from the current WordPress inventory and
runs PDFMech's existing SEO verification before Vercel can publish the result.

It does not send article content to Vercel. It sends only a POST request to the
secret Vercel deploy-hook URL; the URL's unique identifier is the credential.

## Configure Vercel

1. Open the PDFMech project in Vercel.
2. Go to **Settings → Git → Deploy Hooks**.
3. Create a hook named `WordPress publish` for the production branch (`main`).
4. Copy the generated deploy-hook URL. Treat it as a secret.

## Configure WordPress

Add this line to `wp-config.php` above the `stop editing` comment:

```php
define('PDFMECH_VERCEL_DEPLOY_HOOK_URL', 'https://api.vercel.com/v1/integrations/deploy/REPLACE_WITH_THE_REAL_HOOK');
```

Do not put the real hook URL in Git, a WordPress post, browser JavaScript, or a
public settings screen.

Upload the `pdfmech-vercel-publisher` directory to
`wp-content/plugins/`, then activate **PDFMech Vercel Publisher** in WordPress.
The plugin sends the deploy request when the WordPress save request finishes
and uses a short lock to collapse duplicate save events into one deployment.

## Verify the workflow

1. Publish or update a non-sensitive test article.
2. Confirm that Vercel starts one production deployment for the `main` branch.
3. Wait for the deployment to pass its production build and SEO verifier.
4. Confirm that the canonical article URL returns HTTP 200 with the complete
   article in its initial HTML.
5. Confirm that the article is linked from `https://www.pdfmech.com/blog`.
6. Confirm that it appears once in `https://www.pdfmech.com/sitemap.xml` with
   the WordPress modification date.

If the WordPress API is unavailable, the PDFMech build now fails instead of
publishing an empty blog archive or incomplete sitemap. Vercel keeps the prior
successful production deployment active.

If the deploy-hook URL is ever exposed, delete it in Vercel, create a new hook,
and update the constant in `wp-config.php`.
