import { useMemo, useState } from "react";

type ToolCategory = "Edit & Annotate" | "Organize PDF" | "Scan & Forms" | "Privacy & Review";

interface DirectoryTool {
  readonly name: string;
  readonly description: string;
  readonly path: string;
  readonly category: ToolCategory;
  readonly icon: string;
  readonly tone: "blue" | "cyan" | "green" | "orange" | "purple";
  readonly keywords: string;
}

const categories = ["All tools", "Edit & Annotate", "Organize PDF", "Scan & Forms", "Privacy & Review"] as const;

const tools: readonly DirectoryTool[] = [
  { name: "PDF Editor", description: "Open a PDF and make supported text, whiteout, and page changes.", path: "/editor", category: "Edit & Annotate", icon: "PDF", tone: "blue", keywords: "edit annotate document" },
  { name: "Add Text to PDF", description: "Place new text boxes and adjust font, size, color, and alignment.", path: "/add-text-to-pdf", category: "Edit & Annotate", icon: "T", tone: "purple", keywords: "type write font" },
  { name: "White Out PDF", description: "Cover visible page content with an adjustable visual whiteout layer.", path: "/whiteout-pdf", category: "Edit & Annotate", icon: "▱", tone: "cyan", keywords: "cover hide visual" },
  { name: "Merge PDF", description: "Arrange several PDFs and combine their native pages into one document.", path: "/merge-pdf", category: "Organize PDF", icon: "⊕", tone: "orange", keywords: "combine join files" },
  { name: "Split PDF", description: "Create one PDF per page or divide a document into custom page ranges.", path: "/split-pdf", category: "Organize PDF", icon: "↔", tone: "blue", keywords: "separate divide ranges chapters" },
  { name: "Compress PDF", description: "Reduce scanned and image-heavy PDF sizes with three quality levels.", path: "/compress-pdf", category: "Organize PDF", icon: "%", tone: "green", keywords: "reduce shrink optimize file size scan image" },
  { name: "Extract PDF Pages", description: "Select page thumbnails or ranges and save them as a separate PDF.", path: "/extract-pdf-pages", category: "Organize PDF", icon: "⇱", tone: "green", keywords: "separate select pages" },
  { name: "Delete PDF Pages", description: "Remove complete unwanted pages and download a separate copy.", path: "/delete-pdf-pages", category: "Organize PDF", icon: "×", tone: "orange", keywords: "remove pages" },
  { name: "Reorder PDF Pages", description: "Move pages earlier or later and export the corrected sequence.", path: "/reorder-pdf-pages", category: "Organize PDF", icon: "↕", tone: "blue", keywords: "arrange order move pages" },
  { name: "Rotate PDF Pages", description: "Correct sideways or upside-down pages in your browser.", path: "/rotate-pdf-pages", category: "Organize PDF", icon: "↻", tone: "purple", keywords: "turn orientation pages" },
  { name: "OCR PDF", description: "Recognize printed text and make scanned PDFs searchable.", path: "/ocr-pdf", category: "Scan & Forms", icon: "OCR", tone: "blue", keywords: "scan searchable text recognition" },
  { name: "Deskew PDF", description: "Automatically straighten crooked scanned PDF pages.", path: "/deskew-pdf", category: "Scan & Forms", icon: "∠", tone: "cyan", keywords: "straighten crooked scan" },
  { name: "Flatten PDF Forms", description: "Turn supported completed form fields into fixed page content.", path: "/flatten-pdf", category: "Scan & Forms", icon: "▤", tone: "green", keywords: "form fields non editable" },
  { name: "Bates Numbering PDF", description: "Add continuous page identifiers across one or multiple PDFs.", path: "/bates-numbering-pdf", category: "Scan & Forms", icon: "#", tone: "orange", keywords: "legal page numbers identifiers" },
  { name: "Remove PDF Metadata", description: "Inspect and clear supported hidden document properties and XMP data.", path: "/remove-pdf-metadata", category: "Privacy & Review", icon: "⌫", tone: "green", keywords: "privacy author title hidden data" },
  { name: "Compare PDFs", description: "Find added and removed selectable text page by page.", path: "/compare-pdf", category: "Privacy & Review", icon: "⇄", tone: "purple", keywords: "difference diff versions review" },
  { name: "Secure PDF Redaction", description: "Permanently remove selected text and graphics from marked PDF pages.", path: "/redact-pdf", category: "Privacy & Review", icon: "■", tone: "orange", keywords: "redact permanent remove sensitive confidential privacy" },
  { name: "Protect PDF", description: "Encrypt a PDF with an AES-256 open password entirely in your browser.", path: "/protect-pdf", category: "Privacy & Review", icon: "🔒", tone: "blue", keywords: "password lock encrypt secure aes protection" },
  { name: "Unlock PDF", description: "Remove a known PDF password and download a separate unencrypted copy.", path: "/unlock-pdf", category: "Privacy & Review", icon: "🔓", tone: "cyan", keywords: "password unlock decrypt remove restrictions known password" },
  { name: "Private PDF Editor", description: "Learn how PDFMech processes supported edits locally in your browser.", path: "/private-pdf-editor", category: "Privacy & Review", icon: "⌂", tone: "cyan", keywords: "local browser no upload security" },
] as const;

