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
  | "ocrPdf"
  | "batesNumberingPdf"
  | "flattenPdf"
  | "deskewPdf"
  | "metadataPdf"
  | "comparePdf"
  | "extractPdfPages"
  | "mergePdf"
  | "splitPdf"
  | "compressPdf"
  | "redactPdf"
  | "protectPdf"
  | "unlockPdf"
  | "pdfToJpg"
  | "jpgToPdf"
  | "tools"
  | "privatePdfEditor"
  | "editPdfOnIphone"
  | "features"
  | "howItWorks"
  | "blog"
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
  ocrPdf: {
    path: "/ocr-pdf",
    title: "OCR PDF Online Free - Make Scans Searchable | PDFMech",
    description: "Use free OCR to make scanned PDFs searchable in your browser. Add an invisible text layer and download searchable PDF and TXT files without uploading.",
    h1: "Make scanned PDFs searchable.",
    intro: "Convert scanned and image-based documents into searchable PDFs with private, browser-local OCR and no account.",
    schemaType: "WebPage",
  },
  batesNumberingPdf: {
    path: "/bates-numbering-pdf",
    title: "Bates Numbering PDF Online Free - No Upload | PDFMech",
    description: "Add continuous Bates numbers to one or multiple PDFs for free. Set prefixes, suffixes, digits, page ranges, and positions locally without uploading files.",
    h1: "Add Bates numbers to PDFs privately.",
    intro: "Apply continuous page identifiers across one or multiple PDFs locally in your browser, with precise sequence and position controls.",
    schemaType: "WebPage",
  },
  flattenPdf: {
    path: "/flatten-pdf",
    title: "Flatten PDF Forms Online Free - No Upload | PDFMech",
    description: "Flatten editable PDF form fields online for free. Fix completed field appearances into the page and download a validated copy locally without uploading.",
    h1: "Flatten PDF forms online for free.",
    intro: "Convert supported AcroForm fields into fixed page content locally for consistent viewing, sharing, and printing.",
    schemaType: "WebPage",
  },
  deskewPdf: {
    path: "/deskew-pdf",
    title: "Deskew PDF Online Free - Straighten Scans | PDFMech",
    description: "Straighten crooked scanned PDF pages online for free. Detect and adjust page angles locally in your browser, then download without uploading the file.",
    h1: "Straighten scanned PDF pages online.",
    intro: "Automatically detect crooked scan angles, fine-tune each page, and create a corrected PDF privately in your browser.",
    schemaType: "WebPage",
  },
  metadataPdf: {
    path: "/remove-pdf-metadata",
    title: "Remove PDF Metadata Online Free | PDFMech",
    description: "View and remove PDF metadata online for free. Clear author, title, dates, custom fields, and XMP data privately in your browser without uploading.",
    h1: "View and remove PDF metadata online.",
    intro: "Inspect hidden document properties, remove selected metadata or clear it all, and download a cleaned PDF privately in your browser.",
    schemaType: "WebPage",
  },
  comparePdf: {
    path: "/compare-pdf",
    title: "Compare PDF Files Online Free - Text Diff | PDFMech",
    description: "Compare two PDF files online for free. Find added and removed text page by page locally in your browser without uploading sensitive documents.",
    h1: "Compare two PDF files online.",
    intro: "Find added and removed selectable text page by page, review document changes, and download a comparison report privately in your browser.",
    schemaType: "WebPage",
  },
  extractPdfPages: {
    path: "/extract-pdf-pages",
    title: "Extract PDF Pages Online Free - No Upload | PDFMech",
    description: "Extract selected pages from a PDF online for free. Choose thumbnails or page ranges and download one new PDF locally without uploading your file.",
    h1: "Extract pages from a PDF online.",
    intro: "Select page thumbnails or enter flexible ranges, then save the chosen native pages as one new PDF privately in your browser.",
    schemaType: "WebPage",
  },
  mergePdf: {
    path: "/merge-pdf",
    title: "Merge PDF Online Free - Combine PDFs Locally | PDFMech",
    description: "Merge PDF files online for free. Arrange multiple PDFs and download one combined document locally in your browser without uploading your files.",
    h1: "Merge PDF files online for free.",
    intro: "Combine multiple PDFs in the order you choose, preserve native pages, and download one new document privately in your browser.",
    schemaType: "WebPage",
  },
  splitPdf: {
    path: "/split-pdf",
    title: "Split PDF Online Free - Separate Pages Locally | PDFMech",
    description: "Split PDF files online for free. Create one PDF per page or define custom page ranges, then download locally without uploading your document.",
    h1: "Split PDF pages online for free.",
    intro: "Separate a PDF into individual pages or custom page ranges, preserve native page content, and download every output privately in your browser.",
    schemaType: "WebPage",
  },
  compressPdf: {
    path: "/compress-pdf",
    title: "Compress PDF Online Free - Reduce PDF Size Locally | PDFMech",
    description: "Compress PDF files online for free. Reduce scanned and image-heavy PDF sizes locally in your browser without uploading your document.",
    h1: "Compress PDF files online for free.",
    intro: "Choose Light, Balanced, or Strong compression and download a smaller visible-page copy created privately in your browser.",
    schemaType: "WebPage",
  },
  redactPdf: {
    path: "/redact-pdf",
    title: "Redact PDF Online Free - Remove Content Securely | PDFMech",
    description: "Redact PDF content permanently online for free. Remove sensitive text and graphics locally in your browser without uploading your document.",
    h1: "Redact PDF content securely online.",
    intro: "Draw over sensitive content and create a new PDF with the covered text and graphics permanently removed from marked pages.",
    schemaType: "WebPage",
  },
  protectPdf: {
    path: "/protect-pdf",
    title: "Password Protect PDF Online Free - AES-256 | PDFMech",
    description: "Password protect a PDF online for free with AES-256 encryption. Secure your document locally in your browser without uploading the PDF or password.",
    h1: "Password protect a PDF online for free.",
    intro: "Add an open password and optional reader permissions, then download an AES-256 encrypted copy created privately in your browser.",
    schemaType: "WebPage",
  },
  unlockPdf: {
    path: "/unlock-pdf",
    title: "Unlock PDF Online Free - Remove PDF Password | PDFMech",
    description: "Unlock a PDF online for free when you know its password. Remove PDF encryption locally in your browser without uploading the document or password.",
    h1: "Unlock a PDF online for free.",
    intro: "Enter the current PDF password and download a separate unencrypted copy created privately in your browser.",
    schemaType: "WebPage",
  },
  pdfToJpg: {
    path: "/pdf-to-jpg",
    title: "PDF to JPG Converter Online Free - No Upload | PDFMech",
    description: "Convert PDF pages to JPG images online for free. Choose all or selected pages and create JPG files locally in your browser without uploading your PDF.",
    h1: "Convert PDF pages to JPG images.",
    intro: "Export every PDF page or a custom page range as clear JPG images, with private browser-local processing and no account.",
    schemaType: "WebPage",
  },
  jpgToPdf: {
    path: "/jpg-to-pdf",
    title: "JPG to PDF Converter Online Free - No Upload | PDFMech",
    description: "Convert JPG images to one PDF online for free. Arrange photos, choose A4, Letter, or fitted pages, and create the PDF locally without uploading images.",
    h1: "Convert JPG images to one PDF.",
    intro: "Arrange multiple JPG files, choose page size, orientation, and margins, then download one validated PDF created privately in your browser.",
    schemaType: "WebPage",
  },
  tools: {
    path: "/tools",
    title: "Free Online PDF Tools - Private & No Upload | PDFMech",
    description: "Explore free online PDF tools to edit, organize, merge, split, extract, OCR, compare, and clean PDFs locally in your browser without uploading files.",
    h1: "Free PDF tools that work in your browser.",
    intro: "Choose a focused tool for editing, organizing, scanning, forms, privacy, or document review with browser-local processing.",
    schemaType: "WebPage",
  },
  privatePdfEditor: {
    path: "/private-pdf-editor",
    title: "Private PDF Editor Online - No Upload | PDFMech",
    description: "Edit PDFs privately in your browser with PDFMech. Add text, visually cover content, organize pages, and export locally without an editing-server upload.",
    h1: "Edit PDFs privately without uploading them.",
    intro: "Open, edit, recover, and export supported PDF changes in your browser while the source document stays on your device.",
    schemaType: "WebPage",
  },
  editPdfOnIphone: {
    path: "/edit-pdf-on-iphone",
    title: "How to Edit a PDF on iPhone Free in Safari | PDFMech",
    description: "Learn how to edit a PDF on iPhone in Safari. Add text, add visual covers, organize pages, and download a new copy without installing an app.",
    h1: "How to edit a PDF on iPhone in Safari.",
    intro: "Choose a PDF from the iPhone Files picker, make touch-friendly edits in Safari, and save a separate finished copy without installing an app.",
    schemaType: "WebPage",
  },
  features: {
    path: "/features",
    title: "Free PDF Editing Tools & Features | PDFMech",
    description: "Explore free PDF tools for OCR, text, visual covers, page rotation, reordering, deletion, recovery, and checked downloads directly in your browser.",
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
  blog: {
    path: "/blog",
    title: "Free PDF Guides: Edit, OCR & Organize PDFs | PDFMech",
    description: "Read practical PDF guides about editing, OCR, searchable documents, page organization, privacy, and mobile workflows with free PDFMech tools.",
    h1: "Practical PDF guides and privacy-first tips.",
    intro: "Clear instructions for editing, organizing, searching, and protecting PDF documents with browser-based tools.",
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
  {
    question: "Can PDFMech make a scanned PDF searchable?",
    answer: "Yes. The OCR PDF tool recognizes clear English printed text locally and creates a separate searchable PDF without uploading the document to an OCR server.",
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
  ocrPdf: [
    {
      question: "Is my scanned PDF uploaded?",
      answer: "No. PDFMech renders pages, recognizes printed text, and creates the searchable PDF locally in your browser.",
    },
    {
      question: "What does OCR add to my PDF?",
      answer: "OCR adds an invisible text layer above the original scanned page so supported text can be searched, selected, and copied while the page appearance stays intact.",
    },
    {
      question: "Does PDFMech OCR handwriting?",
      answer: "The current tool is optimized for clear English printed text. Handwriting, unusual fonts, low-resolution scans, and complex layouts may be recognized less accurately.",
    },
    {
      question: "Will OCR replace my original PDF?",
      answer: "No. PDFMech creates a separate searchable PDF and plain-text download. Your original file remains unchanged on your device.",
    },
  ],
  batesNumberingPdf: [
    {
      question: "Are my PDFs uploaded for Bates numbering?",
      answer: "No. PDFMech reads, numbers, and creates the new PDFs locally in your browser. The source documents are not sent to a PDFMech processing server.",
    },
    {
      question: "Can one Bates sequence continue across multiple PDFs?",
      answer: "Yes. Arrange the files in the required order and PDFMech continues the sequence across every selected page in that order.",
    },
    {
      question: "Can I number only selected pages?",
      answer: "Yes. Use all pages or enter a range such as 1-5, 8, 12 for each PDF before processing.",
    },
    {
      question: "Will Bates numbering affect digital signatures?",
      answer: "It can. Adding a visible number changes the PDF and may invalidate an existing digital signature, so keep the original signed file.",
    },
  ],
  flattenPdf: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. PDFMech inspects, flattens, validates, and creates the output in your browser.",
    },
    {
      question: "Will the form fields still be editable?",
      answer: "No. Supported field appearances become fixed page content in the downloaded copy.",
    },
    {
      question: "Does flattening replace my original file?",
      answer: "No. PDFMech creates a separate flattened PDF and leaves the source file unchanged.",
    },
    {
      question: "Are XFA forms supported?",
      answer: "No. XFA forms are detected and blocked because this browser-local method cannot preserve them reliably.",
    },
  ],
  deskewPdf: [
    {
      question: "Is my scanned PDF uploaded?",
      answer: "No. PDFMech analyzes and straightens supported pages locally in your browser.",
    },
    {
      question: "Does automatic deskew work on every page?",
      answer: "No. Pages need enough horizontal printed text or line structure for reliable detection. You can adjust every page manually.",
    },
    {
      question: "Will searchable text be preserved?",
      answer: "Pages corrected by a non-zero angle are rasterized, so existing interactive text is not preserved on those pages. Run PDFMech OCR afterward to add a new searchable text layer.",
    },
    {
      question: "Does this replace my original PDF?",
      answer: "No. PDFMech creates a separate deskewed PDF and leaves the source file unchanged.",
    },
  ],
  metadataPdf: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. PDFMech reads and removes supported metadata inside your browser.",
    },
    {
      question: "Will removing metadata change my pages?",
      answer: "The tool preserves the PDF page count and does not intentionally rasterize or visibly edit page content.",
    },
    {
      question: "Can I remove only the author or title?",
      answer: "Yes. You can select individual standard or custom fields and choose whether to remove the embedded XMP packet.",
    },
    {
      question: "Does this remove every possible trace of personal information?",
      answer: "No. It removes supported document-info fields and XMP metadata, not visible text, annotations, attachments, form values, or other page content.",
    },
  ],
  comparePdf: [
    {
      question: "Are my PDFs uploaded?",
      answer: "No. Text extraction and comparison run locally in your browser.",
    },
    {
      question: "Can it compare scanned PDFs?",
      answer: "Only after the scans contain searchable text. Use PDFMech OCR first when a page is image-only.",
    },
    {
      question: "Does it compare images and formatting?",
      answer: "No. This version compares selectable text, not images, fonts, colors, drawings, or visual layout.",
    },
    {
      question: "Why can added pages affect later results?",
      answer: "Pages are compared by page number. If one version inserts or removes a page, later pages may no longer be aligned with their matching content.",
    },
  ],
  extractPdfPages: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. Page previews, extraction, validation, and download are created locally in your browser.",
    },
    {
      question: "Can I extract non-consecutive pages?",
      answer: "Yes. Enter individual pages and ranges together, such as 1-3, 6, 9.",
    },
    {
      question: "Will the extracted pages become images?",
      answer: "No. Selected pages are copied as native PDF pages rather than intentionally rasterized.",
    },
    {
      question: "Does extraction modify my original PDF?",
      answer: "No. PDFMech creates a separate PDF containing the selected pages and leaves the source file unchanged.",
    },
  ],
  mergePdf: [
    {
      question: "Are my PDF files uploaded?",
      answer: "No. Previewing, ordering, merging, validation, and download happen locally in your browser.",
    },
    {
      question: "Can I change the order before merging?",
      answer: "Yes. Use the Move Up and Move Down controls to set the file order. Pages within each PDF keep their original order.",
    },
    {
      question: "Will merging turn pages into images?",
      answer: "No. PDFMech copies native PDF pages instead of intentionally converting them into screenshots.",
    },
    {
      question: "Are digitally signed PDFs supported?",
      answer: "They may be merged, but creating a new combined document means the original digital signatures will not remain valid.",
    },
  ],
  splitPdf: [
    {
      question: "Does PDFMech upload my file?",
      answer: "No. Page previews, splitting, validation, ZIP packaging, and downloads are produced locally in your browser.",
    },
    {
      question: "Can I split a PDF into chapters?",
      answer: "Yes. Enter each chapter as a separate range. For example, 1-5, 6-12, 13-20 creates three PDFs.",
    },
    {
      question: "Will text remain selectable?",
      answer: "Ordinary PDF pages are copied natively instead of intentionally converted into screenshots, so selectable text and vector content can remain intact.",
    },
    {
      question: "Does splitting change my original PDF?",
      answer: "No. PDFMech creates new files and leaves the source PDF unchanged.",
    },
  ],
  compressPdf: [
    {
      question: "Does PDFMech upload my PDF?",
      answer: "No. Previewing, compression, validation, and download happen locally in your browser.",
    },
    {
      question: "Which compression level should I choose?",
      answer: "Balanced is recommended for most sharing and email tasks. Choose Light for sharper detail or Strong for a smaller file.",
    },
    {
      question: "Why did my PDF not become smaller?",
      answer: "Text-only and already-optimized PDFs can be more efficient than rasterized pages. PDFMech keeps the original bytes when the generated copy would be larger.",
    },
    {
      question: "Will text remain selectable?",
      answer: "No. This compressor rebuilds visible pages as images. Keep the original when selectable text, links, forms, or accessibility structure must remain available.",
    },
  ],
  redactPdf: [
    {
      question: "Is secure redaction different from whiteout?",
      answer: "Yes. Whiteout adds a visual cover. Secure redaction rebuilds marked pages without retaining the underlying PDF text or graphics beneath selected regions.",
    },
    {
      question: "Does PDFMech upload my document?",
      answer: "No. Page previews, redaction, PDF generation, validation, and download happen locally in your browser.",
    },
    {
      question: "Will all pages become images?",
      answer: "No. Only pages containing redaction areas are flattened. Unmarked pages are copied natively into the new PDF.",
    },
    {
      question: "Can redactions be undone after download?",
      answer: "No. Applied redactions are permanent in the generated copy. Your original source PDF remains unchanged on your device.",
    },
  ],
  protectPdf: [
    {
      question: "Does PDFMech upload my PDF or password?",
      answer: "No. Inspection, encryption, verification, and download happen locally in your browser.",
    },
    {
      question: "What encryption does PDFMech use?",
      answer: "The protected output uses AES-256 PDF encryption.",
    },
    {
      question: "Can PDFMech recover a forgotten password?",
      answer: "No. PDFMech never receives or stores the password. Keep it in a trusted password manager or another safe place.",
    },
    {
      question: "Can I protect an already encrypted PDF?",
      answer: "Not on this page. Remove the existing password first, then protect the unencrypted copy with a new password.",
    },
  ],
  unlockPdf: [
    {
      question: "Can PDFMech unlock a PDF without its password?",
      answer: "No. If the file requires an open password, you must provide a valid current user or owner password.",
    },
    {
      question: "Does PDFMech upload my PDF or password?",
      answer: "No. Protection checks, decryption, verification, and download happen locally in your browser.",
    },
    {
      question: "Does unlocking change the original PDF?",
      answer: "No. PDFMech creates a separate unencrypted copy and leaves the protected source file unchanged.",
    },
    {
      question: "Why does my PDF open without asking for a password?",
      answer: "Some encrypted PDFs use only permission restrictions. PDFMech can remove those restrictions without an open password.",
    },
  ],
  pdfToJpg: [
    {
      question: "Does PDFMech upload my PDF?",
      answer: "No. PDF rendering, JPG creation, and ZIP packaging happen locally in your browser.",
    },
    {
      question: "Can I convert only one PDF page?",
      answer: "Yes. Choose Custom pages, enter one page number, or tap a page preview. A single selection downloads directly as a JPG.",
    },
    {
      question: "Why do multiple pages download as a ZIP?",
      answer: "A ZIP keeps all selected JPG images together and avoids triggering a separate browser download for every page.",
    },
    {
      question: "Which JPG quality should I choose?",
      answer: "Balanced is recommended for most documents. Choose Web for smaller images or High when fine text and graphics need more detail.",
    },
  ],
  jpgToPdf: [
    {
      question: "Are my JPG images uploaded?",
      answer: "No. JPG inspection, arrangement, PDF creation, validation, and download happen locally in your browser.",
    },
    {
      question: "Can I combine several JPGs into one PDF?",
      answer: "Yes. Add up to 25 images and arrange them. Each image becomes one page in the finished PDF.",
    },
    {
      question: "Will PDFMech crop or stretch my images?",
      answer: "No. Each JPG is scaled proportionally to fit the selected page and margin area.",
    },
    {
      question: "Should I choose Fit image, A4, or Letter?",
      answer: "Fit image is best for preserving the original image shape. Choose A4 or Letter when you need standard printable pages.",
    },
  ],
  privatePdfEditor: [
    {
      question: "Does PDFMech upload my source PDF?",
      answer: "No. Supported PDF editing is designed to run in your browser rather than sending the source document to a PDFMech editing server.",
    },
    {
      question: "Can PDFMech save recovery data?",
      answer: "Yes. Local recovery may store the source PDF and editing state in this browser on this device. You can clear that checkpoint from the editor.",
    },
    {
      question: "Does PDFMech need an account?",
      answer: "No. You can open the editor and use supported tools without creating a PDFMech account.",
    },
    {
      question: "Does downloading replace my original PDF?",
      answer: "No. PDFMech creates a separate edited PDF for download and leaves the original source file unchanged.",
    },
  ],
  editPdfOnIphone: [
    {
      question: "Do I need to install an iPhone app?",
      answer: "No. PDFMech works in Safari, so you can choose a PDF from Files and edit supported content without installing a separate app.",
    },
    {
      question: "Where does the edited PDF go on iPhone?",
      answer: "Safari downloads the new PDF through the browser. Its location depends on your Safari download setting, commonly the Downloads folder in iCloud Drive or On My iPhone.",
    },
    {
      question: "Can I change text already embedded in the PDF?",
      answer: "Not directly. PDFMech adds a new editable text box above the original PDF page rather than rewriting its embedded text layer.",
    },
    {
      question: "Will my iPhone upload the PDF to PDFMech?",
      answer: "No. Supported editing is designed to process the source PDF locally in Safari rather than sending it to a PDFMech editing server.",
    },
  ],
};

