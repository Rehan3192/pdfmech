import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { normalizeOcrText, parseOcrPageRange } from "../domain/ocr";
import { TOOL_ROUTE_FAQS } from "../seo-config";
import type {
  OcrInspection,
  OcrProcessResult,
  OcrProcessor,
  OcrProgress,
} from "../ports/ocr";
import type { ProductEvent } from "../tool-routes";

type OcrUiPhase =
  | "empty"
  | "inspecting"
  | "ready"
  | "processing"
  | "complete"
  | "error";

interface OcrPdfPageProps {
  readonly processor: OcrProcessor;
  readonly onOpenEditor: () => void;
  readonly onProductEvent: (event: ProductEvent) => void;
}

export function OcrPdfPage({
  processor,
  onOpenEditor,
  onProductEvent,
}: OcrPdfPageProps) {
  const [phase, setPhase] = useState<OcrUiPhase>("empty");
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<OcrInspection | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [rangeMode, setRangeMode] = useState<"all" | "custom">("all");
  const [customRange, setCustomRange] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [result, setResult] = useState<OcrProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [thumbnailUrls, setThumbnailUrls] = useState<readonly (string | null)[]>([]);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);
  const [textDownloadUrl, setTextDownloadUrl] = useState<string | null>(null);
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => {
    const urls =
      inspection?.pages.map((page) =>
        page.thumbnail === null ? null : URL.createObjectURL(page.thumbnail),
      ) ?? [];
    setThumbnailUrls(urls);
    return () => {
      for (const url of urls) {
        if (url !== null) URL.revokeObjectURL(url);
      }
    };
  }, [inspection]);

  useEffect(() => {
    if (result === null) {
      setPdfDownloadUrl(null);
      setTextDownloadUrl(null);
      return;
    }
    const pdfUrl = URL.createObjectURL(result.searchablePdf);
    const textUrl = URL.createObjectURL(result.extractedText);
    setPdfDownloadUrl(pdfUrl);
    setTextDownloadUrl(textUrl);
    return () => {
      URL.revokeObjectURL(pdfUrl);
      URL.revokeObjectURL(textUrl);
    };
  }, [result]);

  useEffect(
    () => () => {
      activeController.current?.abort();
    },
    [],
  );

  const activeStep =
    phase === "empty" || phase === "inspecting" || phase === "error"
      ? 1
      : phase === "ready"
        ? 2
        : phase === "processing"
          ? 3
          : 4;

  const searchMatches = useMemo(() => {
    const query = normalizeOcrText(searchQuery);
    if (query.length === 0 || result === null) return [];
    return result.pages
      .map((page) => ({
        pageNumber: page.pageIndex + 1,
        matches: countOccurrences(normalizeOcrText(page.text), query),
      }))
      .filter((page) => page.matches > 0);
  }, [result, searchQuery]);

  async function inspectFile(nextFile: File | undefined): Promise<void> {
    if (nextFile === undefined) return;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setFile(nextFile);
    setInspection(null);
    setResult(null);
    setError(null);
    setRangeError(null);
    setSelectedPageIndex(0);
    setRangeMode("all");
    setCustomRange("");
    setSearchQuery("");
    setPhase("inspecting");
    onProductEvent({ name: "pdf_selected", tool: "ocr" });
    try {
      const nextInspection = await processor.inspect(nextFile, controller.signal);
      setInspection(nextInspection);
      setPhase("ready");
      onProductEvent({ name: "editor_loaded", tool: "ocr" });
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(messageFromError(caught));
      setPhase("error");
    } finally {
      if (activeController.current === controller) {
        activeController.current = null;
      }
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const [nextFile] = event.currentTarget.files ?? [];
    void inspectFile(nextFile);
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    setDragActive(false);
    const [nextFile] = event.dataTransfer.files;
    void inspectFile(nextFile);
  }

  function selectedPageIndexes(): readonly number[] | null {
    if (inspection === null) return null;
    if (rangeMode === "all") {
      return Array.from({ length: inspection.pageCount }, (_, index) => index);
    }
    try {
      const parsed = parseOcrPageRange(customRange, inspection.pageCount);
      setRangeError(null);
      return parsed;
    } catch (caught) {
      setRangeError(messageFromError(caught));
      return null;
    }
  }

  async function startOcr(): Promise<void> {
    if (file === null || inspection === null) return;
    const pageIndexes = selectedPageIndexes();
    if (pageIndexes === null) return;

    const controller = new AbortController();
    activeController.current = controller;
    setError(null);
    setResult(null);
    setProgress(null);
    setPhase("processing");
    onProductEvent({ name: "edit_action", tool: "ocr" });
    try {
      const nextResult = await processor.process(
        file,
        { pageIndexes, language: "eng" },
        setProgress,
        controller.signal,
      );
      setResult(nextResult);
      setProgress(null);
      setPhase("complete");
      onProductEvent({ name: "export_success", tool: "ocr" });
    } catch (caught) {
      if (controller.signal.aborted) {
        setPhase("ready");
        setProgress(null);
        return;
      }
      setError(messageFromError(caught));
      setPhase("error");
    } finally {
      if (activeController.current === controller) {
        activeController.current = null;
      }
    }
  }

  function startOver(): void {
    activeController.current?.abort();
    activeController.current = null;
    setPhase("empty");
    setFile(null);
    setInspection(null);
    setResult(null);
    setProgress(null);
    setError(null);
    setRangeError(null);
    setSearchQuery("");
  }

  const selectedPreview = thumbnailUrls[selectedPageIndex] ?? null;

  return (
    <main className="ocr-page" data-testid="site-ocr-pdf">
      <section className="ocr-hero" aria-labelledby="ocr-page-title">
        <span className="hero-kicker">Private browser OCR</span>
        <h1 id="ocr-page-title">Make scanned PDFs searchable.</h1>
        <p>
          Convert scanned documents into searchable, selectable PDFs directly
          in your browser. Your document is never sent to an OCR server.
        </p>
        <ul className="ocr-trust-row" aria-label="OCR tool benefits">
          <li><span aria-hidden="true">✓</span> Free</li>
          <li><span aria-hidden="true">▣</span> No signup</li>
          <li><span aria-hidden="true">ϟ</span> Files stay on your device</li>
        </ul>
      </section>

      <ol className="ocr-stepper" aria-label="OCR workflow">
        {[
          [1, "Upload PDF", "Choose a scanned document"],
          [2, "Review & settings", "Choose pages and language"],
          [3, "Processing", "OCR runs in this browser"],
          [4, "Complete", "Download searchable output"],
        ].map(([number, title, description]) => (
          <li
            key={number}
            data-active={activeStep === number ? "true" : "false"}
            data-complete={activeStep > Number(number) ? "true" : "false"}
          >
            <span>{activeStep > Number(number) ? "✓" : number}</span>
            <div><strong>{title}</strong><small>{description}</small></div>
          </li>
        ))}
      </ol>

      <section className="ocr-workbench" data-phase={phase}>
        {phase === "empty" || phase === "inspecting" ? (
          <section
            id="ocr-pdf-tool"
            className="ocr-upload-card"
            data-drag-active={dragActive ? "true" : "false"}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <span className="ocr-upload-icon" aria-hidden="true">PDF</span>
            <h2>{phase === "inspecting" ? "Checking your PDF..." : "Drop your PDF here"}</h2>
            <p>
              {phase === "inspecting"
                ? "Reading pages and checking which ones already contain searchable text."
                : "Choose an image-based or scanned PDF to make searchable."}
            </p>
            {phase === "inspecting" ? (
              <span className="ocr-spinner" aria-label="Inspecting PDF" />
            ) : (
              <label className="ocr-primary-button">
                <span>Choose PDF File</span>
                <input
                  data-testid="ocr-file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                />
              </label>
            )}
            <small>PDF only · up to 100 MB · processed locally</small>
            <div className="ocr-local-note">
              <strong>Your PDF stays on your device.</strong>
              <span>No document pages or recognized text are uploaded.</span>
            </div>
          </section>
        ) : null}

        {phase === "ready" && inspection !== null && file !== null ? (
          <div className="ocr-review-layout">
            <aside className="ocr-page-list" aria-label="PDF pages">
              <header><strong>{formatCount(inspection.pageCount, "page")}</strong><small>Choose a preview</small></header>
              <div>
                {inspection.pages.map((page) => (
                  <button
                    key={page.pageIndex}
                    type="button"
                    data-selected={selectedPageIndex === page.pageIndex ? "true" : "false"}
                    onClick={() => setSelectedPageIndex(page.pageIndex)}
                  >
                    {thumbnailUrls[page.pageIndex] !== null ? (
                      <img src={thumbnailUrls[page.pageIndex] ?? undefined} alt="" />
                    ) : (
                      <span className="ocr-thumbnail-placeholder">PDF</span>
                    )}
                    <span>{page.pageIndex + 1}</span>
                    {page.hasUsefulNativeText ? <small title="Already searchable">Text</small> : null}
                  </button>
                ))}
              </div>
            </aside>

            <section className="ocr-preview-panel">
              <header>
                <div><strong>{file.name}</strong><small>{formatCount(inspection.pageCount, "page")} · {formatBytes(file.size)}</small></div>
                <button type="button" onClick={startOver} aria-label="Remove PDF">×</button>
              </header>
              <div className="ocr-preview-page">
                {selectedPreview !== null ? (
                  <img src={selectedPreview} alt={`Preview of page ${selectedPageIndex + 1}`} />
                ) : (
                  <span>Preview unavailable for this page</span>
                )}
              </div>
              <footer>
                <button type="button" onClick={() => setSelectedPageIndex((value) => Math.max(0, value - 1))} disabled={selectedPageIndex === 0}>‹</button>
                <strong>{selectedPageIndex + 1} / {inspection.pageCount}</strong>
                <button type="button" onClick={() => setSelectedPageIndex((value) => Math.min(inspection.pageCount - 1, value + 1))} disabled={selectedPageIndex === inspection.pageCount - 1}>›</button>
              </footer>
            </section>

            <aside className="ocr-settings-panel">
              <span className="hero-kicker">OCR settings</span>
              <h2>Ready to make it searchable.</h2>
              <label>
                Language
                <select value="eng" disabled><option value="eng">English (recommended)</option></select>
              </label>
              <fieldset>
                <legend>Pages to process</legend>
                <label><input type="radio" checked={rangeMode === "all"} onChange={() => { setRangeMode("all"); setRangeError(null); }} /> All pages ({inspection.pageCount})</label>
                <label><input type="radio" checked={rangeMode === "custom"} onChange={() => setRangeMode("custom")} /> Custom range</label>
                {rangeMode === "custom" ? (
                  <input
                    aria-label="Custom OCR page range"
                    value={customRange}
                    onChange={(event) => setCustomRange(event.currentTarget.value)}
                    placeholder="e.g. 1-5, 8, 12"
                  />
                ) : null}
                {rangeError !== null ? <small className="ocr-field-error">{rangeError}</small> : null}
              </fieldset>
              <div className="ocr-output-options">
                <strong>Output</strong>
                <span>✓ Keep the original page appearance</span>
                <span>✓ Add a searchable invisible text layer</span>
                <span>✓ Include a plain-text download</span>
              </div>
              <p className="ocr-setting-note">
                Pages that already contain useful text are preserved to avoid duplicate layers.
              </p>
              <button className="ocr-primary-button" type="button" onClick={() => void startOcr()}>
                Make PDF Searchable <span aria-hidden="true">→</span>
              </button>
            </aside>
          </div>
        ) : null}

        {phase === "processing" ? (
          <section className="ocr-processing-card" aria-live="polite">
            <span className="ocr-processing-symbol" aria-hidden="true">OCR</span>
            <span className="hero-kicker">Local processing</span>
            <h2>Making your PDF searchable...</h2>
            <p>{progress?.message ?? "Preparing the OCR engine..."}</p>
            <div className="ocr-progress-track"><span style={{ width: `${Math.round((progress?.overallProgress ?? 0) * 100)}%` }} /></div>
            <strong>{Math.round((progress?.overallProgress ?? 0) * 100)}%</strong>
            <dl>
              <div><dt>Pages complete</dt><dd>{progress?.completedPages ?? 0} / {progress?.totalPages ?? inspection?.pageCount ?? 0}</dd></div>
              <div><dt>Current step</dt><dd>{progressLabel(progress)}</dd></div>
              <div><dt>Privacy</dt><dd>No document upload</dd></div>
            </dl>
            <button className="ocr-cancel-button" type="button" onClick={() => activeController.current?.abort()}>
              Cancel processing
            </button>
          </section>
        ) : null}

        {phase === "complete" && result !== null && file !== null ? (
          <section className="ocr-complete-layout">
            <div className="ocr-success-summary">
              <span className="ocr-success-icon" aria-hidden="true">✓</span>
              <div>
                <span className="hero-kicker">Complete</span>
                <h2>Your PDF is searchable.</h2>
                <p>
                  {formatCount(result.processedPageCount, "page")} OCR processed · {formatCount(result.skippedNativePageCount, "page")} already searchable · completed in {formatDuration(result.durationMs)}
                </p>
              </div>
            </div>
            <div className="ocr-downloads">
              {pdfDownloadUrl !== null ? (
                <a
                  className="ocr-primary-button"
                  href={pdfDownloadUrl}
                  download={searchableFileName(file.name)}
                  onClick={() => onProductEvent({ name: "export_clicked", tool: "ocr" })}
                >Download Searchable PDF</a>
              ) : null}
              {textDownloadUrl !== null ? (
                <a href={textDownloadUrl} download={textFileName(file.name)}>Download Extracted Text (.txt)</a>
              ) : null}
            </div>
            <div className="ocr-search-check">
              <h3>Try it out</h3>
              <p>Search the recognized text before downloading.</p>
              <label><span aria-hidden="true">⌕</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.currentTarget.value)} placeholder="Search recognized text" /></label>
              {normalizeOcrText(searchQuery).length > 0 ? (
                <div className="ocr-search-results">
                  <strong>{searchMatches.reduce((total, page) => total + page.matches, 0)} matches</strong>
                  {searchMatches.length > 0 ? searchMatches.slice(0, 8).map((page) => <span key={page.pageNumber}>Page {page.pageNumber} · {page.matches}</span>) : <span>No matches found</span>}
                </div>
              ) : null}
            </div>
            <footer>
              <button type="button" onClick={startOver}>Start over</button>
              <button type="button" onClick={onOpenEditor}>Open PDF Editor</button>
            </footer>
          </section>
        ) : null}

        {phase === "error" ? (
          <section className="ocr-error-card" role="alert">
            <span aria-hidden="true">!</span>
            <h2>OCR could not finish.</h2>
            <p>{error ?? "An unexpected local-processing error occurred."}</p>
            <div>
              {inspection !== null ? <button type="button" onClick={() => setPhase("ready")}>Return to settings</button> : null}
              <button type="button" onClick={startOver}>Choose another PDF</button>
            </div>
          </section>
        ) : null}
      </section>

      <section className="ocr-value-grid" aria-label="About searchable PDFs">
        <article><span aria-hidden="true">⌕</span><div><h2>What is a searchable PDF?</h2><p>A searchable PDF keeps the scanned page image and adds hidden text so you can search, select and copy words.</p></div></article>
        <article><span aria-hidden="true">▤</span><div><h2>Built for scanned documents</h2><p>Use it for image-based invoices, contracts, receipts, readings and records with printed English text.</p></div></article>
        <article><span aria-hidden="true">▣</span><div><h2>Private and local</h2><p>PDF rendering, recognition and output generation happen in this browser. Document content is not uploaded.</p></div></article>
        <article><span aria-hidden="true">ϟ</span><div><h2>Free to use</h2><p>No signup, watermark or paid OCR API. Technical limits protect phones and browsers from oversized processing jobs.</p></div></article>
      </section>

      <section className="ocr-seo-content">
        <article><span className="hero-kicker">How it works</span><h2>Browser-local OCR in four clear steps.</h2><ol><li>Choose a scanned PDF from your device.</li><li>Review the pages and choose a range.</li><li>PDFMech recognizes printed text locally and adds an invisible layer.</li><li>Validate and download the searchable PDF or extracted TXT file.</li></ol></article>
        <article><span className="hero-kicker">Important limits</span><h2>Searchable does not mean perfectly accurate.</h2><p>OCR can make mistakes on handwriting, blurry scans, unusual layouts, tables or very small text. Review consequential names, dates and numbers against the original page. This tool does not create a fully tagged accessible PDF or certify a legal, archival or healthcare workflow.</p></article>
      </section>

      <section className="ocr-faq" aria-labelledby="ocr-faq-title">
        <div>
          <span className="hero-kicker">OCR FAQ</span>
          <h2 id="ocr-faq-title">Questions about searchable PDFs.</h2>
          <p>Practical answers about privacy, OCR output, accuracy, and your original file.</p>
        </div>
        <div>
          {(TOOL_ROUTE_FAQS.ocrPdf ?? []).map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <nav className="ocr-related-links" aria-label="Related PDFMech tools">
        <a href="/private-pdf-editor"><strong>Private PDF editor</strong><span>Edit text, visual covers, and pages locally.</span></a>
        <a href="/rotate-pdf-pages"><strong>Rotate PDF pages</strong><span>Correct sideways scans before OCR.</span></a>
        <a href="/how-it-works"><strong>How PDFMech works</strong><span>Review local processing and downloads.</span></a>
      </nav>
    </main>
  );
}

function progressLabel(progress: OcrProgress | null): string {
  switch (progress?.phase) {
    case "loading-engine": return "Loading OCR engine";
    case "rendering-page": return "Rendering page locally";
    case "recognizing-text": return "Recognizing printed text";
    case "writing-pdf": return "Writing searchable PDF";
    case "validating-output": return "Validating download";
    default: return "Preparing";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(durationMs: number): string {
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return seconds < 60 ? `${seconds} seconds` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatCount(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function searchableFileName(fileName: string): string {
  return `${fileName.replace(/\.pdf$/i, "")}-searchable.pdf`;
}

function textFileName(fileName: string): string {
  return `${fileName.replace(/\.pdf$/i, "")}-extracted-text.txt`;
}

function countOccurrences(text: string, query: string): number {
  if (query.length === 0) return 0;
  let count = 0;
  let position = 0;
  while ((position = text.indexOf(query, position)) !== -1) {
    count += 1;
    position += query.length;
  }
  return count;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected browser error occurred.";
}
