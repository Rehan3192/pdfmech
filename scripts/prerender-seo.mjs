import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildStructuredData,
  canonicalUrl,
  lastModifiedDate,
  SEO_PAGE_KEYS,
  SEO_PAGES,
  SITE_ORIGIN,
  SOCIAL_IMAGE_PATH,
  TOOL_SEO_PAGE_KEYS,
  TOOL_ROUTE_FAQS,
} from "../src/seo-config.ts";
import {
  formatBlogDate,
  getBlogPosts,
} from "../src/blog.ts";
import { sanitizeBlogHtmlForBuild } from "./sanitize-blog-html.mjs";

const outputDirectory = join(process.cwd(), "dist");
const template = await readFile(join(outputDirectory, "index.html"), "utf8");
let blogPosts = [];
try {
  blogPosts = await getBlogPosts(100, sanitizeBlogHtmlForBuild);
} catch (error) {
  console.warn(`WordPress content was unavailable during prerender: ${error instanceof Error ? error.message : String(error)}`);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function replaceMeta(html, selector, value) {
  const attribute = selector.startsWith("og:") ? "property" : "name";
  const pattern = new RegExp(`<meta\\s+${attribute}="${selector}"[^>]*>`, "i");
  return html.replace(pattern, `<meta ${attribute}="${selector}" content="${escapeHtml(value)}" />`);
}

function renderSnapshot(page) {
  const config = SEO_PAGES[page];
  const routeLabels = {
    home: "Home",
    editor: "PDF Editor",
    addTextToPdf: "Add Text to PDF",
    deletePdfPages: "Delete PDF Pages",
    reorderPdfPages: "Reorder PDF Pages",
    rotatePdfPages: "Rotate PDF Pages",
    whiteoutPdf: "White Out PDF",
    ocrPdf: "OCR PDF",
    batesNumberingPdf: "Bates Numbering PDF",
    flattenPdf: "Flatten PDF Forms",
    fillPdfForm: "Fill PDF Forms",
    deskewPdf: "Deskew PDF",
    metadataPdf: "Remove PDF Metadata",
    comparePdf: "Compare PDFs",
    extractPdfPages: "Extract PDF Pages",
    mergePdf: "Merge PDF",
    splitPdf: "Split PDF",
    splitRenamePdf: "Split & Rename PDF",
    compressPdf: "Compress PDF",
    redactPdf: "Secure PDF Redaction",
    protectPdf: "Protect PDF",
    unlockPdf: "Unlock PDF",
    pdfToJpg: "PDF to JPG",
    jpgToPdf: "JPG to PDF",
    watermarkPdf: "Watermark PDF",
    signPdf: "Sign PDF",
    tools: "All PDF Tools",
    privatePdfEditor: "Private PDF Editor",
    editPdfOnIphone: "Edit PDF on iPhone",
    features: "Features",
    howItWorks: "How It Works",
    blog: "Blog",
    faq: "FAQ",
    about: "About",
    contact: "Contact",
  };
  const nav = SEO_PAGE_KEYS
    .filter((key) => !["security", "privacy", "terms"].includes(key))
    .map((key) => `<a href="${SEO_PAGES[key].path}">${routeLabels[key] ?? key}</a>`)
    .join("");
  const related = SEO_PAGE_KEYS
    .filter((key) => key !== page)
    .slice(0, 5)
    .map((key) => `<a href="${SEO_PAGES[key].path}">${escapeHtml(SEO_PAGES[key].h1)}</a>`)
    .join("");

  const isAddTextTool = page === "addTextToPdf";
  const isDeletePagesTool = page === "deletePdfPages";
  const isReorderPagesTool = page === "reorderPdfPages";
  const isRotatePagesTool = page === "rotatePdfPages";
  const isWhiteoutTool = page === "whiteoutPdf";
  const isOcrTool = page === "ocrPdf";
  const isBatesTool = page === "batesNumberingPdf";
  const isFlattenTool = page === "flattenPdf";
  const isFillFormTool = page === "fillPdfForm";
  const isDeskewTool = page === "deskewPdf";
  const isMetadataTool = page === "metadataPdf";
  const isCompareTool = page === "comparePdf";
  const isExtractPagesTool = page === "extractPdfPages";
  const isMergeTool = page === "mergePdf";
  const isSplitTool = page === "splitPdf";
  const isSplitRenameTool = page === "splitRenamePdf";
  const isCompressTool = page === "compressPdf";
  const isRedactTool = page === "redactPdf";
  const isProtectTool = page === "protectPdf";
  const isUnlockTool = page === "unlockPdf";
  const isPdfToJpgTool = page === "pdfToJpg";
  const isJpgToPdfTool = page === "jpgToPdf";
  const isWatermarkTool = page === "watermarkPdf";
  const isSignTool = page === "signPdf";
  const isToolsDirectory = page === "tools";
  const isPrivateEditor = page === "privatePdfEditor";
  const isIphoneGuide = page === "editPdfOnIphone";
  const blogContent = page === "blog"
    ? `<section aria-label="Latest PDF guides"><h2>Latest articles</h2>${blogPosts.length === 0 ? "<p>New PDF guides are on the way.</p>" : blogPosts.map((post) => `<article><h3><a href="/blog/${post.slug}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.excerpt || "Read this practical PDF guide from PDFMech.")}</p><time datetime="${escapeHtml(post.date)}">${escapeHtml(formatBlogDate(post.date))}</time></article>`).join("")}</section>`
    : "";
  const toolContent = isToolsDirectory
    ? `<section><h2>Choose your PDF tool</h2><p>Use a focused browser-local workflow for editing, organizing, scanning, forms, privacy, or document review.</p>${TOOL_SEO_PAGE_KEYS.map((toolPage) => `<article><h3><a href="${SEO_PAGES[toolPage].path}">${escapeHtml(SEO_PAGES[toolPage].h1)}</a></h3><p>${escapeHtml(SEO_PAGES[toolPage].description)}</p></article>`).join("")}</section>`
    : isAddTextTool
      ? `<section><h2>How to add text to a PDF</h2><ol><li>Choose a PDF from your device.</li><li>Click or tap where the new text should appear.</li><li>Adjust font, size, color, bold style, and alignment.</li><li>Review and download a separate edited copy.</li></ol><h2>Local browser processing</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>What the Text tool changes</h2><p>PDFMech adds a new editable text box above the PDF page. It does not rewrite text already embedded in the original PDF.</p></section>`
    : isDeletePagesTool
      ? `<section><h2>How to delete PDF pages</h2><ol><li>Choose a PDF from your device.</li><li>Select an unwanted page from the thumbnails.</li><li>Delete the selected page and review the remaining page count.</li><li>Download a separate edited copy.</li></ol><h2>Local browser processing</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Remove complete pages</h2><p>PDFMech removes selected pages from the working document used for export. Your original PDF file remains unchanged on your device.</p></section>`
      : isReorderPagesTool
        ? `<section><h2>How to reorder PDF pages</h2><ol><li>Choose a PDF from your device.</li><li>Select a page from the thumbnails.</li><li>Move the selected page earlier or later in the document.</li><li>Review the sequence and download a separate organized copy.</li></ol><h2>Local browser processing</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Move complete pages</h2><p>PDFMech changes the page sequence in the working document used for export. Your original PDF file remains unchanged on your device.</p></section>`
        : isRotatePagesTool
          ? `<section><h2>How to rotate PDF pages</h2><ol><li>Choose a PDF from your device.</li><li>Select a sideways or upside-down page from the thumbnails.</li><li>Rotate the selected page clockwise by 90 degrees.</li><li>Review the orientation and download a separate corrected copy.</li></ol><h2>Local browser processing</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Correct individual page orientation</h2><p>PDFMech rotates only the selected page in the working document used for export. Your original PDF file remains unchanged on your device.</p></section>`
          : isWhiteoutTool
            ? `<section><h2>How to white out PDF content</h2><ol><li>Choose a PDF from your device.</li><li>Click or tap where a visual cover should appear.</li><li>Move, resize, and recolor the whiteout cover.</li><li>Review the page and download a separate edited copy.</li></ol><h2>Local browser processing</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Visual cover, not secure redaction</h2><p>Whiteout places an opaque cover over visible content. It does not guarantee removal of underlying PDF text, metadata, or other data.</p></section>`
            : isOcrTool
              ? `<section><h2>How to make a scanned PDF searchable</h2><ol><li>Choose a scanned or image-based PDF.</li><li>Review the document and select the pages to process.</li><li>Run private OCR locally in your browser.</li><li>Download the searchable PDF or extracted text.</li></ol><h2>Private browser OCR</h2><p>PDFMech recognizes printed text and creates the new searchable PDF on your device. Your source document and recognized text are not uploaded to an OCR server.</p><h2>Preserves the scanned page</h2><p>The original page appearance remains visible while PDFMech adds an invisible text layer for search, selection, and copying.</p></section>`
              : isBatesTool
                ? `<section><h2>How to add Bates numbers to a PDF</h2><ol><li>Choose one or more PDFs and arrange them in sequence.</li><li>Select all pages or enter a page range for each file.</li><li>Set the starting number, prefix, suffix, digits, and position.</li><li>Process locally and download each numbered PDF.</li></ol><h2>Continuous numbering across PDFs</h2><p>PDFMech continues one sequence across selected pages in the exact file order you choose.</p><h2>Private local processing</h2><p>Your source documents are numbered in this browser and are not uploaded to a PDFMech processing server.</p></section>`
                : isFlattenTool
                  ? `<section><h2>How to flatten PDF form fields</h2><ol><li>Choose a completed PDF form.</li><li>Review the editable AcroForm fields found.</li><li>Flatten the current field appearances locally.</li><li>Download a validated non-editable copy.</li></ol><h2>AcroForm fields become fixed content</h2><p>Supported text fields, checkboxes, radio buttons, and dropdown appearances become part of the page and are no longer editable.</p><h2>Private local form processing</h2><p>PDFMech inspects and flattens the form in your browser without uploading it to a document-processing server.</p><h2>Clear product limits</h2><p>This tool flattens AcroForm fields, not arbitrary annotations, layers, scripts, or XFA forms.</p></section>`
                  : isFillFormTool
                    ? `<section><h2>How to fill a PDF form online</h2><ol><li>Choose a PDF containing interactive AcroForm fields.</li><li>Complete supported text, checkbox, radio, dropdown, and list fields.</li><li>Keep the fields editable or flatten their current appearances.</li><li>Save and download the completed PDF locally.</li></ol><h2>Common interactive PDF fields</h2><p>PDFMech reads and updates supported AcroForm controls while preserving unsupported buttons and signature fields unchanged.</p><h2>Editable or flattened output</h2><p>Keep fields interactive for later changes or make the supported field appearances fixed and non-editable.</p><h2>Private browser-local form filling</h2><p>Your source PDF and entered field values stay in your browser during supported processing and validation.</p></section>`
                  : isDeskewTool
                    ? `<section><h2>How to straighten a scanned PDF</h2><ol><li>Choose a scanned or image-based PDF.</li><li>Review each automatically detected correction angle.</li><li>Fine-tune individual pages when needed.</li><li>Create the corrected PDF locally and download it.</li></ol><h2>Automatic and manual deskew</h2><p>PDFMech estimates small page rotations from horizontal printed text and lets you adjust every page in quarter-degree steps.</p><h2>Private scan processing</h2><p>Page analysis, rendering, correction, and PDF export happen in your browser without uploading the source document.</p><h2>Scan-specific raster output</h2><p>Corrected pages are rasterized and should be sent through OCR afterward if searchable text is required. Pages at zero degrees are preserved.</p></section>`
                    : isMetadataTool
                      ? `<section><h2>How to remove PDF metadata</h2><ol><li>Choose a PDF from your device.</li><li>Review standard fields, custom properties, and embedded XMP metadata.</li><li>Select individual items or choose all detected metadata.</li><li>Create and download a cleaned copy locally.</li></ol><h2>Standard, custom, and XMP metadata</h2><p>PDFMech can inspect common document properties, additional Info dictionary fields, and a separate embedded XMP packet.</p><h2>Private metadata processing</h2><p>Metadata inspection, removal, validation, and PDF export happen in your browser without uploading the source document.</p><h2>Important privacy limit</h2><p>Metadata cleanup does not remove visible text, annotations, attachments, form values, or other content inside PDF pages.</p></section>`
                      : isCompareTool
                        ? `<section><h2>How to compare two PDF files</h2><ol><li>Choose the older and newer PDFs.</li><li>Select whether to ignore whitespace or capitalization.</li><li>Compare selectable text locally in your browser.</li><li>Review changed pages and download a text report.</li></ol><h2>Page-by-page text differences</h2><p>PDFMech extracts selectable text and identifies added and removed lines on matching page numbers.</p><h2>Private local comparison</h2><p>Both PDFs are read and compared in your browser without uploading either document to a comparison server.</p><h2>Text-only comparison limits</h2><p>This version does not detect images, fonts, colors, formatting, drawings, or layout-only changes. Image-only scans need OCR first.</p></section>`
                        : isExtractPagesTool
                          ? `<section><h2>How to extract pages from a PDF</h2><ol><li>Choose a PDF from your device.</li><li>Select page thumbnails or enter a range such as 1-3, 6, 9.</li><li>Review selected and excluded page counts.</li><li>Extract and download one new PDF containing the selected pages.</li></ol><h2>Native PDF page extraction</h2><p>PDFMech copies selected pages into a new PDF without intentionally converting them to screenshots.</p><h2>Private local page processing</h2><p>Page previews, selection, extraction, validation, and download happen in your browser without uploading the source document.</p><h2>Document-level transfer limits</h2><p>Bookmarks, attachments, metadata, scripts, signatures, and some interactive structures may not transfer to the new PDF.</p></section>`
                          : isMergeTool
                            ? `<section><h2>How to merge PDF files online</h2><ol><li>Choose two or more PDF files from your device.</li><li>Review the previews and move files into the required order.</li><li>Merge every page locally in your browser.</li><li>Download one new combined PDF.</li></ol><h2>Native PDF page merging</h2><p>PDFMech copies native pages from every source into one combined document without intentionally converting them into screenshots.</p><h2>Private local PDF merging</h2><p>Previewing, ordering, merging, validation, and download happen in your browser without uploading the source documents.</p><h2>Document-level merge limits</h2><p>Bookmarks, metadata, attachments, scripts, signatures, and some interactive forms or links may not transfer or remain valid.</p></section>`
                            : isSplitRenameTool
                              ? `<section><h2>How to split and rename PDF files in bulk</h2><ol><li>Choose the source PDF from your device.</li><li>Split it every N pages or enter complete, nonoverlapping ranges.</li><li>Import CSV or TXT filenames and select the correct column.</li><li>Verify every document-to-filename association before creating the batch.</li><li>Download the locally generated ZIP and optional CSV manifest.</li></ol><h2>Strict document-to-filename validation</h2><p>Export remains blocked when a mapping is missing, filenames collide after safe normalization, page groups overlap, source pages are omitted, or imported rows remain unresolved.</p><h2>Visual matching prevents silent reassignment</h2><p>Each group shows its first page, source range, imported row, proposed filename, and validation result together.</p><h2>Private local batch processing</h2><p>The source PDF, filename list, previews, outputs, and ZIP remain in your browser and are not sent to a PDFMech processing server.</p><h2>Verified ZIP and manifest</h2><p>Generated pages and archive entries are checked before success is reported. The optional manifest records each output filename and its source pages.</p></section>`
                            : isSplitTool
                              ? `<section><h2>How to split a PDF online</h2><ol><li>Choose a PDF from your device.</li><li>Select every page or define separate custom ranges.</li><li>Review the output count and included pages.</li><li>Create the files and download them together as a ZIP.</li></ol><h2>Native PDF page splitting</h2><p>PDFMech copies native pages into separate PDF documents without intentionally converting them into screenshots.</p><h2>Private local PDF splitting</h2><p>Page previews, splitting, validation, ZIP packaging, and downloads happen in your browser without uploading the source document.</p><h2>Document-level split limits</h2><p>Bookmarks, metadata, attachments, scripts, signatures, and some interactive forms or links may not transfer or remain valid.</p></section>`
                            : isCompressTool
                              ? `<section><h2>How to compress a PDF online</h2><ol><li>Choose a PDF from your device.</li><li>Review the original file size and page previews.</li><li>Select Light, Balanced, or Strong compression.</li><li>Download the smaller PDF created in your browser.</li></ol><h2>Private local PDF compression</h2><p>PDFMech renders, rebuilds, validates, and downloads the compressed copy in your browser without uploading the source document.</p><h2>Best for scanned and image-heavy PDFs</h2><p>Raster compression is most effective for scans, photographs, screenshots, and presentation graphics. Already-efficient text PDFs may not become smaller.</p><h2>Raster compression limits</h2><p>The visible pages remain, but selectable text, forms, links, layers, attachments, and digital signatures do not remain interactive in the compressed copy.</p></section>`
                            : isRedactTool
                              ? `<section><h2>How to redact a PDF securely online</h2><ol><li>Choose a PDF from your device.</li><li>Open each page containing sensitive content.</li><li>Drag a black redaction area over every item that must be removed.</li><li>Apply the redactions, download the new PDF, and verify it before sharing.</li></ol><h2>Permanent redaction instead of visual whiteout</h2><p>PDFMech rebuilds each marked page with black areas baked in instead of placing a removable visual cover over the original content.</p><h2>Private browser-local PDF redaction</h2><p>Page previews, redaction, PDF generation, validation, and download happen in your browser without uploading the source document.</p><h2>Redaction limits and verification</h2><p>Marked pages lose selectable text, links, forms, annotations, and accessibility structure. Reopen the result and verify sensitive content cannot be searched, copied, or revealed.</p></section>`
                            : isProtectTool
                              ? `<section><h2>How to password protect a PDF online</h2><ol><li>Choose an unprotected PDF from your device.</li><li>Create and confirm a strong open password.</li><li>Optionally choose printing, copying, and editing permissions.</li><li>Protect and download the AES-256 encrypted copy.</li></ol><h2>Private browser-local PDF encryption</h2><p>PDFMech loads the encryption engine and processes the document in a browser worker without uploading the PDF or password.</p><h2>AES-256 open-password protection</h2><p>The new PDF requires the password to open. Store it safely because PDFMech cannot receive or recover it.</p><h2>PDF permission limits</h2><p>Printing, copying, and editing restrictions depend on the PDF reader. A strong open password provides the meaningful protection.</p></section>`
                            : isUnlockTool
                              ? `<section><h2>How to remove a password from a PDF</h2><ol><li>Choose an encrypted PDF from your device.</li><li>Enter the current user or owner password.</li><li>Unlock and verify the PDF locally in your browser.</li><li>Download the separate password-free copy.</li></ol><h2>Private browser-local PDF decryption</h2><p>PDFMech loads the security engine in a browser worker without uploading the PDF or password.</p><h2>Known-password removal only</h2><p>This tool does not guess, recover, bypass, or crack unknown PDF passwords.</p><h2>What changes after unlocking</h2><p>The new copy no longer requires the PDF password and no longer carries encryption permissions. Store and share it carefully.</p></section>`
                            : isPdfToJpgTool
                              ? `<section><h2>How to convert a PDF to JPG</h2><ol><li>Choose a PDF from your device.</li><li>Select every page or enter individual page numbers and ranges.</li><li>Choose Web, Balanced, or High JPG quality.</li><li>Download one JPG or a ZIP containing multiple page images.</li></ol><h2>Private browser-local PDF conversion</h2><p>PDFMech renders the selected pages and creates JPG images inside your browser without uploading the source PDF.</p><h2>Page selection and JPG quality</h2><p>Convert every page or a custom range with three useful quality levels.</p><h2>What changes when PDF pages become images</h2><p>JPG preserves the visible page as a flat image, not interactive PDF text, links, forms, layers, or signatures.</p></section>`
                            : isJpgToPdfTool
                              ? `<section><h2>How to convert JPG images to PDF</h2><ol><li>Choose one or more JPG images from your device.</li><li>Move images up or down into the required page order.</li><li>Select Fit image, A4, or Letter pages, then choose orientation and margins.</li><li>Create and download one validated PDF in your browser.</li></ol><h2>Combine multiple JPG files into one PDF</h2><p>Each image becomes one PDF page in the exact order shown.</p><h2>Private browser-local image conversion</h2><p>PDFMech decodes the JPG files, builds the PDF, and validates it without uploading your images.</p><h2>Page size, orientation, and margin options</h2><p>Choose fitted pages or printable A4 and Letter paper without cropping or stretching images.</p></section>`
                            : isWatermarkTool
                              ? `<section><h2>How to add a watermark to a PDF</h2><ol><li>Choose a PDF from your device.</li><li>Enter watermark text and adjust its color, size, opacity, rotation, and position.</li><li>Select every page or enter a custom page range.</li><li>Apply the watermark and download the separate PDF created in your browser.</li></ol><h2>Custom text watermark controls</h2><p>Add labels such as Confidential, Draft, Sample, Copy, or a company name and check their placement in the live preview.</p><h2>Private browser-local PDF watermarking</h2><p>PDFMech previews, modifies, validates, and downloads the PDF locally without uploading the source document.</p><h2>Watermark scope and document limits</h2><p>A watermark is a visible label rather than access control, encryption, redaction, or copy prevention. Modifying a signed PDF invalidates its existing signatures.</p></section>`
                            : isSignTool
                              ? `<section><h2>How to sign a PDF online</h2><ol><li>Choose a PDF from your device.</li><li>Draw, type, or upload your electronic signature.</li><li>Add it to one or more pages, then move and resize each placement.</li><li>Create and download the separate signed copy.</li></ol><h2>Draw, type, or upload an electronic signature</h2><p>Create a signature with a mouse or touchscreen, render typed text, or use an existing PNG or JPG image.</p><h2>Private browser-local PDF signing</h2><p>PDFMech creates page previews, embeds signatures, validates the output, and downloads it locally without uploading the PDF or signature.</p><h2>Electronic signatures and digital signatures are different</h2><p>This tool adds a visible electronic signature image. It does not create a digital certificate, trusted timestamp, identity verification, or cryptographic signature.</p></section>`
                          : isPrivateEditor
              ? `<section><h2>How private browser PDF editing works</h2><ol><li>Choose a PDF from your device.</li><li>The browser reads and renders the document locally.</li><li>Make supported text, visual cover, or page changes.</li><li>Validate and download a separate PDF generated in your browser.</li></ol><h2>Local recovery under your control</h2><p>Recovery may store the source PDF and editing state in IndexedDB in the current browser. Clear Document removes the current local checkpoint.</p><h2>Verify local processing</h2><p>Open the browser Network panel before choosing a test PDF. The source document is processed locally rather than posted to a PDFMech editing endpoint.</p></section>`
              : isIphoneGuide
                ? `<article><h2>How to edit a PDF on iPhone in Safari</h2><ol><li>Open PDFMech in Safari and choose a PDF from Files.</li><li>Select Text, Whiteout, or a page tool from the mobile action dock.</li><li>Tap the PDF, drag the object into position, and adjust its properties.</li><li>Review the result and download a separate edited PDF.</li></ol><h2>Where iPhone downloads are saved</h2><p>The folder follows your Safari download setting, commonly Downloads in iCloud Drive or On My iPhone.</p><h2>Mobile PDF editing limits</h2><p>Text adds a new layer rather than rewriting embedded words. Whiteout is a visual cover rather than secure redaction, and large PDFs may be constrained by available iPhone memory.</p></article>`
                : "";
  const routeFaqs = TOOL_ROUTE_FAQS[page] ?? [];
  const faqContent = routeFaqs.length > 0
    ? `<section aria-label="Frequently asked questions"><h2>${escapeHtml(config.h1.replace(/\.$/, ""))} FAQ</h2>${routeFaqs.map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join("")}</section>`
    : "";
  const actionPath = isAddTextTool
    ? "/add-text-to-pdf#add-text-tool"
    : isDeletePagesTool
      ? "/delete-pdf-pages#delete-pages-tool"
      : isReorderPagesTool
        ? "/reorder-pdf-pages#reorder-pages-tool"
        : isRotatePagesTool
          ? "/rotate-pdf-pages#rotate-pages-tool"
          : isWhiteoutTool
            ? "/whiteout-pdf#whiteout-pdf-tool"
            : isOcrTool
              ? "/ocr-pdf#ocr-pdf-tool"
              : isBatesTool
                ? "/bates-numbering-pdf#bates-numbering-tool"
                : isFlattenTool
                  ? "/flatten-pdf#flatten-pdf-tool"
                  : isFillFormTool
                    ? "/fill-pdf-form#fill-pdf-form-tool"
                  : isDeskewTool
                    ? "/deskew-pdf#deskew-pdf-tool"
                    : isMetadataTool
                      ? "/remove-pdf-metadata#pdf-metadata-tool"
                      : isCompareTool
                        ? "/compare-pdf#compare-pdf-tool"
                        : isExtractPagesTool
                          ? "/extract-pdf-pages#extract-pdf-pages-tool"
                          : isMergeTool
                            ? "/merge-pdf#merge-pdf-tool"
                            : isSplitRenameTool
                              ? "/split-pdf-and-rename#split-pdf-and-rename-tool"
                            : isSplitTool
                              ? "/split-pdf#split-pdf-tool"
                            : isCompressTool
                              ? "/compress-pdf#compress-pdf-tool"
                            : isRedactTool
                              ? "/redact-pdf#redact-pdf-tool"
                            : isProtectTool
                              ? "/protect-pdf#protect-pdf-tool"
                            : isUnlockTool
                              ? "/unlock-pdf#unlock-pdf-tool"
                            : isPdfToJpgTool
                              ? "/pdf-to-jpg#pdf-to-jpg-tool"
                            : isJpgToPdfTool
                              ? "/jpg-to-pdf#jpg-to-pdf-tool"
                            : isWatermarkTool
                              ? "/watermark-pdf#watermark-pdf-tool"
                            : isSignTool
                              ? "/sign-pdf#sign-pdf-tool"
                          : isPrivateEditor
              ? "/private-pdf-editor#private-pdf-editor-tool"
              : isIphoneGuide
                ? "/edit-pdf-on-iphone#iphone-pdf-editor-tool"
                : "/editor";
  const actionLabel = isAddTextTool
    ? "Choose a PDF to add text"
    : isDeletePagesTool
      ? "Choose a PDF to delete pages"
      : isReorderPagesTool
        ? "Choose a PDF to reorder pages"
        : isRotatePagesTool
          ? "Choose a PDF to rotate pages"
          : isWhiteoutTool
            ? "Choose a PDF to white out content"
            : isOcrTool
              ? "Choose a scanned PDF for OCR"
              : isBatesTool
                ? "Choose PDFs for Bates numbering"
                : isFlattenTool
                  ? "Choose a PDF form to flatten"
                  : isFillFormTool
                    ? "Choose a PDF form to fill"
                  : isDeskewTool
                    ? "Choose a scanned PDF to straighten"
                    : isMetadataTool
                      ? "Choose a PDF to inspect metadata"
                      : isCompareTool
                        ? "Choose two PDFs to compare"
                        : isExtractPagesTool
                          ? "Choose a PDF and extract pages"
                          : isMergeTool
                            ? "Choose PDFs to merge"
                            : isSplitRenameTool
                              ? "Choose a PDF to split and rename"
                            : isSplitTool
                              ? "Choose a PDF to split"
                            : isCompressTool
                              ? "Choose a PDF to compress"
                            : isRedactTool
                              ? "Choose a PDF to redact securely"
                            : isProtectTool
                              ? "Choose a PDF to password protect"
                            : isUnlockTool
                              ? "Choose a protected PDF to unlock"
                            : isPdfToJpgTool
                              ? "Choose a PDF to convert to JPG"
                            : isJpgToPdfTool
                              ? "Choose JPG images to convert to PDF"
                            : isWatermarkTool
                              ? "Choose a PDF to watermark"
                            : isSignTool
                              ? "Choose a PDF to sign"
                          : isPrivateEditor
              ? "Choose a PDF to edit privately"
              : isIphoneGuide
                ? "Choose a PDF from iPhone Files"
                : "Open PDFMech";

  return `<div class="seo-snapshot"><header><a href="/" aria-label="PDFMech home"><img src="/PDFMechLogo-small.webp" width="55" height="55" alt=""><strong>PDFMech</strong></a><nav aria-label="Main navigation">${nav}</nav></header><main><nav aria-label="Breadcrumb"><a href="/">Home</a>${page === "home" ? "" : `<span aria-hidden="true">/</span><span>${escapeHtml(config.h1)}</span>`}</nav><section><p>Private browser PDF editing</p><h1>${escapeHtml(config.h1)}</h1><p>${escapeHtml(config.intro)}</p><a href="${actionPath}">${actionLabel}</a></section>${blogContent}${toolContent}${faqContent}<nav aria-label="Related PDFMech pages"><strong>Explore PDFMech</strong>${related}</nav></main><footer><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/security">Security</a><a href="/terms">Terms</a><a href="/sitemap.xml">Sitemap</a></footer></div>`;
}

function renderRoute(page) {
  const config = SEO_PAGES[page];
  const url = canonicalUrl(page);
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(config.title)}</title>`)
    .replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${url}" />`)
    .replace(/<script id="route-structured-data"[^>]*>[\s\S]*?<\/script>/i, `<script id="route-structured-data" type="application/ld+json">${JSON.stringify(buildStructuredData(page))}</script>`)
    .replace('<div id="app"></div>', `<div id="app">${renderSnapshot(page)}</div>`);

  html = replaceMeta(html, "description", config.description);
  html = replaceMeta(html, "robots", "index,follow,max-image-preview:large");
  html = replaceMeta(html, "og:url", url);
  html = replaceMeta(html, "og:title", config.title);
  html = replaceMeta(html, "og:description", config.description);
  html = replaceMeta(html, "twitter:title", config.title);
  html = replaceMeta(html, "twitter:description", config.description);
  return html;
}

