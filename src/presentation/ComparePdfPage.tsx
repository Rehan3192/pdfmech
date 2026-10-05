import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { comparePdfText, createTextComparisonReport, type ExtractedTextDocument, type PdfComparisonOptions } from "../domain/pdf-compare";
import { createLazyPdfTextExtractor } from "../infrastructure/pdfjs/lazy-text-extractor";

const extractor = createLazyPdfTextExtractor();
const MAX_FILE_BYTES = 100 * 1024 * 1024;

interface CompareProgress {
  readonly label: string;
  readonly pageNumber: number;
  readonly totalPages: number;
}

export function ComparePdfPage() {
  const oldInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<{ readonly oldDocument: ExtractedTextDocument; readonly newDocument: ExtractedTextDocument } | null>(null);
  const [options, setOptions] = useState<PdfComparisonOptions>({ ignoreCase: false, ignoreWhitespace: true });
  const [selectedPage, setSelectedPage] = useState(1);
  const [progress, setProgress] = useState<CompareProgress | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  const comparison = useMemo(() => documents === null ? null : comparePdfText(documents.oldDocument, documents.newDocument, options), [documents, options]);
  const currentPage = comparison?.pages.find((page) => page.pageNumber === selectedPage) ?? comparison?.pages[0] ?? null;

  useEffect(() => {
    if (comparison === null) {
      setReportUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([createTextComparisonReport(comparison)], { type: "text/plain;charset=utf-8" }));
    setReportUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [comparison]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function chooseFile(side: "old" | "new", file: File | null): void {
    if (file === null) return;
    setError(null);
    setDocuments(null);
    if (file.size === 0) {
      setError(`${file.name || "This file"} is empty.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`${file.name} is larger than the 100 MB limit.`);
      return;
    }
    if (!file.name.toLocaleLowerCase("en").endsWith(".pdf") && file.type !== "application/pdf") {
      setError(`${file.name} is not a PDF file.`);
      return;
    }
    if (side === "old") setOldFile(file);
    else setNewFile(file);
  }

  async function runComparison(): Promise<void> {
    if (oldFile === null || newFile === null) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setDocuments(null);
    setIsComparing(true);
    try {
      const oldDocument = await extractor.extract(oldFile, (value) => setProgress({ label: "Reading older PDF", ...value }), controller.signal);
      const newDocument = await extractor.extract(newFile, (value) => setProgress({ label: "Reading newer PDF", ...value }), controller.signal);
      const initialComparison = comparePdfText(oldDocument, newDocument, options);
      setDocuments({ oldDocument, newDocument });
      setSelectedPage(initialComparison.pages.find((page) => page.status !== "unchanged")?.pageNumber ?? 1);
    } catch (compareError) {
      if (!(compareError instanceof Error && compareError.name === "AbortError")) setError(messageFromError(compareError));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setProgress(null);
      setIsComparing(false);
    }
  }

  function startOver(): void {
    abortRef.current?.abort();
    setOldFile(null);
    setNewFile(null);
    setDocuments(null);
    setSelectedPage(1);
    setProgress(null);
    setError(null);
  }

  return (
    <main className="compare-page">
      <section className="compare-hero">
        <span className="hero-kicker">PRIVATE TEXT COMPARISON</span>
        <h1>Compare two PDF files online.</h1>
        <p>Find added and removed text page by page without uploading either document. Comparison runs locally in your browser.</p>
        <div className="compare-trust-row" aria-label="Tool benefits"><span><b aria-hidden="true">✓</b> Free</span><span><b aria-hidden="true">⇄</b> Page by page</span><span><b aria-hidden="true">⚡</b> No upload</span></div>
      </section>

      <section className="compare-tool" id="compare-pdf-tool" aria-labelledby="compare-tool-title">
        <div className="compare-steps" aria-label="Compare PDF workflow">
          <span className={documents === null && !isComparing ? "is-active" : "is-complete"}><b>{documents === null && !isComparing ? "1" : "✓"}</b><i>Choose PDFs</i></span>
          <span className={isComparing ? "is-active" : documents !== null ? "is-complete" : ""}><b>{documents === null ? "2" : "✓"}</b><i>Compare text</i></span>
          <span className={documents !== null ? "is-active" : ""}><b>3</b><i>Review changes</i></span>
        </div>
        <h2 id="compare-tool-title" className="compare-section-title">Choose an older and newer PDF</h2>
        <input ref={oldInputRef} className="compare-file-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => { chooseFile("old", event.target.files?.[0] ?? null); event.target.value = ""; }} />
        <input ref={newInputRef} className="compare-file-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => { chooseFile("new", event.target.files?.[0] ?? null); event.target.value = ""; }} />

        <div className="compare-file-grid">
          <FileCard side="old" label="Older PDF" file={oldFile} disabled={isComparing} onChoose={() => oldInputRef.current?.click()} onDrop={(file) => chooseFile("old", file)} onRemove={() => { setOldFile(null); setDocuments(null); }} />
          <FileCard side="new" label="Newer PDF" file={newFile} disabled={isComparing} onChoose={() => newInputRef.current?.click()} onDrop={(file) => chooseFile("new", file)} onRemove={() => { setNewFile(null); setDocuments(null); }} />
        </div>

        <div className="compare-options">
          <strong>Comparison options</strong>
          <label><input type="checkbox" checked={options.ignoreWhitespace} onChange={(event) => setOptions((current) => ({ ...current, ignoreWhitespace: event.target.checked }))} /> Ignore extra whitespace</label>
          <label><input type="checkbox" checked={options.ignoreCase} onChange={(event) => setOptions((current) => ({ ...current, ignoreCase: event.target.checked }))} /> Ignore capitalization</label>
        </div>

        {progress !== null ? <div className="compare-progress" role="status"><div><strong>{progress.label}</strong><span>Page {progress.pageNumber} of {progress.totalPages}</span></div><progress max={progress.totalPages} value={progress.pageNumber} /></div> : null}
        {error !== null ? <p className="compare-error" role="alert">{error}</p> : null}

        <div className="compare-actions">
          {isComparing ? <button type="button" className="compare-secondary-button" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
          <button type="button" className="compare-primary-button" disabled={oldFile === null || newFile === null || isComparing} onClick={() => void runComparison()}>{isComparing ? "Comparing locally…" : documents === null ? "Compare PDF text" : "Compare again"}</button>
        </div>

        {comparison !== null ? (
          <section className="compare-results" aria-labelledby="compare-results-title">
            <header className="compare-results-header">
              <div><span className="compare-card-kicker">COMPARISON COMPLETE</span><h2 id="compare-results-title">{comparison.changedPageCount === 0 ? "No text differences found" : `${comparison.changedPageCount} changed page${comparison.changedPageCount === 1 ? "" : "s"} found`}</h2><p>Compared {comparison.oldDocument.fileName} with {comparison.newDocument.fileName}.</p></div>
              <div className="compare-result-actions">{reportUrl !== null ? <a href={reportUrl} download={`${baseName(newFile?.name ?? "comparison")}-comparison.txt`}>Download report</a> : null}<button type="button" onClick={startOver}>Start over</button></div>
            </header>

            <div className="compare-stats" aria-label="Comparison summary">
              <div><strong>{comparison.changedPageCount}</strong><span>Changed pages</span></div><div><strong className="is-added">+{comparison.addedLineCount}</strong><span>Added lines</span></div><div><strong className="is-removed">−{comparison.removedLineCount}</strong><span>Removed lines</span></div><div><strong>{comparison.unchangedPageCount}</strong><span>Unchanged pages</span></div>
            </div>

            {comparison.oldDocument.characterCount < 10 || comparison.newDocument.characterCount < 10 ? <p className="compare-warning"><strong>Little or no selectable text detected:</strong> scanned or image-only pages need OCR before a useful text comparison. <a href="/ocr-pdf">Make a PDF searchable with OCR →</a></p> : null}

            <div className="compare-page-tabs" aria-label="Comparison pages">{comparison.pages.map((page) => <button key={page.pageNumber} type="button" className={page.pageNumber === selectedPage ? "is-selected" : ""} data-status={page.status} onClick={() => setSelectedPage(page.pageNumber)}><strong>Page {page.pageNumber}</strong><span>{page.status === "unchanged" ? "No changes" : page.status === "added" ? "New page" : page.status === "removed" ? "Removed page" : `+${page.addedLineCount} −${page.removedLineCount}`}</span></button>)}</div>

            {currentPage !== null ? (
              <div className="compare-diff-card">
                <div className="compare-diff-heading"><div><span>OLDER PDF</span><strong>{comparison.oldDocument.fileName}</strong></div><b>Page {currentPage.pageNumber}</b><div><span>NEWER PDF</span><strong>{comparison.newDocument.fileName}</strong></div></div>
                <div className="compare-diff-columns" role="table" aria-label={`Text differences on page ${currentPage.pageNumber}`}>
                  <div className="compare-diff-column-title" role="columnheader">Older text</div><div className="compare-diff-column-title" role="columnheader">Newer text</div>
                  {currentPage.lines.length === 0 ? <p className="compare-no-text">No selectable text was extracted from either page.</p> : currentPage.lines.map((line, index) => (
                    <div className="compare-diff-row" role="row" key={`${line.kind}-${index}`}>
                      <div role="cell" className={line.kind === "removed" ? "is-removed" : line.kind === "added" ? "is-empty" : ""}><i>{line.oldLineNumber ?? ""}</i><span>{line.kind === "added" ? "" : line.text}</span></div>
                      <div role="cell" className={line.kind === "added" ? "is-added" : line.kind === "removed" ? "is-empty" : ""}><i>{line.newLineNumber ?? ""}</i><span>{line.kind === "removed" ? "" : line.text}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </section>

      <section className="compare-benefits" aria-label="Compare PDF benefits"><article><span aria-hidden="true">⇄</span><div><h2>Page-by-page text changes</h2><p>See added and removed lines with page and line references.</p></div></article><article><span aria-hidden="true">▤</span><div><h2>Downloadable report</h2><p>Save a plain-text summary of the detected changes for review.</p></div></article><article><span aria-hidden="true">⌂</span><div><h2>Private and local</h2><p>Both documents are read and compared inside this browser.</p></div></article></section>

      <section className="compare-seo-copy">
        <h2>How to compare two PDF files</h2><ol><li>Choose the older PDF and the newer PDF.</li><li>Select whether whitespace or capitalization differences should be ignored.</li><li>Compare the extracted text locally in your browser.</li><li>Review changed pages and download a text report.</li></ol>
        <h2>What this PDF comparison detects</h2><p>PDFMech compares selectable text page by page and marks added or removed lines. This first version is useful for revised contracts, reports, policies, proposals, and other text-based PDFs.</p>
        <h2>Text comparison limitations</h2><p>This tool does not detect image, font, color, formatting, drawing, or layout-only changes. Scanned PDFs need OCR first. Pages are aligned by page number, so inserting a page can make later pages appear changed.</p>
        <h2>Compare PDF FAQ</h2><h3>Are my PDFs uploaded?</h3><p>No. Text extraction and comparison run locally in your browser.</p><h3>Can it compare scanned PDFs?</h3><p>Only after the scans contain searchable text. Use PDFMech OCR first when a page is image-only.</p><h3>Does it compare images and formatting?</h3><p>No. This version compares selectable text, not images, fonts, colors, drawings, or visual layout.</p><h3>Why can added pages affect later results?</h3><p>Pages are compared by page number. If one version inserts or removes a page, later pages may no longer be aligned with their matching content.</p>
        <nav className="compare-related-links" aria-label="Related PDF tools"><strong>Related tools</strong><a href="/ocr-pdf">Make scans searchable</a><a href="/remove-pdf-metadata">Remove PDF metadata</a><a href="/bates-numbering-pdf">Add Bates numbers</a></nav>
      </section>
    </main>
  );
}

function FileCard({ side, label, file, disabled, onChoose, onDrop, onRemove }: { readonly side: "old" | "new"; readonly label: string; readonly file: File | null; readonly disabled: boolean; readonly onChoose: () => void; readonly onDrop: (file: File | null) => void; readonly onRemove: () => void }) {
  return <section className="compare-file-card" data-side={side}><header><span>{side === "old" ? "1" : "2"}</span><div><strong>{label}</strong><small>{side === "old" ? "Original or earlier version" : "Revised or latest version"}</small></div></header>{file === null ? <button type="button" className="compare-drop-zone" disabled={disabled} onClick={onChoose} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); onDrop(event.dataTransfer.files[0] ?? null); }}><b aria-hidden="true">PDF</b><strong>Drop {label.toLocaleLowerCase("en")} here</strong><span>or choose from your device</span><i>Choose PDF</i></button> : <div className="compare-selected-file"><b aria-hidden="true">PDF</b><div><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div><button type="button" onClick={onRemove} aria-label={`Remove ${label}`}>×</button></div>}</section>;
}

function baseName(fileName: string): string { return fileName.replace(/\.pdf$/i, "") || "comparison"; }
function formatBytes(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function messageFromError(error: unknown): string { return error instanceof Error ? error.message : "The PDFs could not be compared. Please try different files."; }
