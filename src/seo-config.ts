export const SITE_ORIGIN = "https://www.pdfmech.com";
export const SOCIAL_IMAGE_PATH = "/PDFMechLogo.png";

export type SeoPageKey =
  | "home"
  | "editor"
  | "addTextToPdf"
  | "deletePdfPages"
  | "reorderPdfPages"
  | "rotatePdfPages"
  | "whiteoutPdf"
  | "features"
  | "howItWorks"
  | "faq"
  | "security"
  | "terms"
  | "about"
  | "privacy"
  | "contact";

export interface SeoPageConfig {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly h1: string;
  readonly intro: string;
  readonly schemaType: "WebPage" | "AboutPage" | "ContactPage";
}

export const SEO_PAGES: Readonly<Record<SeoPageKey, SeoPageConfig>> = {
  home: {
    path: "/",
    title: "Free PDF Editor Online – Private & No Upload | PDFMech",
    description: "Edit PDFs online for free with PDFMech. Add text, cover content, rotate, reorder, or delete pages privately in your browser—no upload or account.",
    h1: "Edit your PDFs without uploading them.",
    intro: "A free online PDF editor for adding text, covering visible content, organizing pages, and downloading a new copy directly in your browser.",
    schemaType: "WebPage",
  },
  editor: {
    path: "/editor",
    title: "Free Online PDF Editor – Edit Privately | PDFMech",
    description: "Open a PDF and edit it free in your browser. Add text, cover content, rotate, reorder, or delete pages without uploading your file or creating an account.",
    h1: "Free browser PDF editor",
    intro: "Choose a PDF from your device and make common document edits locally in your browser.",
    schemaType: "WebPage",
  },
  addTextToPdf: {
    path: "/add-text-to-pdf",
    title: "Add Text to PDF Online Free - No Upload | PDFMech",
    description: "Add text to a PDF online for free with PDFMech. Choose a file, place editable text, adjust its font, size, color, and alignment, then download locally.",
    h1: "Add text to a PDF online for free.",
    intro: "Type on a PDF directly in your browser without sending the source document to an editing server or creating an account.",
    schemaType: "WebPage",
  },
  deletePdfPages: {
    path: "/delete-pdf-pages",
    title: "Delete PDF Pages Online Free - No Upload | PDFMech",
    description: "Delete unwanted PDF pages online for free with PDFMech. Select pages, remove them locally in your browser, and download a new PDF without uploading your file.",
    h1: "Delete PDF pages online for free.",
    intro: "Remove unwanted pages from a PDF locally in your browser, review the remaining document, and download a separate copy.",
    schemaType: "WebPage",
  },
  reorderPdfPages: {
    path: "/reorder-pdf-pages",
    title: "Reorder PDF Pages Online Free - No Upload | PDFMech",
    description: "Reorder PDF pages online for free with PDFMech. Select a page, move it earlier or later locally in your browser, and download a new PDF without uploading it.",
    h1: "Reorder PDF pages online for free.",
    intro: "Rearrange PDF pages locally in your browser, review the new sequence, and download a separate organized copy.",
    schemaType: "WebPage",
  },
  rotatePdfPages: {
    path: "/rotate-pdf-pages",
    title: "Rotate PDF Pages Online Free - No Upload | PDFMech",
    description: "Rotate PDF pages online for free with PDFMech. Turn sideways or upside-down pages locally in your browser and download a new PDF without uploading it.",
    h1: "Rotate PDF pages online for free.",
    intro: "Turn PDF pages clockwise in your browser, review their orientation, and download a separate corrected copy.",
    schemaType: "WebPage",
  },
  whiteoutPdf: {
    path: "/whiteout-pdf",
    title: "White Out PDF Online Free - Visual Cover | PDFMech",
    description: "White out visible PDF content online for free with PDFMech. Add a visual cover locally in your browser and download a new copy without uploading your file.",
    h1: "White out PDF content online for free.",
    intro: "Place a visual cover over visible PDF content in your browser, adjust its color and position, and download a separate copy.",
    schemaType: "WebPage",
  },
  features: {
    path: "/features",
    title: "Free PDF Editing Tools & Features | PDFMech",
    description: "Explore free PDF tools to add text, cover visible content, rotate pages, reorder or delete pages, undo changes, and recover work locally in your browser.",
    h1: "Everything you need for quick PDF edits.",
    intro: "Focused browser-based PDF tools for text changes, page organization, local recovery, and checked downloads.",
    schemaType: "WebPage",
  },
  howItWorks: {
    path: "/how-it-works",
    title: "How to Edit a PDF Online for Free | PDFMech",
    description: "Learn how to edit a PDF online for free: open a file, add text or visual covers, organize pages, review your changes, and download a new PDF copy.",
    h1: "Free PDF editing in three clear steps.",
    intro: "Open your PDF, make focused edits, review the document, and download a separate finished copy.",
    schemaType: "WebPage",
  },
  faq: {
    path: "/faq",
    title: "Free PDF Editor FAQ & Help | PDFMech",
    description: "Answers about free PDF editing, privacy, adding text, visual whiteout, deleting or reordering pages, local recovery, and downloading your edited PDF.",
    h1: "Free PDF editor questions, answered.",
    intro: "Clear answers about PDFMech tools, local browser processing, recovery, downloads, and product limits.",
    schemaType: "WebPage",
  },
  security: {
    path: "/security",
    title: "PDF Editor Security & Local Processing | PDFMech",
    description: "Learn how PDFMech processes supported PDF edits locally in your browser, what recovery data is stored, and the limits of visual whiteout for sensitive information.",
    h1: "PDF editing built around local processing.",
    intro: "Understand PDFMech's browser-based security model, user controls, and important product limits.",
    schemaType: "WebPage",
  },
  terms: {
    path: "/terms",
    title: "Terms of Service | PDFMech",
    description: "Read the terms for using PDFMech, including acceptable use, browser-local processing, download responsibilities, service limits, and availability.",
    h1: "Clear terms for using PDFMech.",
    intro: "The conditions and responsibilities that apply when you use PDFMech's browser-based PDF tools.",
    schemaType: "WebPage",
  },
  about: {
    path: "/about",
    title: "About PDFMech – Private Browser PDF Editing",
    description: "Learn why PDFMech was built: to make everyday PDF fixes simpler with free, focused editing tools that work locally in your browser.",
    h1: "A simpler free PDF editor for everyday fixes.",
    intro: "PDFMech focuses on practical PDF changes without an account, an upload queue, or an unnecessary cloud document library.",
    schemaType: "AboutPage",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy Policy – Local PDF Editing | PDFMech",
    description: "Learn how PDFMech handles source PDFs, browser-local editing and recovery data, downloads, contact messages, and your privacy choices.",
    h1: "Your PDF stays close to you.",
    intro: "A clear explanation of local PDF processing, browser recovery data, and the information you control.",
    schemaType: "WebPage",
  },
  contact: {
    path: "/contact",
    title: "Contact PDFMech Support",
    description: "Contact PDFMech for help with opening PDFs, adding text, visual covers, page organization, browser issues, recovery, or downloading an edited file.",
    h1: "Get clear PDFMech support.",
    intro: "Find focused help for PDF editing questions, browser issues, recovery, and downloads without sharing a sensitive source document.",
    schemaType: "ContactPage",
  },
};

