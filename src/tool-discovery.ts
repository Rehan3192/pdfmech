export type ToolGroup = "Edit & Sign" | "Organize" | "Convert" | "Scan & Forms" | "Protect & Review";

export interface ToolLink {
  readonly name: string;
  readonly description: string;
  readonly path: string;
  readonly group: ToolGroup;
  readonly mark: string;
}

export interface GuideLink {
  readonly title: string;
  readonly path: string;
}

export const TOOL_DISCOVERY_LINKS: readonly ToolLink[] = [
  { name: "PDF Editor", description: "Add text, visual covers, and organize pages.", path: "/editor", group: "Edit & Sign", mark: "T" },
  { name: "Add Text", description: "Place and format new text on a PDF.", path: "/add-text-to-pdf", group: "Edit & Sign", mark: "Aa" },
  { name: "Edit PDF on iPhone", description: "Follow the Safari and Files workflow.", path: "/edit-pdf-on-iphone", group: "Edit & Sign", mark: "iOS" },
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
  "/editor": ["/add-text-to-pdf", "/edit-pdf-on-iphone", "/whiteout-pdf", "/reorder-pdf-pages"],
  "/add-text-to-pdf": ["/edit-pdf-on-iphone", "/editor", "/fill-pdf-form", "/sign-pdf"],
  "/edit-pdf-on-iphone": ["/editor", "/add-text-to-pdf", "/whiteout-pdf", "/rotate-pdf-pages"],
  "/private-pdf-editor": ["/edit-pdf-on-iphone", "/editor", "/redact-pdf", "/protect-pdf"],
  "/whiteout-pdf": ["/redact-pdf", "/add-text-to-pdf", "/editor", "/remove-pdf-metadata"],
  "/redact-pdf": ["/whiteout-pdf", "/remove-pdf-metadata", "/protect-pdf", "/compare-pdf"],
  "/ocr-pdf": ["/deskew-pdf", "/compress-pdf", "/pdf-to-jpg", "/editor"],
  "/fill-pdf-form": ["/flatten-pdf", "/sign-pdf", "/protect-pdf", "/editor"],
  "/flatten-pdf": ["/fill-pdf-form", "/sign-pdf", "/redact-pdf", "/protect-pdf"],
  "/sign-pdf": ["/fill-pdf-form", "/flatten-pdf", "/protect-pdf", "/editor"],
  "/split-pdf": ["/split-pdf-and-rename", "/extract-pdf-pages", "/merge-pdf", "/delete-pdf-pages"],
  "/split-pdf-and-rename": ["/split-pdf", "/extract-pdf-pages", "/merge-pdf", "/unlock-pdf"],
};

const guideByToolPath: Readonly<Record<string, GuideLink>> = {
  "/editor": { title: "Why can’t I type on a PDF?", path: "/blog/why-cant-i-type-on-a-pdf-how-to-fix-it-for-free" },
  "/add-text-to-pdf": { title: "Why can’t I type on a PDF?", path: "/blog/why-cant-i-type-on-a-pdf-how-to-fix-it-for-free" },
  "/edit-pdf-on-iphone": { title: "Why can’t I type on a PDF?", path: "/blog/why-cant-i-type-on-a-pdf-how-to-fix-it-for-free" },
  "/fill-pdf-form": { title: "Why can’t I type on a PDF?", path: "/blog/why-cant-i-type-on-a-pdf-how-to-fix-it-for-free" },
  "/ocr-pdf": { title: "How to make a scanned PDF searchable", path: "/blog/how-to-make-a-scanned-pdf-searchable" },
  "/deskew-pdf": { title: "How to make a scanned PDF searchable", path: "/blog/how-to-make-a-scanned-pdf-searchable" },
  "/split-pdf": { title: "How to split and rename PDF files", path: "/blog/how-to-split-a-pdf-and-rename-each-file" },
  "/split-pdf-and-rename": { title: "How to split and rename PDF files", path: "/blog/how-to-split-a-pdf-and-rename-each-file" },
  "/extract-pdf-pages": { title: "How to split and rename PDF files", path: "/blog/how-to-split-a-pdf-and-rename-each-file" },
};

export function relatedTools(currentPath: string): readonly ToolLink[] {
  const current = TOOL_DISCOVERY_LINKS.find((tool) => tool.path === currentPath);
  const preferred = preferredRelated[currentPath] ?? [];
  if (current === undefined && preferred.length === 0) return [];

  const paths = [
    ...preferred,
    ...TOOL_DISCOVERY_LINKS
      .filter((tool) => tool.path !== currentPath && tool.group === current?.group)
      .map((tool) => tool.path),
    ...TOOL_DISCOVERY_LINKS
      .filter((tool) => tool.path !== currentPath)
      .map((tool) => tool.path),
  ];
  return [...new Set(paths)]
    .map((path) => TOOL_DISCOVERY_LINKS.find((tool) => tool.path === path))
    .filter((tool): tool is ToolLink => tool !== undefined)
    .slice(0, 4);
}

export function guideForToolPath(path: string): GuideLink | null {
  return guideByToolPath[path] ?? null;
}
