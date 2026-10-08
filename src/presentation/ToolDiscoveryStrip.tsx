type ToolGroup = "Edit & Sign" | "Organize" | "Convert" | "Scan & Forms" | "Protect & Review";

interface ToolLink {
  readonly name: string;
  readonly description: string;
  readonly path: string;
  readonly group: ToolGroup;
  readonly mark: string;
}

const toolLinks: readonly ToolLink[] = [
  { name: "PDF Editor", description: "Add text, visual covers, and organize pages.", path: "/editor", group: "Edit & Sign", mark: "T" },
  { name: "Add Text", description: "Place and format new text on a PDF.", path: "/add-text-to-pdf", group: "Edit & Sign", mark: "Aa" },
  { name: "Sign PDF", description: "Draw, type, or upload a signature.", path: "/sign-pdf", group: "Edit & Sign", mark: "S" },
  { name: "Watermark PDF", description: "Add a text watermark to selected pages.", path: "/watermark-pdf", group: "Edit & Sign", mark: "W" },
  { name: "Whiteout (visual cover)", description: "Visually hide content for layout corrections.", path: "/whiteout-pdf", group: "Edit & Sign", mark: "□" },
  { name: "Merge PDF", description: "Combine several PDFs in your chosen order.", path: "/merge-pdf", group: "Organize", mark: "+" },
  { name: "Split PDF", description: "Divide a document by pages or ranges.", path: "/split-pdf", group: "Organize", mark: "↔" },
  { name: "Split & Rename", description: "Match PDF groups to CSV or TXT filenames.", path: "/split-pdf-and-rename", group: "Organize", mark: "CSV" },
  { name: "Compress PDF", description: "Reduce image-heavy PDF file sizes.", path: "/compress-pdf", group: "Organize", mark: "%" },
  { name: "Extract Pages", description: "Save selected pages as a new PDF.", path: "/extract-pdf-pages", group: "Organize", mark: "⇱" },
  { name: "Delete Pages", description: "Remove complete pages from a PDF.", path: "/delete-pdf-pages", group: "Organize", mark: "×" },
  { name: "Reorder Pages", description: "Put PDF pages in the correct sequence.", path: "/reorder-pdf-pages", group: "Organize", mark: "↕" },
  { name: "Rotate Pages", description: "Correct sideways or upside-down pages.", path: "/rotate-pdf-pages", group: "Organize", mark: "↻" },
  { name: "PDF to JPG", description: "Export PDF pages as JPG images.", path: "/pdf-to-jpg", group: "Convert", mark: "JPG" },
  { name: "JPG to PDF", description: "Arrange images into one printable PDF.", path: "/jpg-to-pdf", group: "Convert", mark: "PDF" },
  { name: "OCR PDF", description: "Make scanned PDF text searchable.", path: "/ocr-pdf", group: "Scan & Forms", mark: "OCR" },
  { name: "Deskew PDF", description: "Straighten crooked scanned pages.", path: "/deskew-pdf", group: "Scan & Forms", mark: "∠" },
  { name: "Fill PDF Forms", description: "Complete supported interactive form fields.", path: "/fill-pdf-form", group: "Scan & Forms", mark: "✓" },
  { name: "Flatten Forms", description: "Turn completed fields into fixed content.", path: "/flatten-pdf", group: "Scan & Forms", mark: "▤" },
  { name: "Bates Numbering", description: "Add continuous document page identifiers.", path: "/bates-numbering-pdf", group: "Scan & Forms", mark: "#" },
  { name: "Redact (permanent)", description: "Permanently remove marked page content.", path: "/redact-pdf", group: "Protect & Review", mark: "■" },
  { name: "Protect PDF", description: "Encrypt a PDF with an open password.", path: "/protect-pdf", group: "Protect & Review", mark: "●" },
  { name: "Unlock PDF", description: "Remove a password you already know.", path: "/unlock-pdf", group: "Protect & Review", mark: "○" },
  { name: "Remove Metadata", description: "Inspect and clear hidden document details.", path: "/remove-pdf-metadata", group: "Protect & Review", mark: "⌫" },
  { name: "Compare PDFs", description: "Review selectable text differences.", path: "/compare-pdf", group: "Protect & Review", mark: "⇄" },
] as const;

const preferredRelated: Readonly<Record<string, readonly string[]>> = {
  "/whiteout-pdf": ["/redact-pdf", "/add-text-to-pdf", "/editor", "/remove-pdf-metadata"],
  "/redact-pdf": ["/whiteout-pdf", "/remove-pdf-metadata", "/protect-pdf", "/compare-pdf"],
  "/ocr-pdf": ["/deskew-pdf", "/compress-pdf", "/pdf-to-jpg", "/editor"],
  "/fill-pdf-form": ["/flatten-pdf", "/sign-pdf", "/protect-pdf", "/editor"],
  "/flatten-pdf": ["/fill-pdf-form", "/sign-pdf", "/redact-pdf", "/protect-pdf"],
  "/sign-pdf": ["/fill-pdf-form", "/flatten-pdf", "/protect-pdf", "/editor"],
  "/split-pdf": ["/split-pdf-and-rename", "/extract-pdf-pages", "/merge-pdf", "/delete-pdf-pages"],
  "/split-pdf-and-rename": ["/split-pdf", "/extract-pdf-pages", "/merge-pdf", "/unlock-pdf"],
};

function relatedTools(currentPath: string): readonly ToolLink[] {
  const current = toolLinks.find((tool) => tool.path === currentPath);
  const preferred = preferredRelated[currentPath] ?? [];
  const paths = [
    ...preferred,
    ...toolLinks
      .filter((tool) => tool.path !== currentPath && tool.group === current?.group)
      .map((tool) => tool.path),
    ...toolLinks.filter((tool) => tool.path !== currentPath).map((tool) => tool.path),
  ];
  return [...new Set(paths)]
    .map((path) => toolLinks.find((tool) => tool.path === path))
    .filter((tool): tool is ToolLink => tool !== undefined)
    .slice(0, 4);
}

export function ToolDiscoveryStrip({ currentPath }: { readonly currentPath: string }) {
  const related = relatedTools(currentPath);
  if (related.length === 0) return null;

  return (
    <aside className="tool-discovery" aria-labelledby="tool-discovery-title">
      <header>
        <div>
          <span>Keep working</span>
          <h2 id="tool-discovery-title">Useful tools for your next PDF task</h2>
          <p>Choose a focused workflow. Supported processing stays in your browser.</p>
        </div>
        <a className="tool-discovery-all" href="/tools">View all PDF tools <span aria-hidden="true">→</span></a>
      </header>
      <div className="tool-discovery-grid">
        {related.map((tool) => (
          <a href={tool.path} key={tool.path} className="tool-discovery-card">
            <span className="tool-discovery-mark" aria-hidden="true">{tool.mark}</span>
            <span>
              <small>{tool.group}</small>
              <strong>{tool.name}</strong>
              <p>{tool.description}</p>
            </span>
            <b aria-hidden="true">→</b>
          </a>
        ))}
      </div>
    </aside>
  );
}
