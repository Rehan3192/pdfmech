import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildStructuredData,
  canonicalUrl,
  SEO_PAGES,
  type SeoPageKey,
} from "../seo-config";

type WebsitePage = SeoPageKey | "notFound";
type MarketingPageKey = Exclude<SeoPageKey, "editor">;

interface WebsiteShellProps {
  readonly editor: ReactNode;
}

const routes: Readonly<Record<string, WebsitePage>> = {
  "/": "home",
  "/editor": "editor",
  "/features": "features",
  "/how-it-works": "howItWorks",
  "/faq": "faq",
  "/security": "security",
  "/terms": "terms",
  "/about": "about",
  "/privacy": "privacy",
  "/contact": "contact",
};

const freeCampaignFirstCycleEndsAt = new Date("2026-10-17T00:00:00+05:00").getTime();
const freeCampaignCycleLength = 37 * 24 * 60 * 60 * 1000;

function pageFromPath(pathname: string): WebsitePage {
  const normalizedPath = pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  return routes[normalizedPath] ?? "notFound";
}

function navigateTo(pathname: string): void {
  window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function WebsiteShell({ editor }: WebsiteShellProps) {
  const [page, setPage] = useState<WebsitePage>(() =>
    pageFromPath(window.location.pathname),
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function syncRoute(): void {
      setPage(pageFromPath(window.location.pathname));
      setMobileMenuOpen(false);
    }

    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    const isNotFound = page === "notFound";
    const title = isNotFound ? "Page Not Found | PDFMech" : SEO_PAGES[page].title;
    const description = isNotFound
      ? "The requested PDFMech page could not be found. Return home or open the free browser PDF editor."
      : SEO_PAGES[page].description;
    const pageCanonical = isNotFound ? null : canonicalUrl(page);

    document.title = title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", description);
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute(
        "content",
        isNotFound ? "noindex,follow" : "index,follow,max-image-preview:large",
      );
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", title);
    document
      .querySelector('meta[property="og:description"]')
      ?.setAttribute("content", description);
    document
      .querySelector('meta[name="twitter:title"]')
      ?.setAttribute("content", title);
    document
      .querySelector('meta[name="twitter:description"]')
      ?.setAttribute("content", description);
    const existingCanonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (pageCanonical === null) {
      existingCanonical?.remove();
    } else if (existingCanonical === null) {
      const canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      canonicalLink.href = pageCanonical;
      document.head.append(canonicalLink);
    } else {
      existingCanonical.href = pageCanonical;
    }
    document
      .querySelector('meta[property="og:url"]')
      ?.setAttribute("content", pageCanonical ?? window.location.href);

    let structuredData = document.querySelector<HTMLScriptElement>(
      "#route-structured-data",
    );
    if (isNotFound) {
      structuredData?.remove();
    } else {
      if (structuredData === null) {
        structuredData = document.createElement("script");
        structuredData.id = "route-structured-data";
        structuredData.type = "application/ld+json";
        document.head.append(structuredData);
      }
      structuredData.textContent = JSON.stringify(buildStructuredData(page));
    }
  }, [page]);

  const navItems = useMemo(
    () => [
      { page: "home" as const, path: "/", label: "Home" },
      { page: "editor" as const, path: "/editor", label: "PDF Editor" },
      { page: "features" as const, path: "/features", label: "Features" },
      { page: "howItWorks" as const, path: "/how-it-works", label: "How It Works" },
      { page: "faq" as const, path: "/faq", label: "FAQ" },
      { page: "about" as const, path: "/about", label: "About" },
      { page: "contact" as const, path: "/contact", label: "Contact" },
    ],
    [],
  );

  return (
    <div className="website-shell" data-page={page}>
      <header className="site-header" data-menu-open={mobileMenuOpen ? "true" : "false"}>
        <a
          className="site-brand"
          href="/"
          aria-label="PDFMech home"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/");
          }}
        >
          <img
            className="site-brand-logo"
            src="/PDFMechLogo-small.webp"
            alt="PDFMech"
            width="110"
            height="110"
          />
          <span>
            <strong>PDFMech</strong>
          </span>
        </a>
        <button
          className="mobile-menu-button"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="site-nav"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          Menu
        </button>
        <nav id="site-nav" className="site-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              aria-current={page === item.page ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigateTo(item.path);
                setMobileMenuOpen(false);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        {page === "editor" ? (
          <span className="editor-trust-badge">
            <strong>No upload</strong>
            <small>Your files stay in your browser</small>
          </span>
        ) : (
          <button
            className="nav-cta"
            type="button"
            onClick={() => {
              navigateTo("/editor");
              setMobileMenuOpen(false);
            }}
          >
            Open PDF
          </button>
        )}
      </header>

      {page === "editor" ? (
        editor
      ) : page === "notFound" ? (
        <NotFoundPage />
      ) : (
        <>
          {page !== "home" ? <Breadcrumbs page={page} /> : null}
          <MarketingPage page={page} />
          <SearchIntentSection page={page} />
          <InternalLinkSilo page={page} />
        </>
      )}
      <SiteFooter />
    </div>
  );
}

function Breadcrumbs({ page }: { readonly page: MarketingPageKey }) {
  return (
    <nav className="site-breadcrumbs" aria-label="Breadcrumb">
      <SiteLink path="/">Home</SiteLink>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{SEO_PAGES[page].h1}</span>
    </nav>
  );
}

function NotFoundPage() {
  return (
    <main className="not-found-page">
      <section>
        <span className="hero-kicker">404</span>
        <h1>Page not found</h1>
        <p>
          The PDFMech page you requested does not exist or may have moved.
        </p>
        <div>
          <SiteLink path="/">Return home</SiteLink>
          <SiteLink path="/editor">Open the PDF editor</SiteLink>
        </div>
      </section>
    </main>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-brand-block">
        <a
          className="footer-brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/");
          }}
        >
          <img src="/PDFMechLogo-small.webp" alt="" width="70" height="70" />
          <span>
            <strong>PDFMech</strong>
          </span>
        </a>
        <p>
          Edit PDFs directly in your browser without sending your document to
          an editing server.
        </p>
      </div>
      <nav className="footer-column" aria-label="Product links">
        <strong>Product</strong>
        <SiteLink path="/editor">PDFMech App</SiteLink>
        <SiteLink path="/features">Features</SiteLink>
        <SiteLink path="/how-it-works">How It Works</SiteLink>
        <SiteLink path="/faq">FAQ</SiteLink>
      </nav>
      <nav className="footer-column" aria-label="Company links">
        <strong>Company</strong>
        <SiteLink path="/about">About</SiteLink>
        <SiteLink path="/contact">Contact</SiteLink>
      </nav>
      <nav className="footer-column" aria-label="Trust and legal links">
        <strong>Trust &amp; Legal</strong>
        <SiteLink path="/security">Security</SiteLink>
        <SiteLink path="/privacy">Privacy</SiteLink>
        <SiteLink path="/terms">Terms</SiteLink>
        <a href="/sitemap.xml">Sitemap</a>
        <a href="/robots.txt">Robots.txt</a>
      </nav>
      <p className="footer-note">© {year} PDFMech. Built for fast browser-based PDF fixes.</p>
    </footer>
  );
}

function SiteLink({
  path,
  children,
}: {
  readonly path: string;
  readonly children: ReactNode;
}) {
  return (
    <a
      href={path}
      onClick={(event) => {
        event.preventDefault();
        navigateTo(path);
      }}
    >
      {children}
    </a>
  );
}

const internalLinkClusters: Readonly<
  Record<MarketingPageKey, readonly { path: string; eyebrow: string; title: string; description: string }[]>
