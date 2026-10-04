import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { clampDeskewAngle } from "../domain/deskew";
import { createLazyDeskewProcessor } from "../infrastructure/deskew/lazy-deskew-processor";
import type { DeskewInspection, DeskewProgress, DeskewResult } from "../ports/deskew";

const processor = createLazyDeskewProcessor();

interface DeskewDownload extends DeskewResult {
  readonly url: string;
}

export function DeskewPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<DeskewInspection | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<readonly string[]>([]);
  const [angles, setAngles] = useState<readonly number[]>([]);
  const [progress, setProgress] = useState<DeskewProgress | null>(null);
  const [download, setDownload] = useState<DeskewDownload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => () => {
    thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [thumbnailUrls]);

  useEffect(() => () => {
    if (download !== null) URL.revokeObjectURL(download.url);
  }, [download]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const correctedCount = useMemo(() => angles.filter((angle) => Math.abs(angle) >= 0.05).length, [angles]);

  function clearDownload(): void {
    setDownload((current) => {
      if (current !== null) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function clearThumbnails(): void {
    setThumbnailUrls((current) => {
      current.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
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
    setAngles([]);
    setError(null);
    setIsInspecting(true);
    try {
      const nextInspection = await processor.inspect(selected, setProgress, controller.signal);
      const urls = nextInspection.pages.map((page) => URL.createObjectURL(page.thumbnail));
      setFile(selected);
      setInspection(nextInspection);
      setThumbnailUrls(urls);
      setAngles(nextInspection.pages.map((page) => page.suggestedAngle));
      setProgress(null);
    } catch (inspectError) {
      if (!(inspectError instanceof Error && inspectError.name === "AbortError")) setError(messageFromError(inspectError));
    } finally {
      setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function setPageAngle(pageIndex: number, value: number): void {
    setAngles((current) => current.map((angle, index) => index === pageIndex ? clampDeskewAngle(value) : angle));
    clearDownload();
  }

  function resetToAutomatic(): void {
    if (inspection === null) return;
    setAngles(inspection.pages.map((page) => page.suggestedAngle));
    clearDownload();
  }

  function setAllStraight(): void {
    setAngles((current) => current.map(() => 0));
    clearDownload();
  }

  async function processPdf(): Promise<void> {
    if (file === null || inspection === null) return;
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsProcessing(true);
    try {
      const result = await processor.process(
        file,
        angles.map((angle, pageIndex) => ({ pageIndex, angle })),
        setProgress,
        controller.signal,
      );
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
      setProgress(null);
    } catch (processError) {
      if (!(processError instanceof Error && processError.name === "AbortError")) setError(messageFromError(processError));
    } finally {
      setIsProcessing(false);
    }
  }

  function startOver(): void {
    abortRef.current?.abort();
    clearDownload();
    clearThumbnails();
    setFile(null);
    setInspection(null);
    setAngles([]);
    setProgress(null);
    setError(null);
  }

  return (
    <main className="deskew-page">
      <section className="deskew-hero">
        <span className="hero-kicker">PRIVATE SCAN TOOL</span>
        <h1>Straighten scanned PDF pages online.</h1>
        <p>Detect crooked scan angles automatically, fine-tune each page, and create a corrected PDF locally in your browser.</p>
        <div className="deskew-trust-row" aria-label="Tool benefits"><span><b aria-hidden="true">✓</b> Free</span><span><b aria-hidden="true">▣</b> No signup</span><span><b aria-hidden="true">⚡</b> No upload</span></div>
      </section>

      <section className="deskew-tool" id="deskew-pdf-tool" aria-labelledby="deskew-tool-title">
        <input ref={inputRef} className="deskew-file-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />
        {inspection === null ? (
          <button type="button" className="deskew-drop-zone" disabled={isInspecting} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}>
            <span className="deskew-file-icon" aria-hidden="true">PDF</span>
            <strong>{isInspecting ? progress?.message ?? "Analyzing scan angles…" : "Drop your scanned PDF here"}</strong>
            <small>Automatic detection works best on pages with horizontal printed text</small>
            <i>Choose scanned PDF</i>
            <em>Up to 100 MB and 300 pages · processed locally</em>
          </button>
        ) : (
          <div className="deskew-workspace">
            <header className="deskew-document-header">
              <div><span aria-hidden="true">PDF</span><div><h2 id="deskew-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages · {formatBytes(inspection.byteLength)}</p></div></div>
              <button type="button" onClick={startOver}>Choose another PDF</button>
            </header>
            <div className="deskew-workspace-layout">
              <section className="deskew-pages-panel" aria-labelledby="deskew-pages-title">
                <div className="deskew-panel-heading"><div><span>1</span><div><h2 id="deskew-pages-title">Review page angles</h2><p>Automatic corrections can be adjusted page by page.</p></div></div><small>{correctedCount} page{correctedCount === 1 ? "" : "s"} will be rasterized</small></div>
                <div className="deskew-page-grid">
                  {inspection.pages.map((page, index) => {
                    const angle = angles[index] ?? 0;
                    return <article key={page.pageIndex}>
                      <div className="deskew-thumbnail-frame"><img src={thumbnailUrls[index]} alt={`Preview of page ${index + 1}`} style={{ transform: `rotate(${angle}deg)` }} /></div>
                      <header><strong>Page {index + 1}</strong><span className={Math.abs(page.suggestedAngle) >= 0.05 ? "is-detected" : ""}>{Math.abs(page.suggestedAngle) >= 0.05 ? `Auto ${formatAngle(page.suggestedAngle)}` : "Looks straight"}</span></header>
                      <label><span>Correction angle <output>{formatAngle(angle)}</output></span><input type="range" min="-7" max="7" step="0.25" value={angle} aria-label={`Correction angle for page ${index + 1}`} onChange={(event) => setPageAngle(index, Number(event.target.value))} /></label>
                      <div><button type="button" onClick={() => setPageAngle(index, (angle - 0.25))}>− 0.25°</button><button type="button" onClick={() => setPageAngle(index, page.suggestedAngle)}>Auto</button><button type="button" onClick={() => setPageAngle(index, (angle + 0.25))}>+ 0.25°</button></div>
                    </article>;
                  })}
                </div>
              </section>

              <aside className="deskew-settings-panel" aria-labelledby="deskew-settings-title">
                <div className="deskew-panel-heading"><div><span>2</span><div><h2 id="deskew-settings-title">Create corrected PDF</h2><p>Only adjusted pages are rasterized.</p></div></div></div>
                <div className="deskew-summary"><span><strong>{inspection.pageCount}</strong>Total pages</span><span><strong>{correctedCount}</strong>Corrected</span><span><strong>{inspection.pageCount - correctedCount}</strong>Preserved</span></div>
                <button type="button" className="deskew-secondary-button" onClick={resetToAutomatic}>Restore automatic angles</button>
                <button type="button" className="deskew-secondary-button" onClick={setAllStraight}>Set all to 0°</button>
                <div className="deskew-raster-warning"><strong>Scan-specific output</strong><p>Corrected pages are rendered as images. Existing searchable text, links, form fields, and annotations on those pages will not remain interactive.</p></div>
                <button type="button" className="deskew-primary-button" disabled={isProcessing} onClick={() => void processPdf()}>{isProcessing ? progress?.message ?? "Straightening pages…" : "Create deskewed PDF"}</button>
                {isProcessing ? <button type="button" className="deskew-cancel-button" onClick={() => abortRef.current?.abort()}>Cancel processing</button> : null}
              </aside>
            </div>
          </div>
        )}

        {error !== null ? <p className="deskew-error" role="alert">{error}</p> : null}
        {download !== null ? (
          <section className="deskew-result" aria-labelledby="deskew-result-title"><span aria-hidden="true">✓</span><div><h2 id="deskew-result-title">Your straightened PDF is ready</h2><p>{download.correctedPageCount} corrected pages · {download.preservedPageCount} original pages preserved.</p></div><a href={download.url} download={download.downloadName}>Download deskewed PDF</a><a className="deskew-ocr-link" href="/ocr-pdf">Make searchable with OCR →</a><button type="button" onClick={startOver}>Start over</button></section>
        ) : null}
      </section>

      <section className="deskew-benefits" aria-label="Deskew PDF benefits"><article><span aria-hidden="true">↗</span><div><h2>Automatic angle detection</h2><p>Estimate a correction for each page using its visible text and line structure.</p></div></article><article><span aria-hidden="true">⌁</span><div><h2>Manual fine-tuning</h2><p>Adjust every page from −7° to +7° in precise quarter-degree steps.</p></div></article><article><span aria-hidden="true">⌂</span><div><h2>Private and local</h2><p>Analysis, rendering, correction, and export happen on your device.</p></div></article></section>

      <section className="deskew-seo-copy">
        <h2>What does deskewing a PDF do?</h2><p>Deskewing corrects slightly rotated pages created by scanners or phone cameras. Straighter text is easier to read and can improve the results of a later OCR pass.</p>
        <h2>How to straighten a scanned PDF</h2><ol><li>Choose a scanned or image-based PDF from your device.</li><li>Review the automatically detected correction for each page.</li><li>Fine-tune individual pages when necessary.</li><li>Create and download the corrected PDF, then run OCR if searchable text is needed.</li></ol>
        <h2>Designed for scanned pages</h2><p>Pages that need correction are rendered into high-resolution images before rotation. Pages set to 0° are copied without rasterization. This workflow is intended for scans, not digitally generated PDFs with interactive text, links, forms, or annotations.</p>
        <h2>Deskew PDF FAQ</h2>
        <h3>Is my scanned PDF uploaded?</h3><p>No. PDFMech analyzes and straightens supported pages locally in your browser.</p>
        <h3>Does automatic deskew work on every page?</h3><p>No. Pages need enough horizontal printed text or line structure for reliable detection. You can adjust every page manually.</p>
        <h3>Will searchable text be preserved?</h3><p>Pages corrected by a non-zero angle are rasterized, so existing interactive text is not preserved on those pages. Run PDFMech OCR afterward to add a new searchable text layer.</p>
        <h3>Does this replace my original PDF?</h3><p>No. PDFMech creates a separate deskewed PDF and leaves the source file unchanged.</p>
        <nav className="deskew-related-links" aria-label="Related PDF tools"><strong>Continue your scan workflow</strong><a href="/ocr-pdf">Make the PDF searchable</a><a href="/rotate-pdf-pages">Rotate PDF pages</a><a href="/bates-numbering-pdf">Add Bates numbers</a></nav>
      </section>
    </main>
  );
}

function formatAngle(angle: number): string {
  return `${angle > 0 ? "+" : ""}${angle.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}°`;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try another scanned PDF.";
}