export const SEO_PAGE_KEYS = Object.keys(SEO_PAGES) as readonly SeoPageKey[];

export const FAQ_SCHEMA_ITEMS = [
  {
    question: "Is PDFMech a free PDF editor?",
    answer: "PDFMech is currently free to use. No account is required, and downloaded PDFs do not receive a PDFMech watermark.",
  },
  {
    question: "Is my PDF uploaded?",
    answer: "PDFMech is designed to process supported edits locally in your browser rather than sending the source PDF to an editing server.",
  },
  {
    question: "Can I add or change text?",
    answer: "Yes. The Text tool creates a new editable text box whose font, size, color, style, and alignment you can adjust.",
  },
  {
    question: "Can I delete PDF pages free?",
    answer: "Yes. Select the unwanted page, use Delete Page from More Tools, and review the new page count before downloading. Your original PDF remains unchanged.",
  },
  {
    question: "Can I remove PDF text free?",
    answer: "No. Whiteout adds a visual cover and is not guaranteed to remove underlying PDF text, metadata, or other data.",
  },
] as const;

export interface SeoFaqItem {
  readonly question: string;
  readonly answer: string;
}

export const TOOL_ROUTE_FAQS: Readonly<
  Partial<Record<SeoPageKey, readonly SeoFaqItem[]>>