> = {
  home: [
    { path: "/editor", eyebrow: "Start editing", title: "Open the PDF editor", description: "Make a quick change directly in your browser." },
    { path: "/features", eyebrow: "Explore tools", title: "See all PDFMech features", description: "Compare text, page, recovery, and workspace tools." },
    { path: "/privacy", eyebrow: "Your privacy", title: "Learn how local editing works", description: "Understand recovery data and browser-based processing." },
  ],
  features: [
    { path: "/editor", eyebrow: "Use the tools", title: "Open the PDF editor", description: "Try the features on a PDF from your device." },
    { path: "/how-it-works", eyebrow: "Learn the workflow", title: "See how PDFMech works", description: "Follow the path from opening a file to downloading it." },
    { path: "/faq", eyebrow: "Get answers", title: "Read common PDF questions", description: "Find practical answers about tools, files, and exports." },
  ],
  howItWorks: [
    { path: "/editor", eyebrow: "Start now", title: "Open the PDF editor", description: "Choose a PDF and follow the workflow as you edit." },
    { path: "/features", eyebrow: "Explore tools", title: "See what each tool can do", description: "Review editing, page organization, and recovery features." },
    { path: "/faq", eyebrow: "Need help?", title: "Read the FAQ", description: "Get answers before you begin your next edit." },
  ],
  faq: [
    { path: "/how-it-works", eyebrow: "Step-by-step", title: "Learn the editing workflow", description: "See the complete path from opening to downloading." },
    { path: "/features", eyebrow: "Product guide", title: "Explore PDFMech features", description: "See which tools support the edit you need." },
    { path: "/security", eyebrow: "Trust & safety", title: "Read the security overview", description: "Understand local processing and product limits." },
  ],
  security: [
    { path: "/privacy", eyebrow: "Privacy details", title: "Read the privacy overview", description: "Learn what stays in your browser and what you control." },
    { path: "/editor", eyebrow: "Use PDFMech", title: "Open the PDF editor", description: "Start a browser-based editing session without an account." },
    { path: "/faq", eyebrow: "Common questions", title: "Find practical answers", description: "Review guidance for recovery, downloads, and visual covers." },
  ],
  terms: [
    { path: "/privacy", eyebrow: "Your data", title: "Read the privacy overview", description: "Understand local recovery and browser-based PDF processing." },
    { path: "/security", eyebrow: "Product safety", title: "Review security information", description: "Learn the scope and limits of the editing tools." },
    { path: "/contact", eyebrow: "Need assistance?", title: "Contact PDFMech support", description: "Send product questions or focused feedback." },
  ],
  about: [
    { path: "/features", eyebrow: "Product tools", title: "Explore PDFMech features", description: "See the focused tools built for everyday document fixes." },
    { path: "/how-it-works", eyebrow: "The workflow", title: "See how editing works", description: "Learn how to go from an original PDF to a new copy." },
    { path: "/contact", eyebrow: "Get in touch", title: "Contact PDFMech", description: "Share feedback, questions, or an issue you found." },
  ],
  privacy: [
    { path: "/security", eyebrow: "Security overview", title: "Understand local processing", description: "Review how PDFMech approaches browser-based editing." },
    { path: "/editor", eyebrow: "Start privately", title: "Open the PDF editor", description: "Edit a PDF from your device without an account." },
    { path: "/terms", eyebrow: "Terms of use", title: "Read the terms", description: "Review the basic conditions for using PDFMech." },
  ],
  contact: [
    { path: "/faq", eyebrow: "Self-service help", title: "Browse common questions", description: "Find answers for common editing, download, and privacy topics." },
    { path: "/how-it-works", eyebrow: "Product guide", title: "Learn the editing workflow", description: "Follow the steps and controls before reporting an issue." },
    { path: "/privacy", eyebrow: "Share safely", title: "Read the privacy overview", description: "Learn how to report an issue without sharing sensitive PDFs." },
  ],
};

function InternalLinkSilo({ page }: { readonly page: MarketingPageKey }) {
  const links = internalLinkClusters[page];

  return (
    <aside className="internal-link-silo" aria-labelledby="explore-next-title">
      <div className="internal-link-silo-heading">
        <span className="hero-kicker">Explore next</span>
        <h2 id="explore-next-title">Keep moving with PDFMech.</h2>
        <p>Related guides and product pages for your next step.</p>
      </div>
      <nav className="internal-link-silo-grid" aria-label="Related PDFMech pages">
        {links.map((link) => (
          <SiteLink key={link.path} path={link.path}>
            <span>{link.eyebrow}</span>
            <strong>{link.title}</strong>
            <small>{link.description}</small>
            <i aria-hidden="true">→</i>
          </SiteLink>
        ))}
      </nav>
    </aside>
  );
}

const searchIntentCopy: Readonly<
  Record<MarketingPageKey, { title: string; text: string }>
> = {
  home: {
    title: "A free online PDF editor for quick, private fixes.",
    text: "Use PDFMech to add text to a PDF, visually cover visible content, rotate pages, delete PDF pages, or move pages into a better order. It is a browser-based PDF editor: open a file from your device, make supported changes, and download a new copy without creating an account.",
  },
  features: {
    title: "Free PDF editing tools for text and page changes.",
    text: "Whether you need to add text to a PDF, cover an outdated detail, delete a PDF page, or rearrange PDF pages, PDFMech keeps the task focused. It adds new editable text boxes and visual covers; it does not claim to securely remove underlying PDF content.",
  },
  howItWorks: {
    title: "How to edit a PDF online for free.",
    text: "Open a PDF from your device, choose the editing or page-organizing tool you need, then review and download a separate edited PDF. PDFMech is designed for common browser-based PDF tasks without a required account or upload queue.",
  },
  faq: {
    title: "Answers for common free PDF editor tasks.",
    text: "Find help before you add text to a PDF, delete or reorder PDF pages, use a visual cover, or download your edited file. The FAQ also explains the floating action dock, contextual sheets, local recovery, and the limits of visual whiteout.",
  },
  security: {
    title: "A browser-based PDF editor with local processing.",
    text: "PDFMech is built so supported editing work happens in your browser rather than through an editing-server upload. Review the product limits before using any free online PDF editor for sensitive documents, especially when a task requires secure redaction.",
  },
  terms: {
    title: "Using a free browser PDF editor responsibly.",
    text: "PDFMech helps with focused PDF edits such as adding text, visually covering content, and organizing pages. Always review the downloaded PDF and use specialist tools when you need security controls, legally binding signatures, or secure redaction.",
  },
  about: {
    title: "Built for everyday free PDF editing.",
    text: "PDFMech focuses on the jobs people commonly need from a free online PDF editor: add a note, cover a visible detail, rotate a scan, delete an extra page, or reorder a document before downloading a new copy.",
  },
  privacy: {
    title: "Private PDF editing without an editing-server upload.",
    text: "PDFMech is designed for browser-based PDF editing, so supported work happens on your device. You can add text, organize pages, and download a new copy while understanding how local recovery data may remain in the browser you use.",
  },
  contact: {
    title: "Help with free PDF editor tasks and browser issues.",
    text: "Contact PDFMech if you need help adding text to a PDF, deleting or moving PDF pages, using a visual cover, or downloading an edited file. For privacy, describe the issue without sending a sensitive source document.",
  },
};

function SearchIntentSection({ page }: { readonly page: MarketingPageKey }) {
  const copy = searchIntentCopy[page];

  return (
    <section className="search-intent-section" aria-labelledby="search-intent-title">
      <span className="hero-kicker">Free PDF editing</span>
      <h2 id="search-intent-title">{copy.title}</h2>
      <p>{copy.text}</p>
    </section>
  );
}

function MarketingPage({ page }: { readonly page: MarketingPageKey }) {
  switch (page) {
    case "home":
      return <HomePage />;
    case "features":
      return <FeaturesPage />;
    case "howItWorks":
      return <HowItWorksPage />;
    case "faq":
      return <FaqPage />;
    case "security":
      return <SecurityPage />;
    case "terms":
      return <TermsPage />;
    case "about":
      return <AboutPage />;
    case "privacy":
      return <PrivacyPage />;
    case "contact":
      return <ContactPage />;
  }
}

