import { mkdir, readFile, writeFile } from "node:fs/promises";
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
import { BUILD_BLOG_FALLBACK } from "../src/blog-fallback.ts";
import { sanitizeBlogHtmlForBuild } from "./sanitize-blog-html.mjs";
import { guideForToolPath, relatedTools } from "../src/tool-discovery.ts";

const outputDirectory = join(process.cwd(), "dist");
const template = await readFile(join(outputDirectory, "index.html"), "utf8");
let blogPosts;
try {
  const publishedPosts = await getBlogPosts(100, sanitizeBlogHtmlForBuild);
  blogPosts = publishedPosts.length > 0 ? publishedPosts : BUILD_BLOG_FALLBACK;
  if (publishedPosts.length === 0) {
    console.warn("WordPress returned no published posts; using the last-known blog inventory.");
  }
} catch (error) {
  console.warn("WordPress was unavailable during prerender; using the last-known blog inventory.", error);
  blogPosts = BUILD_BLOG_FALLBACK;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function serializeInlineJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function replaceMeta(html, selector, value) {
  const attribute = selector.startsWith("og:") ? "property" : "name";
  const pattern = new RegExp(`<meta\\s+${attribute}="${selector}"[^>]*>`, "i");
  return html.replace(pattern, `<meta ${attribute}="${selector}" content="${escapeHtml(value)}" />`);
}

const MARKETING_SNAPSHOT_SECTIONS = {
  home: [
    ["Choose the PDF task you need", "PDFMech provides focused tools for adding text, filling forms, organizing pages, merging or splitting documents, OCR, privacy cleanup, signing, and other common PDF jobs. Start from the tools directory when you know the result you need, or open the editor for text, visual covers, and page organization in one workspace."],
    ["Work locally in your browser", "Supported processing runs on your device instead of sending the source document to a PDFMech editing server. This local approach keeps routine document work direct and avoids an account or upload queue. Some advanced formats, very large files, or limited devices may still need a different specialist workflow."],
    ["Download and verify a new copy", "PDFMech leaves the original file unchanged and creates a separate result for download. Review page order, visible edits, form values, searchability, security settings, and filenames before sharing important documents. Each tool explains what it changes and identifies limits such as raster output, invalidated signatures, or visual whiteout that is not secure redaction."],
  ],
  editor: [
    ["Edit a PDF in your browser", "Open a PDF from your device and work in a document-focused editor without creating an account. Use the text tool to place new text boxes, choose a font, change size and color, apply bold, italic, or underline styling, and align the added text. The editor adds content above the existing page rather than rewriting embedded source text."],
    ["Cover content and organize pages", "Use Whiteout for a visible cover when you only need to hide something from view, and use secure redaction when underlying sensitive content must be removed. The Pages workspace lets you rotate, reorder, or delete complete pages. Review every page after making structural changes so that no required information is omitted or placed in the wrong order."],
    ["Keep the source and check the download", "Editing and recovery are handled in the current browser, and the source document is not sent to a PDFMech editing server. Download creates a separate PDF instead of replacing the original file. Open the result in a trusted PDF reader and verify text placement, page sequence, links, forms, signatures, and other important document features before relying on it."],
  ],
  features: [
    ["Focused tools for common PDF work", "Choose a purpose-built workflow for adding text, filling or flattening forms, OCR, page extraction, splitting, merging, compression, metadata cleanup, comparison, protection, signing, and more. Focused tools keep the controls relevant to the task while the main editor combines text, visual covers, and basic page organization."],
    ["Browser-local processing by design", "Supported PDF operations run in your browser so the working document does not need to be uploaded to a PDFMech processing server. Local recovery can preserve editing state in this browser on this device when enabled. The security and privacy pages explain storage behavior, user controls, and the limits of this processing model."],
    ["Clear output and product limits", "Every workflow creates a separate downloadable result and leaves the source file unchanged. Tool pages explain whether pages remain native, become images, retain selectable text, or may lose document-level features. Review warnings for digital signatures, encryption, forms, annotations, metadata, links, and accessibility before using a result in a sensitive or regulated process."],
  ],
  howItWorks: [
    ["Choose the exact PDF task", "Start with the editor or select a focused tool for the outcome you need. A focused page provides the relevant upload control, settings, preview, validation, and download action without unrelated options. Read the short tool description first when two workflows appear similar, such as visual whiteout and permanent redaction."],
    ["Make changes on your device", "Choose a supported file and review its pages before changing anything. PDFMech performs supported processing locally in the browser and does not send the source PDF to a document-editing server. Progress messages and validation results show what the tool is doing and identify errors that must be resolved before export."],
    ["Download, open, and verify", "The finished document is downloaded as a new file, while your original remains unchanged. Open the output in a trusted PDF reader and check every important page. Confirm names, ranges, page order, form values, text placement, search results, security settings, and any warnings about signatures or converted content before sharing or archiving the result."],
  ],
  faq: [
    ["Files stay on your device", "Supported PDF processing runs in the current browser rather than on a PDFMech document-editing server. Local recovery may store a browser copy and editing state on this device so work can be restored. You can clear that recovery data from the editor, and you should avoid shared or untrusted devices for sensitive documents."],
    ["PDFMech creates a separate result", "The original PDF is not overwritten. Each editing or conversion workflow creates a new file for you to download and inspect. Browser download behavior determines where that file is saved. If the document is important, keep the source copy and compare the output in a trusted reader before replacing any existing record."],
    ["Whiteout and redaction are different", "Whiteout places an opaque visual cover over content and is useful for presentation fixes, but underlying text or data may remain in the PDF. Secure redaction creates new marked page content without retaining what was beneath the selected areas. Always use the redaction tool and independently verify the result when removing sensitive information."],
  ],
  security: [
    ["Local processing is the default boundary", "PDFMech is designed to perform supported edits, previews, conversions, and downloads in your browser. The source document is not sent to a PDFMech document-processing server for those operations. Your browser still loads the website files, and external links or separately enabled services follow their own policies."],
    ["Recovery remains under browser control", "The editor may save a local copy and editing state in browser storage on the current device to help recover work. This is not a cloud document library or account backup. Clear local recovery after sensitive work, use a trusted and updated device, and understand that browser storage may be accessible to other people who use the same profile."],
    ["Security depends on the correct tool", "A visual whiteout is not secure redaction, and an electronic signature image is not a cryptographic digital signature. Splitting, flattening, compression, conversion, or editing may invalidate existing signatures or remove interactive features. Review each tool's warnings, verify downloaded files independently, and use specialist compliance software when legal or regulatory assurance is required."],
  ],
  terms: [
    ["Use documents you are authorized to handle", "Only open, edit, convert, sign, protect, or download documents when you have the legal right and necessary permission to do so. Do not use PDFMech to violate privacy, copyright, confidentiality, contractual duties, access controls, or applicable law. You remain responsible for the files, information, and instructions you provide to the browser."],
    ["Review every generated result", "PDF processing can change page structure, interactive fields, links, metadata, annotations, encryption, accessibility information, or digital signatures. PDFMech leaves the source file unchanged and provides a separate download, but you must inspect the output before relying on or distributing it. Keep backups for documents that are important, sensitive, or difficult to replace."],
    ["Service scope and availability", "PDFMech is provided for practical browser-based document tasks and may not support every PDF feature, browser, device, or file size. Tools, limits, and availability may change as the product develops. The service does not replace legal, security, archival, accessibility, or compliance review, and no workflow guarantees fitness for every professional purpose."],
  ],
  about: [
    ["Why PDFMech exists", "Everyday PDF fixes should be straightforward. PDFMech brings focused editing, organization, conversion, OCR, form, privacy, and review tools into the browser so users can complete common tasks without creating an account or placing documents in an unnecessary cloud library. Each workflow is designed around a clear input, review step, and downloadable result."],
    ["Built by Muhammad Rehan", "PDFMech is created and maintained by Muhammad Rehan, a computer engineer focused on useful web products and reliable document workflows. Product decisions emphasize understandable controls, responsive interfaces, honest limitations, and privacy-conscious browser processing. The site continues to improve through testing, real usage feedback, and careful expansion of its toolset."],
    ["Practical privacy with clear limits", "Supported operations are performed locally in the browser and create a separate output while leaving the source file unchanged. PDFMech explains when an operation rasterizes pages, changes document features, affects signatures, or provides only a visual cover. Users should review important downloads independently and choose specialist software when stronger legal, security, or compliance guarantees are required."],
  ],
  privacy: [
    ["PDF and edit data", "Supported PDF processing takes place in your browser, and the source document is not uploaded to a PDFMech document-editing server. Files you deliberately download remain under your device and browser controls. If you follow an external link or use a separate third-party service, that service may process information under its own privacy terms."],
    ["Local recovery and browser storage", "The editor may save a browser-local copy of a document and editing state on this device to support recovery. This information is not an account-based cloud library. You can remove recovery data from the editor, clear site data through browser settings, or use a private browsing session when appropriate. Shared devices require particular care."],
    ["Website requests and support messages", "Like most websites, PDFMech hosting may receive technical request information needed to deliver pages, protect the service, and diagnose failures. Contact messages contain the details you choose to provide, so do not send confidential source PDFs or sensitive personal data unless a secure method has been agreed. Privacy choices and browser controls remain available to you."],
  ],
  contact: [
    ["Get useful PDFMech support", "Use the contact option when a PDF does not open, a tool produces an unexpected result, recovery does not restore work, or a download cannot be completed. Explain which tool and browser you used, the device type, the step that failed, and the exact message shown. Clear reproduction details make technical investigation faster and more accurate."],
    ["Describe the document without exposing it", "Include the PDF's approximate size, page count, whether it is scanned, protected, signed, or form-enabled, and whether the problem affects every page. Screenshots can help when they do not reveal private information. Do not send passwords, confidential documents, financial records, identification files, or other sensitive content through an ordinary support message."],
    ["Check the available guidance first", "The FAQ explains downloads, local processing, recovery, whiteout, and common editing behavior. Tool pages describe supported inputs, output changes, and important limits, while the security and privacy pages explain the browser-local model. For urgent legal, archival, accessibility, or compliance requirements, consult an appropriate specialist rather than relying only on general product support."],
  ],
};

function renderMarketingSnapshotSections(page) {
  const sections = MARKETING_SNAPSHOT_SECTIONS[page];
  if (sections === undefined) return "";
  return `<section class="seo-snapshot-details" aria-label="About this PDFMech page">${sections.map(([heading, body]) => `<article><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></article>`).join("")}</section>`;
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
  const primaryNavKeys = ["home", "tools", "features", "howItWorks", "blog", "faq", "about", "contact"];
  const nav = primaryNavKeys
    .map((key) => `<a href="${SEO_PAGES[key].path}">${routeLabels[key] ?? key}</a>`)
    .join("");
  const fallbackRelatedPages = {
    home: ["tools", "editor", "blog", "security"],
    features: ["tools", "howItWorks", "blog", "privacy"],
    howItWorks: ["editor", "tools", "faq", "privacy"],
    blog: ["tools", "editor", "ocrPdf", "editPdfOnIphone"],
    faq: ["tools", "howItWorks", "contact", "security"],
    security: ["privacy", "privatePdfEditor", "redactPdf", "protectPdf"],
    terms: ["privacy", "security", "contact", "tools"],
    about: ["tools", "blog", "security", "contact"],
    privacy: ["security", "privatePdfEditor", "tools", "contact"],
    contact: ["faq", "about", "privacy", "tools"],
  };
  const relatedToolLinks = relatedTools(config.path);
  const guide = guideForToolPath(config.path);
  const related = relatedToolLinks.length > 0
    ? `${relatedToolLinks.map((tool) => `<a href="${tool.path}">${escapeHtml(tool.name)}</a>`).join("")}<a href="/tools">View all PDF tools</a>${guide === null ? "" : `<a href="${guide.path}">${escapeHtml(guide.title)}</a>`}`
    : (fallbackRelatedPages[page] ?? ["tools", "blog", "privacy", "contact"])
      .filter((key) => key !== page)
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
    ? `<section aria-label="Latest PDF guides"><h2>Latest articles</h2>${blogPosts.length === 0 ? "<p>New PDF guides are on the way.</p>" : blogPosts.map((post) => `<article><h3><a href="/blog/${post.slug}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.excerpt || "Read this practical PDF guide from PDFMech.")}</p><time datetime="${escapeHtml(post.date)}">${escapeHtml(formatBlogDate(post.date))}</time></article>`).join("")}</section><section class="seo-snapshot-details" aria-label="About PDFMech guides"><article><h2>Practical answers connected to working tools</h2><p>PDFMech guides explain common document problems, show the browser-based steps that solve them, and link directly to the relevant tool. Articles cover editing, OCR, forms, page organization, privacy, conversion, and safer document handling without turning a simple task into a wall of theory.</p></article><article><h2>Written for careful document work</h2><p>Each guide identifies important limits and review points, including when content becomes an image, when a signature may stop being valid, and why visual whiteout is different from secure redaction. Keep the original file and verify every important output before sharing it.</p></article></section>`
    : "";
  const marketingContent = renderMarketingSnapshotSections(page);
  const toolContent = isToolsDirectory
    ? `<section><h2>Choose your PDF tool</h2><p>Use a focused browser-local workflow for editing, organizing, scanning, forms, privacy, or document review.</p>${TOOL_SEO_PAGE_KEYS.map((toolPage) => `<article><h3><a href="${SEO_PAGES[toolPage].path}">${escapeHtml(SEO_PAGES[toolPage].h1)}</a></h3><p>${escapeHtml(SEO_PAGES[toolPage].description)}</p></article>`).join("")}</section><aside><h2>Edit a PDF on iPhone</h2><p>Follow the Safari and Files workflow without installing an app.</p><a href="/edit-pdf-on-iphone">Read the iPhone PDF guide</a></aside>`
    : isAddTextTool
      ? `<section><h2>How to add text to a PDF</h2><ol><li>Choose a PDF from your device.</li><li>Click or tap where the new text should appear.</li><li>Adjust font, size, color, bold style, and alignment.</li><li>Review and download a separate edited copy.</li></ol><h2>Private local text placement</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>What the Text tool changes</h2><p>PDFMech adds a new editable text box above the PDF page. It does not rewrite text already embedded in the original PDF.</p></section>`
    : isDeletePagesTool
      ? `<section><h2>How to delete PDF pages</h2><ol><li>Choose a PDF from your device.</li><li>Select an unwanted page from the thumbnails.</li><li>Delete the selected page and review the remaining page count.</li><li>Download a separate edited copy.</li></ol><h2>Private local page deletion</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Remove complete pages</h2><p>PDFMech removes selected pages from the working document used for export. Your original PDF file remains unchanged on your device.</p></section>`
      : isReorderPagesTool
        ? `<section><h2>How to reorder PDF pages</h2><ol><li>Choose a PDF from your device.</li><li>Select a page from the thumbnails.</li><li>Move the selected page earlier or later in the document.</li><li>Review the sequence and download a separate organized copy.</li></ol><h2>Private local page reordering</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Move complete pages</h2><p>PDFMech changes the page sequence in the working document used for export. Your original PDF file remains unchanged on your device.</p></section>`
        : isRotatePagesTool
          ? `<section><h2>How to rotate PDF pages</h2><ol><li>Choose a PDF from your device.</li><li>Select a sideways or upside-down page from the thumbnails.</li><li>Rotate the selected page clockwise by 90 degrees.</li><li>Review the orientation and download a separate corrected copy.</li></ol><h2>Private local page rotation</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Correct individual page orientation</h2><p>PDFMech rotates only the selected page in the working document used for export. Your original PDF file remains unchanged on your device.</p></section>`
          : isWhiteoutTool
            ? `<section><h2>How to white out PDF content</h2><ol><li>Choose a PDF from your device.</li><li>Click or tap where a visual cover should appear.</li><li>Move, resize, and recolor the whiteout cover.</li><li>Review the page and download a separate edited copy.</li></ol><h2>Private local visual whiteout</h2><p>Your source PDF is processed in this browser and is not sent to PDFMech for editing. Local recovery may store a browser copy and editing state on this device.</p><h2>Visual cover, not secure redaction</h2><p>Whiteout places an opaque cover over visible content. It does not guarantee removal of underlying PDF text, metadata, or other data.</p></section>`
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

  return `<div class="seo-snapshot" data-page="${page}"><header><a href="/" aria-label="PDFMech home"><img src="/PDFMechLogo-small.webp" width="55" height="55" alt=""><strong>PDFMech</strong></a><nav aria-label="Main navigation">${nav}</nav><a class="seo-snapshot-cta" href="/editor">Open PDF</a><span class="seo-snapshot-menu" aria-hidden="true">Menu</span></header><main><nav aria-label="Breadcrumb"><a href="/">Home</a>${page === "home" ? "" : `<span aria-hidden="true">/</span><span>${escapeHtml(config.h1)}</span>`}</nav><section><p>Private browser PDF editing</p><h1>${escapeHtml(config.h1)}</h1><p>${escapeHtml(config.intro)}</p><a href="${actionPath}">${actionLabel}</a></section>${blogContent}${marketingContent}${toolContent}${faqContent}<nav aria-label="Related PDFMech pages"><strong>Explore PDFMech</strong>${related}</nav></main><footer><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/security">Security</a><a href="/terms">Terms</a><a href="/sitemap.xml">Sitemap</a></footer></div>`;
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
  if (page === "blog") {
    const archivePosts = blogPosts.map((post) => ({ ...post, contentHtml: "" }));
    html = html.replace(
      /<\/head>/i,
      `<script id="blog-posts-data" type="application/json">${serializeInlineJson(archivePosts)}</script>\n  </head>`,
    );
  }
  return html;
}

for (const page of SEO_PAGE_KEYS) {
  // /blog is served by the cached Vercel archive function. Keeping blog.html
  // at the public root would make Vercel's filesystem shadow that rewrite.
  if (page === "blog") continue;
  const config = SEO_PAGES[page];
  const filename = page === "home" ? "index.html" : `${config.path.slice(1)}.html`;
  await writeFile(join(outputDirectory, filename), renderRoute(page));
}

const internalFallbackDirectory = join(outputDirectory, "_internal");
await mkdir(internalFallbackDirectory, { recursive: true });
await writeFile(join(internalFallbackDirectory, "blog.html"), renderRoute("blog"));

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
// /sitemap.xml is served by the cached Vercel sitemap function. The verified
// build copy remains private fallback data for WordPress outages.
await writeFile(join(internalFallbackDirectory, "sitemap.xml"), sitemap);

if (!template.includes(`content="${SITE_ORIGIN}${SOCIAL_IMAGE_PATH}"`)) {
  throw new Error("The social sharing image metadata is missing from index.html.");
}