export const TOOL_SEO_PAGE_KEYS = [
  "addTextToPdf",
  "deletePdfPages",
  "reorderPdfPages",
  "rotatePdfPages",
  "whiteoutPdf",
  "ocrPdf",
  "batesNumberingPdf",
  "flattenPdf",
  "deskewPdf",
  "metadataPdf",
  "comparePdf",
  "extractPdfPages",
  "mergePdf",
  "splitPdf",
  "compressPdf",
  "redactPdf",
  "protectPdf",
  "unlockPdf",
  "pdfToJpg",
  "jpgToPdf",
  "privatePdfEditor",
] as const satisfies readonly SeoPageKey[];

export function canonicalUrl(page: SeoPageKey): string {
  return `${SITE_ORIGIN}${SEO_PAGES[page].path}`;
}

export function lastModifiedDate(page: SeoPageKey): string {
  return page === "compressPdf" || page === "redactPdf" || page === "protectPdf" || page === "unlockPdf" || page === "pdfToJpg" || page === "jpgToPdf" || page === "tools"
    ? "2026-10-07"
    : page === "mergePdf" || page === "splitPdf"
    ? "2026-10-06"
    : page === "metadataPdf" || page === "comparePdf" || page === "extractPdfPages"
    ? "2026-10-05"
    : page === "flattenPdf" || page === "deskewPdf"
    ? "2026-10-04"
    : page === "batesNumberingPdf"
    ? "2026-10-01"
    : page === "blog"
    ? "2026-09-28"
    : page === "editPdfOnIphone" || page === "ocrPdf"
    ? "2026-09-27"
    : "2026-09-25";
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
    page === "whiteoutPdf" ||
    page === "ocrPdf" ||
    page === "batesNumberingPdf" ||
    page === "flattenPdf" ||
    page === "deskewPdf" ||
    page === "metadataPdf" ||
    page === "comparePdf" ||
    page === "extractPdfPages" ||
    page === "mergePdf" ||
    page === "splitPdf" ||
    page === "compressPdf" ||
    page === "redactPdf" ||
    page === "protectPdf" ||
    page === "unlockPdf" ||
    page === "pdfToJpg" ||
    page === "jpgToPdf" ||
    page === "privatePdfEditor"
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

  if (page === "tools") {
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

  if (page === "editPdfOnIphone") {
    graph.push({
      "@type": "Article",
      "@id": `${url}#article`,
      headline: config.h1,
      description: config.description,
      mainEntityOfPage: { "@id": `${url}#webpage` },
      author: { "@id": organizationId },
      publisher: { "@id": organizationId },
      datePublished: "2026-09-27",
      dateModified: lastModifiedDate(page),
      inLanguage: "en",
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