function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const homeFaqs = [
    { question: "Is my PDF uploaded?", answer: "No. PDFMech processes supported edits locally in your browser while you work." },
    { question: "Do I need an account?", answer: "No. Open the editor and start working without creating an account." },
    { question: "Is my PDF stored?", answer: "Local recovery can save your source PDF and editing state in this browser. You can clear that data from the editor." },
    { question: "Is my work lost after a reload?", answer: "Not necessarily. If a local checkpoint is available, PDFMech can offer to restore your previous session." },
    { question: "Is PDFMech free?", answer: "Yes. PDFMech is free to use, with no account required." },
    { question: "Does download replace my original?", answer: "No. Download creates a new edited PDF and leaves the original file unchanged." },
  ] as const;

  return (
    <main className="site-page" data-testid="site-home">
      <section className="hero-section">
        <div>
          <span className="hero-kicker">Private browser PDF editor</span>
          <h1>Edit your PDFs without uploading them.</h1>
          <p>
            Private PDF editing in your browser. Add text, cover visible
            content, organize pages, focus the workspace, and download your
            edited PDF without sending the document to an editing server.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => navigateTo("/editor")}>
              Open PDFMech
            </button>
            <button type="button" className="secondary" onClick={() => navigateTo("/how-it-works")}>
              How It Works
            </button>
          </div>
          <FreeAccessCountdown />
          <p className="hero-proof">No upload · No account · No watermark</p>
        </div>
        <div className="hero-visual product-mockup-card" aria-hidden="true">
          <ProductMockup />
          <img
            src="/home-pdf-repair.webp"
            alt=""
            width="900"
            height="900"
            decoding="async"
            fetchPriority="high"
          />
          <div>
            <span>PDFMech workspace</span>
            <strong>Open → Edit → Download</strong>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Privacy promises">
        <TrustItem icon="▣" title="No upload" text="Your PDF stays on your device" />
        <TrustItem icon="✓" title="No account" text="Open the editor and start" />
        <TrustItem icon="↺" title="Local recovery" text="Restore work after a reload" />
      </section>

      <section className="tools-section" aria-label="PDFMech tools">
        <SectionIntro
          kicker="What you can do"
          title="Simple tools for everyday PDF edits."
          text="Everything you need for quick changes, right in your browser."
        />
        <div className="content-grid">
          <FeatureCard title="Add Text" text="Add text wherever you need it, then adjust font, size, color, bold style, and alignment." path="M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3" />
          <FeatureCard title="Cover Content" text="Place visual cover blocks over information and pick a color that blends with the page." path="M8 4h13l-5 16H3L8 4Z" />
          <FeatureCard title="Organize Pages" text="Rotate pages, move pages earlier or later, and delete pages you do not need." path="M8 3h12v15H8zM4 7v14h12" />
          <FeatureCard title="Make Corrections" text="Move, resize, duplicate, or delete objects you added to the document." path="M9 4H4v5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
          <FeatureCard title="Undo Mistakes" text="Go backward or forward through meaningful document edits while you work." path="M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7" />
          <FeatureCard title="Recover Your Work" text="Local recovery can offer to restore your editing session after a browser reload." path="M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
          <FeatureCard title="Focused Workspace" text="Keep the PDF central while tools, properties, and pages open only when you need them." path="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
          <FeatureCard title="Safer Placement" text="Each add tool places one object, then disarms to prevent an unwanted duplicate." path="m5 12 4 4L19 6" />
        </div>
      </section>

      <section className="split-section boxed-home-section workflow-home-section" aria-label="PDFMech workflow">
        <div className="content-card">
          <span className="hero-kicker">Workflow</span>
          <h2>From PDF to finished document in three steps.</h2>
          <ol className="step-list">
            <li>
              <strong>Open your PDF</strong>
              <span>Choose a PDF from your device.</span>
            </li>
            <li>
              <strong>Make your edits</strong>
              <span>Choose a dock tool, place one object, then refine it in its contextual sheet.</span>
            </li>
            <li>
              <strong>Download the result</strong>
              <span>PDFMech validates the generated PDF before download.</span>
            </li>
          </ol>
        </div>
        <ImageCard
          src="/home-pdf-workflow.webp"
          alt="Illustration of a person editing a PDF document"
          caption="Quick edits without a heavy desktop app."
          width={760}
          height={760}
        />
      </section>

      <section className="split-section boxed-home-section examples-home-section" aria-label="Common PDF edit examples">
        <ImageCard
          src="/home-pdf-editing.webp"
          alt="Illustration of text and image boxes being edited on a PDF"
          caption="Add text, move objects, and adjust the page."
          width={659}
          height={496}
        />
        <div className="content-card">
          <span className="hero-kicker">Popular uses</span>
          <h2>Useful when you just need the job done.</h2>
          <ul className="plain-list">
            <li>Add information to non-editable PDFs using text boxes.</li>
            <li>Add a name, date, address, or short note.</li>
            <li>Cover outdated text before sending a copy.</li>
            <li>Rotate scanned pages that face the wrong way.</li>
            <li>Delete extra pages before downloading.</li>
          </ul>
        </div>
      </section>

      <section className="boxed-home-section feature-list-home-section" aria-label="Detailed PDFMech features">
        <SectionIntro
          kicker="Tools"
          title="Simple tools for common PDF edits."
          text="Add text, organize pages, cover visible content, undo changes, and download your edited document."
        />
        <div className="feature-table">
          <FeatureRow feature="Text editing" description="Add text and adjust its font, size, color, and alignment." path="M4 5h16M12 5v15M8 20h8" />
          <FeatureRow feature="Visual whiteout" description="Cover existing content with a block that matches the page." path="M8 4h13l-5 16H3L8 4Z" />
          <FeatureRow feature="Object positioning" description="Move added elements and resize them precisely." path="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
          <FeatureRow feature="Object controls" description="Duplicate an added element or remove it from the page." path="M8 3h12v15H8zM4 7v14h12" />
          <FeatureRow feature="Page organization" description="Rotate, reorder, or delete pages from the document." path="M4 7h16M4 12h16M4 17h10" />
          <FeatureRow feature="Undo and redo" description="Reverse or restore meaningful editing changes." path="M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7" />
          <FeatureRow feature="Session recovery" description="Restore the latest available browser-local session." path="M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
          <FeatureRow feature="Checked download" description="Validate the generated PDF before saving it." path="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" />
          <FeatureRow feature="Contextual sheets" description="Open properties, page thumbnails, and additional actions only when needed." path="M4 4h16v16H4zM9 4v16M15 4v16" />
          <FeatureRow feature="Full-screen workspace" description="Give the document more room while keeping an exit control visible." path="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
          <FeatureRow feature="One-shot tools" description="Place one object per activation to avoid accidental duplicates." path="m5 12 4 4L19 6" />
          <FeatureRow feature="Move pages" description="Open Pages and move the selected thumbnail up or down." path="m8 7 4-4 4 4m0 10-4 4-4-4M12 3v18" />
        </div>
      </section>

      <section className="content-card recovery-section">
        <div className="recovery-copy">
          <span className="hero-kicker">Local recovery</span>
          <h2>Close the tab. Come back later.</h2>
          <p>
            PDFMech can save your editing session locally in your browser. If
            something interrupts your work, the editor can offer to restore the
            latest available session.
          </p>
        </div>
        <div className="recovery-preview" aria-hidden="true">
          <span className="recovery-preview-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v5l3 2M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" /></svg></span>
          <div><span>Recovery ready</span><strong>Saved locally</strong><small>No document upload required</small></div>
          <i><b /></i>
        </div>
      </section>

      <section className="split-section boxed-home-section privacy-home-section" aria-label="Privacy and browser limits">
        <div className="content-card">
          <span className="privacy-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 5 6v5c0 4.8 2.8 8.2 7 10 4.2-1.8 7-5.2 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg></span>
          <span className="hero-kicker">Privacy first</span>
          <h2>Private by default.</h2>
          <p>
            No upload queue or editing server. Supported PDF work happens
            directly in your browser.
          </p>
          <FeatureList
            title="Stays on your device"
            items={[
              "Your PDF",
              "Your document edits",
              "Your editing session",
              "Local recovery data",
            ]}
          />
        </div>
        <div className="content-card">
          <span className="privacy-card-icon limits-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg></span>
          <span className="hero-kicker">Browser limits</span>
          <h2>Clear browser limits.</h2>
          <p>
            Sensible limits keep local editing responsive and predictable,
            even when a document contains many pages.
          </p>
          <div className="limit-grid">
            <Metric value="100 MB" label="Maximum file size" />
            <Metric value="500 pages" label="Maximum pages" />
            <Metric value="400%" label="Maximum zoom" />
          </div>
        </div>
      </section>

      <section className="boxed-home-section faq-home-section" aria-label="Frequently asked questions">
        <SectionIntro
          kicker="FAQ"
          title="Common questions, clear answers."
          text="The essentials about local editing, recovery, accounts, and downloads."
        />
        <div className="faq-accordion">
          {homeFaqs.map((item, index) => (
            <FaqItem
              key={item.question}
              question={item.question}
              answer={item.answer}
              open={openFaq === index}
              onToggle={() => setOpenFaq((current) => current === index ? null : index)}
            />
          ))}
        </div>
      </section>

      <section className="final-cta">
        <span className="hero-kicker">Ready when you are</span>
        <h2>Got a PDF that needs work?</h2>
        <p>Bring it to PDFMech. Edit it locally, make your changes, and download the finished document.</p>
        <button type="button" onClick={() => navigateTo("/editor")}>
          Open PDF
        </button>
        <small>No account · No upload · No watermark</small>
      </section>
    </main>
  );
}