> = {
  addTextToPdf: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. Supported editing happens locally in your browser. Local recovery may save a copy in this browser on your device.",
    },
    {
      question: "Can I edit text that is already inside the PDF?",
      answer: "Not directly. PDFMech currently adds new editable text boxes above the original page.",
    },
    {
      question: "Can I match the existing text color?",
      answer: "Yes. Use a preset, enter a color, or use Pick from PDF to sample a visible page color.",
    },
    {
      question: "Will PDFMech replace my original file?",
      answer: "No. Download creates a separate edited PDF and leaves the source file unchanged.",
    },
  ],
  deletePdfPages: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. Supported editing happens locally in your browser. Local recovery may save a copy in this browser on your device.",
    },
    {
      question: "Can I remove more than one PDF page?",
      answer: "Yes. Select and delete unwanted pages one at a time, reviewing the page count after each change.",
    },
    {
      question: "What if I delete the wrong page?",
      answer: "Use Undo before downloading to restore the most recently deleted page.",
    },
    {
      question: "Does this change my original PDF?",
      answer: "No. PDFMech downloads a separate edited PDF and leaves the source file on your device unchanged.",
    },
  ],
  reorderPdfPages: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. Supported editing happens locally in your browser. Local recovery may save a copy in this browser on your device.",
    },
    {
      question: "Can I move a PDF page more than once?",
      answer: "Yes. Keep the page selected and use Move up or Move down repeatedly until it reaches the correct position.",
    },
    {
      question: "Can I undo a page move?",
      answer: "Yes. Use Undo before downloading to reverse the most recent page-order change.",
    },
    {
      question: "Does reordering replace my original PDF?",
      answer: "No. PDFMech downloads a separate organized PDF and leaves the source file unchanged.",
    },
  ],
  rotatePdfPages: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. Supported editing happens locally in your browser. Local recovery may save a copy in this browser on your device.",
    },
    {
      question: "How far does each rotation turn a page?",
      answer: "Each action rotates the selected PDF page 90 degrees clockwise. Use it twice for a 180-degree correction.",
    },
    {
      question: "Can I rotate only one PDF page?",
      answer: "Yes. Rotation applies to the currently selected page, so other pages keep their existing orientation.",
    },
    {
      question: "Does rotation replace my original PDF?",
      answer: "No. PDFMech downloads a separate corrected PDF and leaves the source file unchanged.",
    },
  ],
  whiteoutPdf: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. Supported editing happens locally in your browser. Local recovery may save a copy in this browser on your device.",
    },
    {
      question: "Can I match an off-white page color?",
      answer: "Yes. Select a whiteout cover and use its color controls or the page color picker to choose a better visual match.",
    },
    {
      question: "Does whiteout securely remove private text?",
      answer: "No. Whiteout is a visual cover, not secure redaction. It does not guarantee removal of underlying PDF data.",
    },
    {
      question: "Does whiteout replace my original PDF?",
      answer: "No. PDFMech downloads a separate visually edited PDF and leaves the source file unchanged.",
    },
  ],
};

export const TOOL_SEO_PAGE_KEYS = [
  "addTextToPdf",
  "deletePdfPages",
  "reorderPdfPages",
  "rotatePdfPages",
  "whiteoutPdf",
] as const satisfies readonly SeoPageKey[];

export function canonicalUrl(page: SeoPageKey): string {
  return `${SITE_ORIGIN}${SEO_PAGES[page].path}`;
}

export function buildStructuredData(page: SeoPageKey): Record<string, unknown> {
  const config = SEO_PAGES[page];
  const url = canonicalUrl(page);
  const organizationId = `${SITE_ORIGIN}/#organization`;
  const websiteId = `${SITE_ORIGIN}/#website`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: "PDFMech",
      url: `${SITE_ORIGIN}/`,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_ORIGIN}${SOCIAL_IMAGE_PATH}`,
      },
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      name: "PDFMech",
      url: `${SITE_ORIGIN}/`,
      publisher: { "@id": organizationId },
    },
    {
      "@type": config.schemaType,
      "@id": `${url}#webpage`,
      url,
      name: config.title,
      description: config.description,
      isPartOf: { "@id": websiteId },
      about: { "@id": organizationId },
      inLanguage: "en",
    },
  ];

  if (page !== "home") {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
        { "@type": "ListItem", position: 2, name: config.h1, item: url },
      ],
    });
  }

  if (
    page === "home" ||
    page === "editor" ||
    page === "addTextToPdf" ||
    page === "deletePdfPages" ||
    page === "reorderPdfPages" ||
    page === "rotatePdfPages" ||
    page === "whiteoutPdf"
  ) {
    graph.push({
      "@type": "WebApplication",
      name: "PDFMech",
      url,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "PDF editor",
      operatingSystem: "Any operating system with a modern web browser",
      browserRequirements: "Requires JavaScript and a modern web browser",
      description: config.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
  }

  const faqItems = page === "faq" ? FAQ_SCHEMA_ITEMS : TOOL_ROUTE_FAQS[page];
  if (faqItems !== undefined) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }

  if (page === "features") {
    graph.push({
      "@type": "ItemList",
      "@id": `${url}#pdf-tools`,
      name: "PDFMech free PDF tools",
      numberOfItems: TOOL_SEO_PAGE_KEYS.length,
      itemListElement: TOOL_SEO_PAGE_KEYS.map((toolPage, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: SEO_PAGES[toolPage].h1,
        url: canonicalUrl(toolPage),
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
