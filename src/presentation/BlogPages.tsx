import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import {
  blogPostDescription,
  formatBlogDate,
  getBlogPostBySlug,
  getBlogPosts,
  type BlogPost,
} from "../blog";

interface BlogLinkProps {
  readonly path: string;
  readonly onNavigate: (path: string) => void;
  readonly children: ReactNode;
  readonly className?: string;
}

function BlogLink({ path, onNavigate, children, className }: BlogLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onNavigate(path);
  }

  return (
    <a href={path} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}

function categoryLabel(post: BlogPost): string {
  return post.categories.find((category) => category.slug !== "uncategorized")?.name ?? "PDF guide";
}

function BlogCard({
  post,
  onNavigate,
}: {
  readonly post: BlogPost;
  readonly onNavigate: (path: string) => void;
}) {
  const path = `/blog/${post.slug}`;
  return (
    <article className="blog-card">
      {post.featuredImageUrl !== null ? (
        <BlogLink path={path} onNavigate={onNavigate} className="blog-card-image-link">
          <img
            src={post.featuredImageUrl}
            alt={post.featuredImageAlt}
            width="720"
            height="405"
            loading="lazy"
          />
        </BlogLink>
      ) : (
        <div className="blog-card-placeholder" aria-hidden="true">
          <span>PDF</span>
        </div>
      )}
      <div className="blog-card-body">
        <div className="blog-card-meta">
          <span>{categoryLabel(post)}</span>
          <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
        </div>
        <h2>
          <BlogLink path={path} onNavigate={onNavigate}>{post.title}</BlogLink>
        </h2>
        <p>{post.excerpt || "Read this practical PDF guide from PDFMech."}</p>
        <BlogLink path={path} onNavigate={onNavigate} className="blog-read-link">
          Read article <span aria-hidden="true">→</span>
        </BlogLink>
      </div>
    </article>
  );
}

export function BlogArchivePage({
  onNavigate,
}: {
  readonly onNavigate: (path: string) => void;
}) {
  const [posts, setPosts] = useState<readonly BlogPost[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    void getBlogPosts()
      .then((result) => {
        if (controller.signal.aborted) return;
        setPosts(result);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="blog-page" data-testid="blog-archive">
      <header className="blog-hero">
        <span className="hero-kicker">PDFMech guides</span>
        <h1>Practical PDF guides and privacy-first tips.</h1>
        <p>
          Learn how to edit, organize, search, and protect documents with clear
          instructions written around PDFMech’s browser-based tools.
        </p>
      </header>

      <section className="blog-archive-section" aria-labelledby="latest-articles-title">
        <div className="blog-section-heading">
          <div>
            <span>From the PDFMech team</span>
            <h2 id="latest-articles-title">Latest articles</h2>
          </div>
          <p>Useful answers for everyday PDF tasks.</p>
        </div>

        {status === "loading" ? (
          <div className="blog-status" role="status">Loading the latest guides…</div>
        ) : status === "error" ? (
          <div className="blog-status" role="status">
            <h2>Guides are temporarily unavailable.</h2>
            <p>Please try again shortly. The PDF editor and OCR tool are still available.</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="blog-status">
            <h2>New PDF guides are on the way.</h2>
            <p>Our first carefully reviewed articles will appear here after publication.</p>
          </div>
        ) : (
          <div className="blog-grid">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </section>

      <aside className="blog-tool-cta">
        <div>
          <span>Ready to work on a document?</span>
          <h2>Use PDFMech without uploading your PDF.</h2>
        </div>
        <div>
          <BlogLink path="/editor" onNavigate={onNavigate}>Open PDF Editor</BlogLink>
          <BlogLink path="/ocr-pdf" onNavigate={onNavigate}>Make a PDF searchable</BlogLink>
        </div>
      </aside>
    </main>
  );
}

export function BlogPostPage({
  slug,
  onNavigate,
  onPostResolved,
}: {
  readonly slug: string;
  readonly onNavigate: (path: string) => void;
  readonly onPostResolved: (post: BlogPost | null) => void;
}) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notFound" | "error">("loading");

  useEffect(() => {
    let active = true;
    setPost(null);
    setStatus("loading");
    onPostResolved(null);

    void getBlogPostBySlug(slug)
      .then((result) => {
        if (!active) return;
        setPost(result);
        setStatus(result === null ? "notFound" : "ready");
        onPostResolved(result);
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
        onPostResolved(null);
      });

    return () => {
      active = false;
    };
  }, [slug, onPostResolved]);

  if (status === "loading") {
    return <main className="blog-article-state" role="status">Loading article…</main>;
  }

  if (status === "notFound") {
    return (
      <main className="blog-article-state">
        <span className="hero-kicker">Article not found</span>
        <h1>This PDFMech guide is unavailable.</h1>
        <p>It may have moved or not yet been published.</p>
        <BlogLink path="/blog" onNavigate={onNavigate}>Return to all guides</BlogLink>
      </main>
    );
  }

  if (status === "error" || post === null) {
    return (
      <main className="blog-article-state" role="status">
        <span className="hero-kicker">Temporary issue</span>
        <h1>We could not load this guide.</h1>
        <p>Please try again shortly.</p>
        <BlogLink path="/blog" onNavigate={onNavigate}>Return to all guides</BlogLink>
      </main>
    );
  }

  const description = blogPostDescription(post);
  const updated = post.modified.split("T")[0] !== post.date.split("T")[0];

  return (
    <main className="blog-article-page" data-testid="blog-article">
      <nav className="blog-article-breadcrumbs" aria-label="Breadcrumb">
        <BlogLink path="/" onNavigate={onNavigate}>Home</BlogLink>
        <span aria-hidden="true">/</span>
        <BlogLink path="/blog" onNavigate={onNavigate}>Guides</BlogLink>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{post.title}</span>
      </nav>

      <article className="blog-article-shell">
        <header className="blog-article-header">
          <span className="hero-kicker">{categoryLabel(post)}</span>
          <h1>{post.title}</h1>
          {description ? <p>{description}</p> : null}
          <div className="blog-article-dates">
            <span>Published <time dateTime={post.date}>{formatBlogDate(post.date)}</time></span>
            {updated ? (
              <span>Updated <time dateTime={post.modified}>{formatBlogDate(post.modified)}</time></span>
            ) : null}
          </div>
          {post.featuredImageUrl !== null ? (
            <img
              className="blog-featured-image"
              src={post.featuredImageUrl}
              alt={post.featuredImageAlt}
              width="1200"
              height="675"
            />
          ) : null}
        </header>

        <div
          className="blog-prose"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        <aside className="blog-inline-cta">
          <div>
            <span>PDFMech browser tools</span>
            <h2>Edit the document while it stays on your device.</h2>
          </div>
          <BlogLink path="/editor" onNavigate={onNavigate}>Open PDF Editor</BlogLink>
        </aside>
      </article>

      <nav className="blog-article-footer-nav" aria-label="Article navigation">
        <BlogLink path="/blog" onNavigate={onNavigate}>← Back to all PDF guides</BlogLink>
        <BlogLink path="/features" onNavigate={onNavigate}>Explore PDFMech tools →</BlogLink>
      </nav>
    </main>
  );
}