export function ToolsDirectoryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All tools");
  const filteredTools = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");
    return tools.filter((tool) => {
      const matchesCategory = category === "All tools" || tool.category === category;
      const searchable = `${tool.name} ${tool.description} ${tool.category} ${tool.keywords}`.toLocaleLowerCase("en");
      return matchesCategory && (normalizedQuery === "" || searchable.includes(normalizedQuery));
    });
  }, [category, query]);

  return (
    <main className="tools-directory" data-testid="site-tools-directory">
      <section className="tools-directory-hero">
        <span className="hero-kicker">PDFMECH TOOLBOX</span>
        <h1>Free PDF tools that work in your browser.</h1>
        <p>Choose a focused tool for editing, organizing, scanning, forms, privacy, or document review. Supported processing stays on your device.</p>
        <div className="tools-directory-proof" aria-label="PDFMech tool benefits"><span><b>✓</b> Free to use</span><span><b>⌂</b> Browser-local</span><span><b>○</b> No account</span></div>
      </section>

      <section className="tools-directory-browser" aria-labelledby="tools-directory-title">
        <div className="tools-directory-controls">
          <div><h2 id="tools-directory-title">Choose your PDF tool</h2><p>{tools.length} focused tools available now</p></div>
          <label><b aria-hidden="true">⌕</b><input type="search" aria-label="Search PDF tools" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search PDF tools" /></label>
        </div>
        <div className="tools-directory-filters" role="group" aria-label="Filter tools by category">
          {categories.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        {filteredTools.length > 0 ? (
          <div className="tools-directory-grid">
            {filteredTools.map((tool) => (
              <a href={tool.path} key={tool.path} className={`tools-directory-card is-${tool.tone}`}>
                <span className="tools-directory-icon" aria-hidden="true">{tool.icon}</span>
                <span className="tools-directory-category">{tool.category}</span>
                <h2>{tool.name}</h2>
                <p>{tool.description}</p>
                <strong>Open tool <i aria-hidden="true">→</i></strong>
              </a>
            ))}
          </div>
        ) : <div className="tools-directory-empty"><strong>No matching tools found.</strong><p>Try another search or select All tools.</p><button type="button" onClick={() => { setQuery(""); setCategory("All tools"); }}>Show all tools</button></div>}
      </section>

      <section className="tools-directory-explainer"><article><span>1</span><h2>Choose a focused workflow</h2><p>Each page is designed around one PDF task instead of a crowded all-purpose interface.</p></article><article><span>2</span><h2>Work locally</h2><p>Source PDFs remain in your browser during supported processing and download.</p></article><article><span>3</span><h2>Review the limits</h2><p>Every tool explains what changes, what stays untouched, and what may not transfer.</p></article></section>
    </main>
  );
}