for (const page of SEO_PAGE_KEYS) {
  const config = SEO_PAGES[page];
  const filename = page === "home" ? "index.html" : `${config.path.slice(1)}.html`;
  await writeFile(join(outputDirectory, filename), renderRoute(page));
}

const notFoundTitle = "Page Not Found | PDFMech";
let notFound = template
  .replace(/<title>[\s\S]*?<\/title>/i, `<title>${notFoundTitle}</title>`)
  .replace(/<link rel="canonical"[^>]*>\s*/i, "")
  .replace(/<script id="route-structured-data"[^>]*>[\s\S]*?<\/script>/i, "")
  .replace('<div id="app"></div>', '<div id="app"><main class="seo-snapshot seo-not-found"><section><p>404</p><h1>Page not found</h1><p>The PDFMech page you requested does not exist or may have moved.</p><a href="/">Return home</a><a href="/editor">Open the PDF editor</a></section></main></div>');
notFound = replaceMeta(notFound, "description", "The requested PDFMech page could not be found. Return home or open the free browser PDF editor.");
notFound = replaceMeta(notFound, "robots", "noindex,follow");
notFound = replaceMeta(notFound, "og:url", `${SITE_ORIGIN}/404`);
notFound = replaceMeta(notFound, "og:title", notFoundTitle);
notFound = replaceMeta(notFound, "og:description", "The requested PDFMech page could not be found.");
notFound = replaceMeta(notFound, "twitter:title", notFoundTitle);
notFound = replaceMeta(notFound, "twitter:description", "The requested PDFMech page could not be found.");
await writeFile(join(outputDirectory, "404.html"), notFound);

const sitemapEntries = [
  ...SEO_PAGE_KEYS.map((page) => ({ url: canonicalUrl(page), modified: lastModifiedDate(page) })),
  ...blogPosts.map((post) => ({ url: `${SITE_ORIGIN}/blog/${post.slug}`, modified: post.modified.split("T")[0] })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map((entry) => `  <url>\n    <loc>${escapeHtml(entry.url)}</loc>\n    <lastmod>${escapeHtml(entry.modified)}</lastmod>\n  </url>`).join("\n")}\n</urlset>\n`;
await writeFile(join(outputDirectory, "sitemap.xml"), sitemap);

if (!template.includes(`content="${SITE_ORIGIN}${SOCIAL_IMAGE_PATH}"`)) {
  throw new Error("The social sharing image metadata is missing from index.html.");
}