function FreeAccessCountdown() {
  const getRemaining = () => {
    const now = Date.now();
    if (now < freeCampaignFirstCycleEndsAt) return freeCampaignFirstCycleEndsAt - now;
    const elapsedInCycles = (now - freeCampaignFirstCycleEndsAt) % freeCampaignCycleLength;
    return elapsedInCycles === 0 ? freeCampaignCycleLength : freeCampaignCycleLength - elapsedInCycles;
  };
  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getRemaining()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totalSeconds = Math.floor(remaining / 1000);
  const units = [
    { value: Math.floor(totalSeconds / 86400), label: "Days" },
    { value: Math.floor((totalSeconds % 86400) / 3600), label: "Hours" },
    { value: Math.floor((totalSeconds % 3600) / 60), label: "Minutes" },
    { value: totalSeconds % 60, label: "Seconds" },
  ];

  return (
    <section className="free-countdown" aria-label="Free access countdown">
      <div className="free-countdown-label"><i aria-hidden="true" /><span>Free early access ends in</span></div>
      <div className="free-countdown-units">
        {units.map((unit) => (
          <time key={unit.label}>
            <strong>{String(unit.value).padStart(2, "0")}</strong>
            <small>{unit.label}</small>
          </time>
        ))}
      </div>
    </section>
  );
}

