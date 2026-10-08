import { useState } from "react";

interface HomePageRedesignProps {
  readonly onNavigate: (path: string) => void;
}

const popularTools = [
  { name: "PDF Editor", text: "Add text, cover content, and organize pages.", path: "/editor", mark: "T", tone: "blue" },
  { name: "Compress PDF", text: "Reduce large, image-heavy PDF files.", path: "/compress-pdf", mark: "%", tone: "green" },
  { name: "Merge PDF", text: "Combine PDFs in the order you choose.", path: "/merge-pdf", mark: "+", tone: "orange" },
  { name: "OCR PDF", text: "Make scanned PDFs searchable.", path: "/ocr-pdf", mark: "OCR", tone: "purple" },
  { name: "Fill PDF Forms", text: "Complete supported form fields.", path: "/fill-pdf-form", mark: "✓", tone: "blue" },
  { name: "Sign PDF", text: "Draw, type, or upload a signature.", path: "/sign-pdf", mark: "S", tone: "green" },
  { name: "Redact PDF", text: "Permanently remove marked content.", path: "/redact-pdf", mark: "■", tone: "orange" },
  { name: "JPG to PDF", text: "Arrange images into one PDF.", path: "/jpg-to-pdf", mark: "JPG", tone: "purple" },
] as const;

const categories = [
  { title: "Edit & sign", text: "Make visible changes and complete documents.", links: [["PDF Editor", "/editor"], ["Add Text", "/add-text-to-pdf"], ["Sign PDF", "/sign-pdf"]] },
  { title: "Organize", text: "Fix page order and build the document you need.", links: [["Merge PDF", "/merge-pdf"], ["Split PDF", "/split-pdf"], ["Extract Pages", "/extract-pdf-pages"]] },
  { title: "Scan & forms", text: "Work with scans and interactive documents.", links: [["OCR PDF", "/ocr-pdf"], ["Deskew PDF", "/deskew-pdf"], ["Fill Forms", "/fill-pdf-form"]] },
  { title: "Protect & review", text: "Prepare documents for safer sharing.", links: [["Redact PDF", "/redact-pdf"], ["Protect PDF", "/protect-pdf"], ["Remove Metadata", "/remove-pdf-metadata"]] },
] as const;

const homeFaqs = [
  { question: "Are my files uploaded?", answer: "No. Supported PDF processing runs locally in your browser. Your source file is not sent to a PDFMech editing server." },
  { question: "Is PDFMech free?", answer: "Yes. The available PDFMech tools are free to use without creating an account or adding a watermark." },
  { question: "Does PDFMech replace my original file?", answer: "No. Tools create a separate download and leave the original file on your device unchanged." },
  { question: "What is the difference between whiteout and redaction?", answer: "Whiteout is a visual cover for layout corrections. Secure redaction rebuilds marked pages so the selected underlying page content is not retained." },
] as const;

