# PDFMech WordPress blog setup

PDFMech reads published posts from the native WordPress REST API at
`https://cms.pdfmech.com/wp-json/wp/v2`. WPGraphQL is not required.

## WordPress configuration

- Keep **Discourage search engines from indexing this site** enabled on the CMS.
- Keep public user registration and comments disabled.
- Delete the default **Hello world!** post, its comment, and the **Uncategorized** category when it is no longer needed. The frontend also excludes the `hello-world` slug as a safety measure.
- Use a descriptive title, excerpt, category, and featured image for every article.
- Use lowercase, readable post slugs. Do not change a slug after the article is indexed unless a redirect is also added.
- Add internal links to the relevant PDFMech tool using the public `https://www.pdfmech.com/...` URL, not the CMS URL.

No WordPress plugin is required for the current integration. ACF should only be
added later if an article needs structured fields that the standard editor,
categories, excerpt, and featured image cannot provide.

## Publishing and deployment

The live archive fetches newly published posts from WordPress. A production
deployment is still required to generate crawlable article HTML, Article schema,
and article entries in `sitemap.xml`.

After the Vercel project is connected, create a Vercel deploy hook and either:

1. trigger it manually after publishing or updating an article; or
2. install one narrowly scoped webhook plugin in WordPress and call that deploy
   hook only on post publish/update events.

Do not place WordPress administrator credentials or the deploy-hook URL in the
frontend repository.

## Article template supplied by PDFMech

The frontend owns the article presentation. It supplies consistent styling for:

- headings and paragraphs;
- ordered and unordered lists;
- links and blockquotes;
- images, captions, and featured images;
- tables with mobile horizontal scrolling;
- inline code and code blocks.

WordPress HTML is sanitized before rendering. Scripts, event handlers, inline
styles, unsafe URLs, and unsupported markup are removed.