function FeaturesPage() {
  return (
    <main className="site-page modern-page" data-testid="site-features">
      <section className="page-hero split-hero">
        <div>
          <span className="hero-kicker">Features</span>
          <h1>Everything you need for quick PDF edits.</h1>
          <p>
            PDFMech gives you practical tools to edit, organize, and refine PDF
            documents directly in your browser. No uploads, no accounts, no watermark.
          </p>
          <p className="hero-proof">Works in your browser · No account required · Your files stay on your device</p>
        </div>
        <div className="mini-editor-preview" aria-hidden="true">
          <div className="mockup-window-dots"><span /><span /><span /></div>
          <div className="mini-editor-page">
            <strong>Edit PDFs<br />Your Way</strong>
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
      <section className="feature-tools" aria-labelledby="feature-tools-title">
        <header className="feature-tools-heading">
          <span>What you can do</span>
          <h2 id="feature-tools-title">Simple tools for everyday PDF edits.</h2>
          <p>Everything you need for quick changes, right in your browser.</p>
        </header>
        <div className="feature-tools-grid">
          {[
            { title: "Add Text", text: "Add text anywhere. Adjust font, size, color, bold style, and alignment.", path: "M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3" },
            { title: "Cover Content", text: "Place visual covers over content and choose a color that blends with the page.", path: "M8 4h13l-5 16H3L8 4Z" },
            { title: "Organize Pages", text: "Rotate pages, change their order, and remove the ones you no longer need.", path: "M8 3h12v15H8zM4 7v14h12" },
            { title: "Make Corrections", text: "Move, resize, duplicate, or delete objects you add to your document.", path: "M9 4H4v5M15 4h5v5M20 15v5h-5M9 20H4v-5" },
            { title: "Undo Mistakes", text: "Step back through your changes or redo an edit while you work.", path: "M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7" },
            { title: "Recover Your Work", text: "Restore an available editing session after a browser reload.", path: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" },
            { title: "Focused Workspace", text: "Use a floating action dock and open page or property sheets only when needed.", path: "M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" },
            { title: "Safer Placement", text: "Place one object per activation so a later page click cannot add an unwanted duplicate.", path: "m5 12 4 4L19 6" },
          ].map((tool) => (
            <article className="feature-tool" key={tool.title}>
              <span className="feature-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={tool.path} /></svg></span>
              <h3>{tool.title}</h3>
              <p>{tool.text}</p>
            </article>
          ))}
        </div>
      </section>
      <BulletGuideSection
        kicker="PDFMech features"
        title="A practical toolkit for real document work"
        intro="Each PDFMech feature is designed to solve a focused editing task without crowding the document."
        cards={[
          { title: "Add and re-edit PDF text", items: ["Place a new text box anywhere on a supported PDF page.", "Choose font, size, color, bold style, and alignment.", "Reselect added text later and continue typing.", "Move, resize, duplicate, or delete the text box."] },
          { title: "Visually cover PDF content", items: ["Use Whiteout for a clean visual cover.", "Reselect the cover to open Whiteout Properties.", "Choose a preset or use Pick from PDF to match the page.", "Treat covers as visual changes, not secure data removal."] },
          { title: "Delete and reorder PDF pages", items: ["Delete a PDF page free from the edited copy.", "Move a PDF page up or down with dedicated controls.", "Rotate pages that were scanned sideways.", "Confirm the final order using page thumbnails."] },
          { title: "Navigate and zoom comfortably", items: ["Use plus, minus, or the percentage control for zoom.", "Drag the document in Select mode when a zoomed page extends beyond the viewport.", "Open the Pages sheet to jump directly to another page.", "Use Previous and Next in Pages without changing document order."] },
          { title: "Create objects safely", items: ["Text and Whiteout use one-shot placement.", "The creation tool disarms after one object is added.", "A later page click cannot create an accidental duplicate.", "Select the tool again only when another object is intentional."] },
          { title: "Control the workspace", items: ["Keep the document visible behind the floating action dock.", "Open Properties only after selecting an added object.", "Open Pages as a temporary thumbnail sheet.", "Choose Fullscreen from More for maximum document space."] },
          { title: "Recover and reverse changes", items: ["Use Undo and Redo for meaningful object and page changes.", "Restore an available browser-local editing session.", "Clear the document and local checkpoint when finished.", "Keep recovery under your control in the current browser."] },
          { title: "Validate and download", items: ["Review text alignment, cover edges, page count, and order.", "Validate the generated file before download begins.", "Download a new edited PDF to your device.", "Keep the original source PDF unchanged as a reference."] },
        ]}
      />
      <CtaSection title="Ready to edit your PDF?" />
    </main>
  );
}

function HowItWorksPage() {
  return (
    <main className="site-page modern-page" data-testid="site-how-it-works">
      <section className="page-hero marketing-hero how-hero">
        <div className="how-hero-copy">
          <span className="hero-kicker">How it works</span>
          <h1>Free PDF editing in three clear steps.</h1>
          <ul className="hero-benefits">
            <li>Open a PDF directly from your device</li>
            <li>Add text, move or delete pages, and visually cover content</li>
            <li>Review and download a new PDF copy</li>
          </ul>
          <button type="button" onClick={() => navigateTo("/editor")}>Open PDFMech</button>
        </div>
        <div className="how-hero-visual" aria-hidden="true">
          <span><b>01</b><strong>Open</strong><small>Choose a PDF</small></span>
          <i>→</i>
          <span><b>02</b><strong>Edit</strong><small>Make changes</small></span>
          <i>→</i>
          <span><b>03</b><strong>Save</strong><small>Download a copy</small></span>
        </div>
      </section>
      <section className="workflow-strip">
        <StepCard number="01" title="Open" text="Choose a PDF from your device." />
        <StepCard number="02" title="Edit" text="Add text, cover content, organize pages, and make changes." />
        <StepCard number="03" title="Download" text="Review your document and save the edited PDF to your device." />
      </section>
      <section className="editor-controls-guide" aria-labelledby="editor-controls-title">
        <header className="editor-controls-heading">
          <span className="hero-kicker">Editor controls</span>
          <h2 id="editor-controls-title">Every button, clearly explained.</h2>
          <p>
            PDFMech keeps the document central and moves controls into a compact
            app bar, floating dock, and temporary sheets. Here is the current layout.
          </p>
        </header>
        <div className="editor-control-groups">
          <ControlGuideGroup
            icon="⌘"
            eyebrow="Document and view"
            title="Document bar and zoom"
            controls={[
              ["Open", "Choose another PDF while a document is active."],
              ["Document details", "See the filename, page count, file size, and Saved locally state at the top."],
              ["Undo / Redo", "On wider screens, step backward or forward through meaningful object and page changes from the document bar."],
              ["Zoom − / +", "Use the floating zoom control to decrease or increase magnification."],
              ["Zoom percentage", "Choose a supported zoom level directly from the percentage menu."],
              ["Drag in Select", "When a zoomed page is larger than the viewport, drag the document horizontally or vertically while Select is active."],
            ]}
          />
          <ControlGuideGroup
            icon="T"
            eyebrow="Primary actions"
            title="Floating action dock"
            controls={[
              ["Select", "Inspect the page, select an added object, or drag around a zoomed document without creating anything."],
              ["Text", "Arm one text placement. Tap or click once on the PDF, then type in the new text box."],
              ["Whiteout", "Place one visual cover over visible content. Whiteout is not secure removal of underlying PDF data."],
              ["More", "Open page controls, history, fullscreen, and Clear Document in a temporary sheet."],
              ["Download", "Validate and create a new edited PDF while leaving the original file unchanged."],
              ["One-shot placement", "Text and Whiteout disarm after one object is placed, preventing an accidental second object."],
            ]}
          />
          <ControlGuideGroup
            icon="◫"
            eyebrow="Selected object"
            title="Contextual properties sheet"
            controls={[
              ["Quick text controls", "On phones, a compact sheet gives immediate access to color, size, bold, presets, and Pick from PDF."],
              ["More Properties", "Expand the text sheet for font, exact size, alignment, and text content."],
              ["Whiteout Properties", "Choose a cover color, use a preset, or sample a color directly from the PDF."],
              ["Move and resize", "Drag a selected object or use its handles to position and size it precisely."],
              ["Duplicate", "Create a copy of the selected object with a small positional offset."],
              ["Delete", "Remove the selected text box or whiteout cover."],
              ["Done", "Apply the current text content and close the sheet to return to the document."],
            ]}
          />
          <ControlGuideGroup
            icon="▦"
            eyebrow="Additional actions"
            title="More Tools and Pages sheets"
            controls={[
              ["Pages", "Open a temporary sheet of page thumbnails instead of keeping a permanent page rail on screen."],
              ["Rotate Page", "Rotate the current page when a scan or document is sideways."],
              ["Move Page", "Move the current page; the Pages sheet also provides dedicated up and down controls."],
              ["Delete Page", "Remove the current page from the edited copy."],
              ["Undo / Redo", "Reverse or restore meaningful changes from the More Tools sheet on smaller screens."],
              ["Fullscreen", "Give the document the largest available workspace."],
              ["Clear Document", "Close the session and remove its local recovery checkpoint after confirmation."],
              ["Page navigation", "Choose a thumbnail or use Previous and Next without changing page order."],
            ]}
          />
        </div>
        <aside className="placement-safety-card">
          <span>Comfortable editing</span>
          <strong>Choose once → place once → refine in context.</strong>
          <p>
            A blank-page click after placement will not create a second object.
            Existing text remains reusable: select it again whenever you want to
            continue typing or change its appearance.
          </p>
        </aside>
      </section>
      <BulletGuideSection
        kicker="PDFMech workflow"
        title="A clear path from first click to final file"
        intro="Use this practical checklist whenever you edit a document in PDFMech."
        cards={[
          { title: "1. Open and inspect", items: ["Choose a PDF directly from your device.", "Read its page count, file size, and Saved locally state in the document bar.", "Use the floating zoom control to choose a comfortable starting view."] },
          { title: "2. Choose one dock tool", items: ["Use Select to inspect or drag the document without creating anything.", "Choose Text or Whiteout only when you are ready to place an object.", "Each placement tool disarms after one use to prevent accidental duplicates."] },
          { title: "3. Refine the change", items: ["Select added text whenever you need to keep typing.", "Use the contextual sheet for font, size, color, alignment, and text content.", "Move, resize, duplicate, or delete the selected object without affecting the original PDF."] },
          { title: "4. Organize PDF pages", items: ["Open More and choose Pages to see thumbnails.", "Use the Pages sheet to select, move up, move down, or navigate pages.", "Rotate or delete the current page from More Tools."] },
          { title: "5. Focus the workspace", items: ["Drag vertically or horizontally in Select mode when zoomed in.", "Close temporary Properties, More Tools, or Pages sheets when finished.", "Choose Fullscreen from More for maximum document space."] },
          { title: "6. Review and download", items: ["Use Undo or Redo to compare changes.", "Review every page and remember that covers are visual, not secure redaction.", "Download a new edited PDF while your original file stays unchanged."] },
        ]}
      />
      <section className="split-section">
        <div className="content-card">
          <span className="hero-kicker">Open your PDF</span>
          <h2>Choose a PDF from your device.</h2>
          <p>
            Click Open PDF and select a file. Your PDF opens directly in the browser,
            with no account required for supported editing tasks.
          </p>
        </div>
        <div className="content-card">
          <span className="hero-kicker">Download your PDF</span>
          <h2>Save your edited document.</h2>
          <p>
            When you are finished, download creates a new edited PDF. Your original
            file is not changed.
          </p>
        </div>
      </section>
      <CtaSection title="Ready to edit your PDF?" />
    </main>
  );
}

function FaqPage() {
  return (
    <main className="site-page modern-page" data-testid="site-faq">
      <section className="page-hero marketing-hero faq-hero">
        <div className="faq-hero-copy">
          <span className="hero-kicker">FAQ</span>
          <h1>Free PDF editor questions, answered.</h1>
          <ul className="hero-benefits">
            <li>Clear answers about privacy and local editing</li>
            <li>Help for text, page deletion, and page reordering</li>
            <li>Honest limits for visual covers and browser processing</li>
          </ul>
          <button type="button" onClick={() => navigateTo("/editor")}>Open PDFMech</button>
        </div>
        <div className="faq-hero-visual" aria-hidden="true">
          <span className="faq-visual-mark">?</span>
          <strong>Quick answers</strong>
          <p>Privacy, editing, recovery, and downloads.</p>
          <div><span>Is my PDF uploaded?</span><b>+</b></div>
          <div><span>Do I need an account?</span><b>+</b></div>
          <div><span>Can I organize pages?</span><b>+</b></div>
        </div>
      </section>
      <BulletGuideSection
        kicker="Helpful answers"
        title="Everything to know before you open a PDF"
        intro="Short, practical answers about PDFMech features, privacy, and supported document changes."
        cards={[
          { title: "Is PDFMech a free PDF editor?", items: ["PDFMech is currently free to use.", "No account is required to start editing.", "Downloaded PDFs do not receive a PDFMech watermark.", "Supported work happens directly in your browser."] },
          { title: "Is my PDF uploaded?", items: ["PDFMech is designed for local browser processing.", "Your source PDF is not sent to an editing server for supported tasks.", "Local recovery data may remain in the browser you used.", "You can clear the document and its recovery checkpoint from the editor."] },
          { title: "Can I add or change text?", items: ["The Text tool creates a new editable text box on the PDF.", "Reselect the box later to continue typing or change formatting.", "Choose font, size, color, bold style, and alignment.", "PDFMech does not rewrite the original embedded PDF text layer yet."] },
          { title: "Can I remove PDF text free?", items: ["Whiteout can visually cover text or other visible content.", "Select the cover to open Whiteout Properties.", "Choose a preset, use the color control, or sample a color from the PDF.", "Whiteout is a visual cover and is not guaranteed secure data removal."] },
          { title: "Can I delete PDF pages free?", items: ["Open More, then choose Pages to view thumbnails.", "Select the unwanted page and use Delete Page from More Tools.", "Review the new page count before downloading.", "Your original PDF file remains unchanged on your device."] },
          { title: "Can I move PDF pages up or down?", items: ["Open More, choose Pages, and select a thumbnail.", "Move up sends the page one position earlier.", "Move down sends the page one position later.", "Previous and Next change the selected page without changing document order."] },
          { title: "How do zoom and document dragging work?", items: ["Use plus, minus, or the percentage menu for zoom.", "Keep Select active when you are not placing a new object.", "Drag vertically or horizontally when a zoomed page extends beyond the viewport.", "Open Pages when you want to jump to another page."] },
          { title: "Can I make more room for the PDF?", items: ["The document-first layout has no permanent side rails.", "Properties, More Tools, and Pages open as temporary sheets.", "Close a sheet when its task is complete.", "Choose Fullscreen from More for the largest workspace."] },
          { title: "What happens after a placement?", items: ["Text and Whiteout place one object per activation.", "The selected creation tool then disarms automatically.", "A later page click will not create an unwanted duplicate.", "Choose the tool again when you intentionally need another object."] },
          { title: "How do recovery and download work?", items: ["Local recovery can offer the latest browser-stored session after interruption.", "Undo and Redo handle meaningful object and page changes.", "Download validates and creates a new edited PDF.", "Always review the downloaded result in a PDF viewer before sharing."] },
        ]}
      />
      <CtaSection title="Still have questions?" />
    </main>
  );
}

function SecurityPage() {
  return (
    <main className="site-page trust-page" data-testid="site-security">
      <section className="trust-hero">
        <div className="trust-hero-copy">
          <span className="hero-kicker">Security</span>
          <h1>PDF editing built around local processing.</h1>
          <ul className="hero-benefits">
            <li>Supported edits run directly in your browser</li>
            <li>No PDFMech account or cloud document library</li>
            <li>You choose when to download or clear your work</li>
          </ul>
        </div>
        <div className="trust-hero-visual" aria-hidden="true">
          <span className="trust-shield">✓</span>
          <strong>Your device stays in control</strong>
          <small>Open locally · Edit locally · Download locally</small>
        </div>
      </section>
      <section className="trust-stat-grid" aria-label="PDFMech security summary">
        <article><strong>Browser-based</strong><span>Supported PDF work happens on your device.</span></article>
        <article><strong>Account-free</strong><span>No sign-up is required before you edit.</span></article>
        <article><strong>User-controlled</strong><span>You decide when to recover, download, or clear.</span></article>
      </section>
      <BulletGuideSection
        kicker="Security model"
        title="How PDFMech handles your editing session"
        intro="The editor minimizes unnecessary data movement and keeps important controls visible to you."
        cards={[
          { title: "Local PDF processing", items: ["Open supported PDFs from your own device.", "Render pages and apply supported edits in the browser.", "Generate the edited PDF locally before download.", "Keep the original source file unchanged."] },
          { title: "No cloud document library", items: ["PDFMech is not a hosted PDF storage account.", "There is no document dashboard shared across devices.", "Files are not intentionally added to a PDFMech cloud library.", "Your browser session remains the center of the workflow."] },
          { title: "Browser-local recovery", items: ["Recovery can preserve the source PDF and editing state locally.", "A reload may offer the latest available local checkpoint.", "Recovery data belongs to the browser and device where it was created.", "Clear the document when you no longer need the checkpoint."] },
          { title: "Safer editing controls", items: ["Creation tools place one object per activation.", "Undo and Redo reverse meaningful editing actions.", "Selection handles make added objects visible and adjustable.", "Download validation checks the generated file before saving."] },
          { title: "Your security responsibilities", items: ["Use a trusted, updated browser and device.", "Review every edited page before sharing the result.", "Protect downloaded files using appropriate device controls.", "Avoid editing documents you are not authorized to use."] },
          { title: "What the tool does not claim", items: ["PDFMech is not encrypted cloud document storage.", "It does not replace specialist document-forensics tools.", "Visual covers do not prove underlying data was removed.", "No browser tool can secure a compromised device for you."] },
        ]}
      />
      <section className="trust-warning-card">
        <span aria-hidden="true">!</span>
        <div><h2>Visual whiteout is not secure redaction</h2><p>Whiteout adds a visual cover. Do not treat it as guaranteed removal of underlying PDF text, metadata, or other data. Use a specialist secure-redaction workflow for sensitive information.</p></div>
      </section>
    </main>
  );
}

function TermsPage() {
  return (
    <main className="site-page trust-page legal-page" data-testid="site-terms">
      <section className="trust-hero trust-hero-centered">
        <div className="trust-hero-copy">
          <span className="hero-kicker">Terms of Service</span>
          <h1>Clear terms for using PDFMech.</h1>
          <p>These terms explain the responsibilities, limits, and basic rules that apply when you use the PDFMech website and browser-based PDF editor.</p>
          <small className="trust-updated">Last updated: September 9, 2026</small>
        </div>
      </section>
      <section className="legal-summary" aria-label="Terms summary">
        <span>This summary helps you scan the terms; the numbered sections below are the terms that apply.</span>
        <ul><li>Use only documents you are allowed to edit.</li><li>Review every output before relying on it.</li><li>Do not misuse or disrupt the service.</li></ul>
      </section>
      <section className="legal-card-grid">
        {[
          { title: "1. About PDFMech", items: ["PDFMech provides browser-based tools for common PDF editing tasks.", "Supported features may include adding text, visual covers, page organization, local recovery, and PDF download.", "The service is not legal, financial, compliance, or document-forensics advice."] },
          { title: "2. Eligibility and acceptance", items: ["By using PDFMech, you agree to these terms.", "You must be legally able to accept these terms where you live.", "If you use PDFMech for an organization, you confirm that you are authorized to act for it."] },
          { title: "3. Your documents and edits", items: ["Your PDFs and the edits you create remain your content.", "You are responsible for having permission to open, alter, and download each document.", "You are responsible for the accuracy, legality, and consequences of the edited result."] },
          { title: "4. Acceptable use", items: ["Do not use PDFMech for unlawful, harmful, fraudulent, or abusive activity.", "Do not attempt to disrupt, overload, reverse engineer, or bypass safeguards in the service.", "Do not use the service to infringe privacy, copyright, or other rights."] },
          { title: "5. Local processing and recovery", items: ["Supported editing is designed to occur in your browser.", "Local recovery may store the source PDF and editing state in the current browser.", "You are responsible for clearing local data on shared or untrusted devices."] },
          { title: "6. Visual covers and review", items: ["Whiteout is a visual-cover tool, not guaranteed secure redaction.", "Underlying content or metadata may remain in a PDF.", "Review the downloaded PDF in a suitable viewer before relying on or sharing it."] },
          { title: "7. Availability and changes", items: ["Features may be changed, limited, paused, or discontinued as PDFMech develops.", "The service may occasionally be unavailable because of maintenance or technical issues.", "These terms may be updated, with the revised date shown on this page."] },
          { title: "8. Disclaimers and liability", items: ["PDFMech is provided on an “as is” and “as available” basis where permitted by law.", "No guarantee is made that every PDF will open, render, edit, or export perfectly.", "To the extent permitted by law, PDFMech is not liable for indirect or consequential loss arising from use of the service."] },
          { title: "9. Ending use", items: ["You may stop using PDFMech at any time.", "Access may be limited when necessary to protect the service, users, or legal rights.", "Provisions that logically continue after use ends remain applicable."] },
          { title: "10. Questions", items: ["Questions about these terms can be sent through the Contact page.", "Describe the issue without attaching a sensitive PDF unless specifically requested.", "Privacy-related details are available on the Privacy page."] },
        ].map((section) => (
          <article className="legal-section-card" key={section.title}>
            <h2>{section.title}</h2>
            <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </section>
    </main>
  );
}

function CtaSection({ title }: { readonly title: string }) {
  return (
    <section className="final-cta">
      <h2>{title}</h2>
      <p>Open your document in PDFMech and start making changes now.</p>
      <button type="button" onClick={() => navigateTo("/editor")}>
        Open PDFMech
      </button>
      <small>No upload · No account · No watermark</small>
    </section>
  );
}

function BulletGuideSection({
  kicker,
  title,
  intro,
  cards,
}: {
  readonly kicker: string;
  readonly title: string;
  readonly intro: string;
  readonly cards: ReadonlyArray<{
    readonly title: string;
    readonly items: readonly string[];
  }>;
}) {
  return (
    <section className="bullet-guide-section">
      <header className="bullet-guide-heading">
        <span className="hero-kicker">{kicker}</span>
        <h2>{title}</h2>
        <div>{intro}</div>
      </header>
      <div className="bullet-guide-grid">
        {cards.map((card, index) => (
          <article className="bullet-guide-card" key={card.title}>
            <span className="bullet-card-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3>{card.title}</h3>
            <ul>
              {card.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function StepCard({
  number,
  title,
  text,
}: {
  readonly number: string;
  readonly title: string;
  readonly text: string;
}) {
  return (
    <article>
      <span>{number}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

function ControlGuideGroup({
  icon,
  eyebrow,
  title,
  controls,
}: {
  readonly icon: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly controls: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <article className="editor-control-group">
      <header>
        <span aria-hidden="true">{icon}</span>
        <div>
          <small>{eyebrow}</small>
          <h3>{title}</h3>
        </div>
      </header>
      <dl>
        {controls.map(([name, description]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function ProductMockup() {
  return (
    <div className="pdfmech-product-mockup">
      <div className="mockup-titlebar">
        <span className="mockup-dots">
          <i />
          <i />
          <i />
        </span>
        <strong>sample.pdf</strong>
        <span className="mockup-saved">Saved locally</span>
      </div>
      <div className="mockup-body mockup-document-first">
        <div className="mockup-document">
          <div className="mockup-text-box">
            <strong>Edit PDFs</strong>
            <strong>Your Way</strong>
          </div>
          <span className="mockup-line long" />
          <span className="mockup-line" />
          <span className="mockup-cover" />
          <span className="mockup-line short" />
        </div>
        <div className="mockup-zoom"><span>-</span><strong>100%</strong><span>+</span></div>
        <div className="mockup-action-dock">
          <span className="active">Select</span>
          <span>Text</span>
          <span>Whiteout</span>
          <span>More</span>
          <strong>Download</strong>
        </div>
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <main className="site-page modern-page" data-testid="site-about">
      <section className="page-hero marketing-hero about-hero">
        <div className="about-hero-copy">
          <span className="hero-kicker">About PDFMech</span>
          <h1>A simpler free PDF editor for everyday fixes.</h1>
          <ul className="hero-benefits">
            <li>Private browser-based PDF editing</li>
            <li>Focused tools instead of a crowded workspace</li>
            <li>No account, no upload queue, and no watermark</li>
          </ul>
          <button type="button" onClick={() => navigateTo("/editor")}>Open PDFMech</button>
        </div>
        <div className="about-hero-visual" aria-hidden="true">
          <span>PDF</span>
          <strong>Open. Edit. Download.</strong>
          <p>A focused workspace for everyday document changes.</p>
          <div><b>Local</b><b>Simple</b><b>Private</b></div>
        </div>
      </section>
      <section className="split-section">
        <div className="content-card">
          <span className="hero-kicker">The idea</span>
          <h2>Small PDF fixes should not feel heavy.</h2>
          <ul className="content-bullet-list">
            <li>Open a PDF without sending it to an editing server.</li>
            <li>Make focused changes without learning a publishing suite.</li>
            <li>Keep the original file and download a separate edited copy.</li>
          </ul>
        </div>
        <div className="content-card accent-card">
          <span className="hero-kicker">Built for quick edits</span>
          <FeatureList
            title="What PDFMech focuses on"
            items={[
              "No account required",
              "No watermark",
              "No server upload during local editing",
              "Local recovery",
              "Validated PDF exports",
            ]}
          />
        </div>
      </section>
      <BulletGuideSection
        kicker="Why PDFMech exists"
        title="Practical PDF tools with a clear purpose"
        intro="PDFMech is designed around the document jobs people need to finish quickly and confidently."
        cards={[
          { title: "Everyday document fixes", items: ["Add a date, name, note, label, or correction as a new text box.", "Visually cover outdated text, numbers, or other visible content.", "Rotate a sideways scan before sharing it.", "Download a clean new copy when the work is complete."] },
          { title: "Free PDF page organization", items: ["Delete a PDF page free from the edited copy.", "Move PDF pages up or down with dedicated controls.", "Use thumbnails to confirm page order at a glance.", "Navigate pages without accidentally changing their order."] },
          { title: "A calmer editor layout", items: ["Find primary actions in a floating dock close to the document.", "Keep the PDF large and readable without permanent side rails.", "Open contextual settings only after selecting an object.", "Use temporary More Tools and Pages sheets for secondary tasks."] },
          { title: "Comfortable object editing", items: ["Place one object per tool activation to avoid misclick duplicates.", "Reselect added text and continue editing it later.", "Move, resize, duplicate, or delete added objects.", "Use Undo and Redo to compare meaningful changes."] },
          { title: "Privacy-minded by design", items: ["Supported PDF work runs directly in your browser.", "No PDFMech account is required.", "No cloud document library is created for your files.", "Local recovery can stay in the browser when available."] },
          { title: "Clear and honest limits", items: ["Whiteout is a visual cover tool, not secure data removal.", "Browser memory can affect very large PDF documents.", "PDFMech adds text boxes rather than rewriting original PDF text.", "Every downloaded file should be reviewed before it is shared."] },
          { title: "Reliable finishing steps", items: ["Validate the generated PDF before download begins.", "Confirm page count, page order, text alignment, and cover edges.", "Keep the original PDF unchanged as a reference.", "Open the downloaded copy in your normal viewer for a final check."] },
          { title: "What guides development", items: ["Make common actions easy to find and understand.", "Use status messages that explain what changed.", "Give users more document space when they need it.", "Prioritize useful PDFMech improvements over unnecessary complexity."] },
        ]}
      />
      <section className="final-cta compact-cta">
        <span className="hero-kicker">Ready</span>
        <h2>Open a PDF and make the fix.</h2>
        <button type="button" onClick={() => navigateTo("/editor")}>
          Open PDF
        </button>
      </section>
    </main>
  );
}

function PrivacyPage() {
  return (
    <main className="site-page trust-page" data-testid="site-privacy">
      <section className="trust-hero">
        <div className="trust-hero-copy">
          <span className="hero-kicker">Privacy</span>
          <h1>Your PDF stays close to you.</h1>
          <ul className="hero-benefits">
            <li>Supported PDF editing happens in your browser</li>
            <li>No account is required to open the editor</li>
            <li>Local recovery remains on the current browser and device</li>
          </ul>
        </div>
        <div className="trust-hero-visual privacy-visual" aria-hidden="true">
          <span className="trust-shield">⌂</span>
          <strong>Local by design</strong>
          <small>Your browser is the editing workspace</small>
        </div>
      </section>
      <section className="trust-stat-grid" aria-label="PDFMech privacy summary">
        <article><strong>No editing upload</strong><span>Supported editing does not require sending your PDF to an editing server.</span></article>
        <article><strong>No account profile</strong><span>Start without creating a PDFMech user account.</span></article>
        <article><strong>Local recovery</strong><span>Optional session data stays in the browser that created it.</span></article>
      </section>
      <BulletGuideSection
        kicker="Privacy details"
        title="What stays local and what you control"
        intro="PDFMech uses a browser-first workflow so you can make supported edits without creating a cloud document account."
        cards={[
          { title: "PDF editing data", items: ["The PDF you open remains part of the local browser session.", "Text and visual objects you add are processed locally.", "Page deletion, movement, and rotation are applied in the editor.", "The edited PDF is generated for download on your device."] },
          { title: "Local recovery data", items: ["Recovery may save the source PDF and current editing state.", "The original filename and text you add may be included.", "This data is stored by the current browser on the current device.", "Anyone using the same browser profile may be able to access it."] },
          { title: "Your privacy controls", items: ["Choose whether to restore an available session.", "Use Clear document to remove the active work and checkpoint.", "Clear browser site data for additional local cleanup.", "Avoid local recovery on a shared or public device."] },
          { title: "Basic website information", items: ["Normal web hosting may process technical requests needed to deliver the site.", "Browsers and hosting infrastructure may handle IP address, user-agent, and request timing data.", "PDFMech does not require an account profile for the editor.", "Do not send sensitive PDFs through general support email."] },
          { title: "Downloaded files", items: ["Downloads are saved wherever your browser or device directs them.", "PDFMech does not control files after they are downloaded.", "Protect sensitive output using suitable device and file controls.", "Delete unwanted copies from downloads, backups, and shared folders."] },
          { title: "Before sharing", items: ["Review every edited page in a trusted PDF viewer.", "Check page order, added text, visual covers, and metadata.", "Whiteout is not guaranteed secure data removal.", "Use a specialist redaction tool for confidential information."] },
        ]}
      />
      <section className="trust-warning-card privacy-note">
        <span aria-hidden="true">i</span>
        <div><h2>Privacy includes the finished file</h2><p>Local processing reduces unnecessary document transfer, but you still control where the downloaded PDF is stored and who receives it. Review and protect the finished file before sharing.</p></div>
      </section>
    </main>
  );
}

function ContactPage() {
  return (
    <main className="site-page modern-page" data-testid="site-contact">
      <section className="page-hero marketing-hero contact-hero">
        <div className="contact-hero-copy">
          <span className="hero-kicker">Contact</span>
          <h1>Get clear PDFMech support.</h1>
          <ul className="hero-benefits">
            <li>Report a PDF opening or download problem</li>
            <li>Ask about text, page deletion, or page movement</li>
            <li>Share focused product feedback without sending your PDF</li>
          </ul>
          <a className="hero-email-button" href="mailto:muhammadrehan3192@gmail.com">Email support</a>
        </div>
        <div className="contact-hero-visual" aria-hidden="true">
          <span>✉</span>
          <strong>Talk to PDFMech</strong>
          <p>Send a clear description of the issue and the browser you used.</p>
          <small>Support · Feedback · PDF issues</small>
        </div>
      </section>
      <section className="split-section">
        <div className="content-card">
          <span className="hero-kicker">Support</span>
          <h2>Help us understand the issue.</h2>
          <ul className="content-bullet-list">
            <li>Describe the action, result, and result you expected.</li>
            <li>Include your browser, device, page count, and approximate file size.</li>
            <li>Avoid attaching sensitive or confidential PDFs.</li>
          </ul>
        </div>
        <div className="content-card accent-card contact-card">
          <span className="hero-kicker">Email</span>
          <h2>Support</h2>
          <ul className="content-bullet-list">
            <li>PDF editing questions</li>
            <li>Browser and export issues</li>
            <li>Feature requests and usability feedback</li>
          </ul>
          <a className="contact-email" href="mailto:muhammadrehan3192@gmail.com">
            Email PDFMech support
          </a>
        </div>
      </section>
      <BulletGuideSection
        kicker="Better support"
        title="Send the details that help us solve it"
        intro="You can explain most PDFMech problems without sharing the source document."
        cards={[
          { title: "PDF will not open", items: ["Include the browser and operating system you used.", "Share the approximate PDF file size and page count.", "Tell us whether a different PDF opens successfully.", "Mention any message PDFMech displayed."] },
          { title: "Text editing problem", items: ["Tell us whether you chose Text or reselected an existing text box.", "List the font, size, color, or alignment control that did not respond.", "Mention whether typing worked directly inside the selected box.", "A cropped interface screenshot is often enough for investigation."] },
          { title: "Whiteout or cover issue", items: ["Tell us whether placement, resizing, movement, color, or Pick from PDF caused the problem.", "Mention whether the Whiteout Properties sheet opened after selection.", "Do not send private text just to demonstrate the issue.", "Remember that PDFMech covers content visually rather than securely removing source data."] },
          { title: "PDF page delete help", items: ["Identify the selected page number and total page count.", "Tell us whether Delete Page was disabled or produced the wrong result.", "Confirm whether the thumbnail disappeared before download.", "Keep the original PDF available as your safe reference copy."] },
          { title: "PDF page move up or down", items: ["Share the page’s starting position and intended position.", "Specify whether you used Move up or Move down in the Pages sheet.", "Tell us whether thumbnails updated immediately.", "Confirm the order again in the downloaded PDF."] },
          { title: "Zoom or document dragging", items: ["Include the active zoom percentage.", "Confirm that Select was active and no placement tool was armed.", "Specify mouse, touchpad, touchscreen, or keyboard use.", "Describe whether horizontal dragging worked while vertical dragging failed."] },
          { title: "Download or export issue", items: ["Share the page where the downloaded result first looks different.", "Describe the affected text box, cover, rotation, or page order.", "Mention the PDF viewer used to inspect the result.", "Do not overwrite or discard the original source file."] },
          { title: "Privacy-safe reporting", items: ["Remove names, addresses, financial details, and confidential information from screenshots.", "Describe document structure instead of sending sensitive pages.", "A recreated sample PDF can demonstrate the same behavior safely.", "Email muhammadrehan3192@gmail.com when your report is ready."] },
        ]}
      />
      <section className="final-cta compact-cta">
        <span className="hero-kicker">Go to editor</span>
        <h2>Need to fix a PDF now?</h2>
        <button type="button" onClick={() => navigateTo("/editor")}>
          Open PDF
        </button>
      </section>
    </main>
  );
}

function SectionIntro({
  kicker,
  title,
  text,
}: {
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
}) {
  return (
    <section className="section-intro">
      <span className="hero-kicker">{kicker}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function TrustItem({
  icon,
  title,
  text,
}: {
  readonly icon: string;
  readonly title: string;
  readonly text: string;
}) {
  return (
    <article>
      <span className="trust-icon" aria-hidden="true">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </article>
  );
}

function FeatureCard({
  title,
  text,
  path,
}: {
  readonly title: string;
  readonly text: string;
  readonly path: string;
}) {
  return (
    <article className="content-card">
      <span className="home-tool-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function FeatureRow({
  feature,
  description,
  path,
}: {
  readonly feature: string;
  readonly description: string;
  readonly path: string;
}) {
  return (
    <article>
      <span className="feature-row-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
      </span>
      <strong>{feature}</strong>
      <span>{description}</span>
    </article>
  );
}

function ImageCard({
  src,
  alt,
  caption,
  width,
  height,
}: {
  readonly src: string;
  readonly alt: string;
  readonly caption: string;
  readonly width: number;
  readonly height: number;
}) {
  return (
    <figure className="image-card">
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
      />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function FeatureList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}) {
  return (
    <div className="feature-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({
  value,
  label,
}: {
  readonly value: string;
  readonly label: string;
}) {
  return (
    <article className="limit-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  readonly question: string;
  readonly answer: string;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const answerId = `faq-${question.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <article className="faq-accordion-item" data-open={open}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={answerId} onClick={onToggle}>
          <span>{question}</span><b aria-hidden="true">{open ? "−" : "+"}</b>
        </button>
      </h3>
      <div id={answerId} className="faq-answer" hidden={!open}><p>{answer}</p></div>
    </article>
  );
}