export function HomePageRedesign({ onNavigate }: HomePageRedesignProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="site-page home-redesign" data-testid="site-home">
      <section className="home-direct-hero">
        <div className="home-direct-copy">
          <span className="hero-kicker">25 free PDF tools · browser-local</span>
          <h1>Work with PDFs privately in your browser.</h1>
          <p>Edit, organize, convert, scan, sign, and protect PDF files without sending supported documents to an editing server.</p>
          <div className="home-direct-actions">
            <button type="button" onClick={() => onNavigate("/tools")}>Choose a PDF tool</button>
            <button type="button" className="secondary" onClick={() => onNavigate("/editor")}>Open PDF editor</button>
          </div>
          <div className="home-proof-row" aria-label="PDFMech benefits">
            <span><b>✓</b> No upload</span><span><b>✓</b> No account</span><span><b>✓</b> No watermark</span>
          </div>
        </div>
        <aside className="home-tool-finder" aria-label="Quick PDF tool choices">
          <div className="home-tool-finder-head"><span>Start with a task</span><strong>What do you need to do?</strong></div>
          <a href="/editor"><span>T</span><div><strong>Edit a PDF</strong><small>Add text, visual covers, or manage pages</small></div><b>→</b></a>
          <a href="/compress-pdf"><span>%</span><div><strong>Make a PDF smaller</strong><small>Compress image-heavy documents</small></div><b>→</b></a>
          <a href="/ocr-pdf"><span>OCR</span><div><strong>Search a scanned PDF</strong><small>Recognize text without an OCR upload</small></div><b>→</b></a>
          <a href="/redact-pdf"><span>■</span><div><strong>Remove private content</strong><small>Apply permanent page redactions</small></div><b>→</b></a>
          <a className="home-tool-finder-all" href="/tools">Browse all 25 tools <b>→</b></a>
        </aside>
      </section>

      <section className="home-popular" aria-labelledby="home-popular-title">
        <HomeSectionHeading eyebrow="Popular tools" title="Get the PDF job done." id="home-popular-title">Choose one focused tool instead of learning a crowded desktop application.</HomeSectionHeading>
        <div className="home-popular-grid">
          {popularTools.map((tool) => (
            <a href={tool.path} key={tool.path} className={`home-popular-card is-${tool.tone}`}>
              <span aria-hidden="true">{tool.mark}</span><div><strong>{tool.name}</strong><p>{tool.text}</p></div><b aria-hidden="true">→</b>
            </a>
          ))}
        </div>
        <a className="home-all-tools-link" href="/tools">See every PDFMech tool <span aria-hidden="true">→</span></a>
      </section>

      <section className="home-categories" aria-labelledby="home-categories-title">
        <HomeSectionHeading eyebrow="Find your workflow" title="Built around the task, not the software." id="home-categories-title">Each page explains what changes, what stays local, and what to verify before sharing.</HomeSectionHeading>
        <div className="home-category-grid">
          {categories.map((category, index) => (
            <article key={category.title}>
              <span className="home-category-number">0{index + 1}</span><h3>{category.title}</h3><p>{category.text}</p>
              <nav aria-label={`${category.title} tools`}>{category.links.map(([label, path]) => <a href={path} key={path}>{label}<span aria-hidden="true">→</span></a>)}</nav>
            </article>
          ))}
        </div>
      </section>

      <section className="home-why" aria-labelledby="home-why-title">
        <header><span>Why PDFMech</span><h2 id="home-why-title">A smaller, more private way to work with PDFs.</h2><p>Designed for common document tasks where speed, clarity, and keeping the file on your device matter.</p></header>
        <div>
          <article><span>01</span><h3>Your file stays with you</h3><p>Supported processing happens locally in the browser. There is no document upload queue.</p></article>
          <article><span>02</span><h3>One clear job per tool</h3><p>Open the workflow you need, review its limits, and download a separate result.</p></article>
          <article><span>03</span><h3>Free without an account</h3><p>Start immediately, with no signup wall and no PDFMech watermark on the output.</p></article>
        </div>
      </section>

      <section className="home-cover-choice" aria-labelledby="home-cover-choice-title">
        <header><span>Choose the right privacy tool</span><h2 id="home-cover-choice-title">Hide visually or remove permanently?</h2><p>These tools look similar on the page, but they are meant for different outcomes.</p></header>
        <div>
          <article className="is-whiteout"><span>Visual correction</span><h3>Whiteout adds a cover.</h3><p>Use it to hide outdated text visually or match a page background. It does not guarantee removal of underlying PDF data.</p><a href="/whiteout-pdf">Use visual whiteout <b aria-hidden="true">→</b></a></article>
          <article className="is-redaction"><span>Sensitive information</span><h3>Redaction removes marked content.</h3><p>Use it before sharing confidential documents. Marked pages are rebuilt with the selected areas permanently baked out.</p><a href="/redact-pdf">Use secure redaction <b aria-hidden="true">→</b></a></article>
        </div>
      </section>

      <section className="home-simple-flow" aria-labelledby="home-flow-title">
        <header><span>Simple by design</span><h2 id="home-flow-title">Choose. Work locally. Download.</h2></header>
        <ol>
          <li><span>1</span><div><strong>Choose a tool</strong><p>Start with the exact PDF task you need.</p></div></li>
          <li><span>2</span><div><strong>Work in your browser</strong><p>Review the document and make supported changes locally.</p></div></li>
          <li><span>3</span><div><strong>Download a new copy</strong><p>Keep the original and check the result before sharing.</p></div></li>
        </ol>
      </section>

      <section className="home-faq" aria-labelledby="home-faq-title">
        <HomeSectionHeading eyebrow="Quick answers" title="Before you choose a file." id="home-faq-title">The important details without a wall of text.</HomeSectionHeading>
        <div className="home-faq-list">
          {homeFaqs.map((item, index) => (
            <article key={item.question} data-open={openFaq === index ? "true" : "false"}>
              <h3><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq((current) => current === index ? null : index)}><span>{item.question}</span><b aria-hidden="true">{openFaq === index ? "−" : "+"}</b></button></h3>
              {openFaq === index ? <p>{item.answer}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="home-final-cta">
        <div><span>Ready to begin?</span><h2>Choose the PDF task. Keep the file on your device.</h2></div>
        <button type="button" onClick={() => onNavigate("/tools")}>Explore all PDF tools</button>
      </section>
    </main>
  );
}

function HomeSectionHeading({ eyebrow, title, id, children }: { readonly eyebrow: string; readonly title: string; readonly id: string; readonly children: string }) {
  return <header className="home-section-heading"><div><span>{eyebrow}</span><h2 id={id}>{title}</h2></div><p>{children}</p></header>;
}
