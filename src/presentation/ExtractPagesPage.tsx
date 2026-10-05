import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { formatExtractPageRange, parseExtractPageRange } from "../domain/extract-pages";
import { createLazyPageExtractor } from "../infrastructure/pdflib/lazy-page-extractor";
import type { ExtractPagesInspection, ExtractPagesProgress, ExtractPagesResult } from "../ports/extract-pages";

const processor = createLazyPageExtractor();

interface ExtractDownload extends ExtractPagesResult { readonly url: string; }

export function ExtractPagesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<ExtractPagesInspection | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<readonly string[]>([]);
  const [selectedPages, setSelectedPages] = useState<readonly number[]>([]);
  const [rangeValue, setRangeValue] = useState("");
  const [progress, setProgress] = useState<ExtractPagesProgress | null>(null);
  const [download, setDownload] = useState<ExtractDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => thumbnailUrls.forEach((url) => URL.revokeObjectURL(url)), [thumbnailUrls]);
  useEffect(() => () => { if (download !== null) URL.revokeObjectURL(download.url); }, [download]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function clearDownload(): void {
    setDownload((current) => { if (current !== null) URL.revokeObjectURL(current.url); return null; });
  }

  function clearThumbnails(): void {
    setThumbnailUrls((current) => { current.forEach((url) => URL.revokeObjectURL(url)); return []; });
  }

  async function chooseFile(selected: File | null): Promise<void> {
    if (selected === null) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    clearThumbnails();
    setFile(null);
    setInspection(null);
    setSelectedPages([]);
    setRangeValue("");
    setError(null);
    setIsInspecting(true);
    try {
      const nextInspection = await processor.inspect(selected, setProgress, controller.signal);
      const allPages = Array.from({ length: nextInspection.pageCount }, (_, index) => index);
      setFile(selected);
      setInspection(nextInspection);
      setThumbnailUrls(nextInspection.pages.map((page) => URL.createObjectURL(page.thumbnail)));
      setSelectedPages(allPages);
      setRangeValue(formatExtractPageRange(allPages));
    } catch (inspectError) {
      if (!(inspectError instanceof Error && inspectError.name === "AbortError")) setError(messageFromError(inspectError));
    } finally {
      setProgress(null);
      setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function updateSelection(nextPages: readonly number[]): void {
    const sorted = [...new Set(nextPages)].sort((left, right) => left - right);
    setSelectedPages(sorted);
    setRangeValue(formatExtractPageRange(sorted));
    clearDownload();
    setError(null);
  }

  function togglePage(pageIndex: number): void {
    updateSelection(selectedPages.includes(pageIndex) ? selectedPages.filter((item) => item !== pageIndex) : [...selectedPages, pageIndex]);
  }

  function applyRange(): void {
    if (inspection === null) return;
    try {
      updateSelection(parseExtractPageRange(rangeValue, inspection.pageCount));
    } catch (rangeError) {
      setError(messageFromError(rangeError));
    }
  }

  async function extractPages(): Promise<void> {
    if (file === null || selectedPages.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsExtracting(true);
    try {
      const result = await processor.extract(file, selectedPages, setProgress, controller.signal);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (extractError) {
      if (!(extractError instanceof Error && extractError.name === "AbortError")) setError(messageFromError(extractError));
    } finally {
      setProgress(null);
      setIsExtracting(false);
    }
  }

  function startOver(): void {
    abortRef.current?.abort();
    clearDownload();
    clearThumbnails();
    setFile(null);
    setInspection(null);
    setSelectedPages([]);
    setRangeValue("");
    setProgress(null);
    setError(null);
  }

  return (
    <main className="extract-page">
      <section className="extract-hero"><span className="hero-kicker">PRIVATE PAGE TOOL</span><h1>Extract pages from a PDF online.</h1><p>Select specific pages, preview your choices, and save them as one new PDF. The source file stays on your device.</p><div className="extract-trust-row" aria-label="Tool benefits"><span><b aria-hidden="true">✓</b> Free</span><span><b aria-hidden="true">▤</b> Native pages</span><span><b aria-hidden="true">⚡</b> No upload</span></div></section>

      <section className="extract-tool" id="extract-pdf-pages-tool" aria-labelledby="extract-tool-title">
        <div className="extract-steps" aria-label="Extract PDF pages workflow"><span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "✓"}</b><i>Choose PDF</i></span><span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "✓"}</b><i>Select pages</i></span><span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span></div>
        <input ref={inputRef} className="extract-file-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />
        {inspection === null ? (
          <button type="button" className="extract-drop-zone" disabled={isInspecting} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}><span className="extract-file-icon" aria-hidden="true">PDF</span><strong>{isInspecting ? progress?.message ?? "Preparing page previews…" : "Drop your PDF here"}</strong><small>Choose pages visually or enter a range such as 1-3, 6, 9</small><i>Choose PDF</i><em>Up to 100 MB and 300 pages · processed locally</em></button>
        ) : (
          <div className="extract-workspace">
            <header className="extract-document-header"><div><span aria-hidden="true">PDF</span><div><h2 id="extract-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages · {formatBytes(inspection.byteLength)}</p></div></div><button type="button" onClick={startOver}>Choose another PDF</button></header>
            <div className="extract-layout">
              <section className="extract-pages-panel" aria-labelledby="extract-pages-title">
                <div className="extract-panel-heading"><div><span>1</span><div><h2 id="extract-pages-title">Select pages</h2><p>Tap page previews or apply a page range.</p></div></div><strong>{selectedPages.length} selected</strong></div>
                <div className="extract-page-grid">{inspection.pages.map((page, index) => { const selected = selectedPages.includes(page.pageIndex); return <button type="button" key={page.pageIndex} className={selected ? "is-selected" : ""} aria-pressed={selected} aria-label={`${selected ? "Deselect" : "Select"} page ${index + 1}`} onClick={() => togglePage(page.pageIndex)}><span className="extract-check" aria-hidden="true">{selected ? "✓" : ""}</span><div><img src={thumbnailUrls[index]} alt={`Preview of page ${index + 1}`} /></div><strong>Page {index + 1}</strong><small>{Math.round(page.width)} × {Math.round(page.height)} pt</small></button>; })}</div>
              </section>
              <aside className="extract-settings-panel" aria-labelledby="extract-settings-title">
                <div className="extract-panel-heading"><div><span>2</span><div><h2 id="extract-settings-title">Extraction settings</h2><p>Pages remain in their original order.</p></div></div></div>
                <label className="extract-range-label"><strong>Pages to extract</strong><span>Use commas and ranges</span><div><input type="text" value={rangeValue} placeholder="e.g. 1-3, 6, 9" aria-label="Pages to extract" onChange={(event) => setRangeValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyRange(); }} /><button type="button" onClick={applyRange}>Apply</button></div></label>
                <div className="extract-selection-buttons"><button type="button" onClick={() => updateSelection(Array.from({ length: inspection.pageCount }, (_, index) => index))}>Select all</button><button type="button" onClick={() => updateSelection([])}>Clear</button></div>
                <div className="extract-summary"><span><strong>{inspection.pageCount}</strong>Total pages</span><span><strong>{selectedPages.length}</strong>Selected</span><span><strong>{inspection.pageCount - selectedPages.length}</strong>Excluded</span></div>
                {inspection.hasSignatures ? <p className="extract-warning"><strong>Digital signature warning:</strong> creating a new PDF does not preserve the source document's signature validity.</p> : null}
                <p className="extract-scope-note"><strong>Native-page extraction</strong>Selected pages are copied without rasterizing them. Document-level bookmarks, attachments, metadata, scripts, and some interactive structures may not transfer to the new PDF.</p>
                <button type="button" className="extract-primary-button" disabled={isExtracting || selectedPages.length === 0} onClick={() => void extractPages()}>{isExtracting ? progress?.message ?? "Extracting pages…" : `Extract ${selectedPages.length} page${selectedPages.length === 1 ? "" : "s"}`}</button>
                {isExtracting ? <button type="button" className="extract-cancel-button" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
              </aside>
            </div>
          </div>
        )}
        {error !== null ? <p className="extract-error" role="alert">{error}</p> : null}
        {download !== null ? <section className="extract-result" aria-labelledby="extract-result-title"><span aria-hidden="true">✓</span><div><h2 id="extract-result-title">Your extracted PDF is ready</h2><p>{download.extractedPageCount} selected page{download.extractedPageCount === 1 ? "" : "s"} copied into one new PDF. The original file is unchanged.</p></div><a href={download.url} download={download.downloadName}>Download extracted PDF</a><button type="button" onClick={startOver}>Start over</button></section> : null}
      </section>

      <section className="extract-benefits" aria-label="Extract PDF page benefits"><article><span aria-hidden="true">▤</span><div><h2>Visual page selection</h2><p>Choose pages from thumbnails instead of guessing page numbers.</p></div></article><article><span aria-hidden="true">1-3</span><div><h2>Flexible page ranges</h2><p>Extract consecutive ranges and individual pages in one step.</p></div></article><article><span aria-hidden="true">⌂</span><div><h2>Private and local</h2><p>Preview, selection, extraction, validation, and download happen in your browser.</p></div></article></section>
      <section className="extract-seo-copy"><h2>How to extract pages from a PDF</h2><ol><li>Choose a PDF from your device.</li><li>Select page thumbnails or enter a range such as 1-3, 6, 9.</li><li>Review the selected and excluded page counts.</li><li>Extract and download one new PDF containing the selected pages.</li></ol><h2>Extract selected PDF pages without screenshots</h2><p>PDFMech copies the selected native PDF pages into a new document. It does not intentionally convert them to images, so ordinary vector content and selectable text can remain sharp.</p><h2>What may not transfer</h2><p>Page extraction creates a separate document. Document-level bookmarks, attachments, metadata, scripts, signatures, and some interactive forms or links may not transfer or remain valid.</p><h2>Extract PDF pages FAQ</h2><h3>Is my PDF uploaded?</h3><p>No. Page previews, extraction, validation, and download are created locally in your browser.</p><h3>Can I extract non-consecutive pages?</h3><p>Yes. Enter individual pages and ranges together, such as 1-3, 6, 9.</p><h3>Will the extracted pages become images?</h3><p>No. Selected pages are copied as native PDF pages rather than intentionally rasterized.</p><h3>Does extraction modify my original PDF?</h3><p>No. PDFMech creates a separate PDF containing the selected pages and leaves the source file unchanged.</p><nav className="extract-related-links" aria-label="Related PDF tools"><strong>Related tools</strong><a href="/delete-pdf-pages">Delete PDF pages</a><a href="/reorder-pdf-pages">Reorder PDF pages</a><a href="/compare-pdf">Compare PDFs</a></nav></section>
    </main>
  );
}

function formatBytes(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function messageFromError(error: unknown): string { return error instanceof Error ? error.message : "The pages could not be extracted. Please try another PDF."; }
