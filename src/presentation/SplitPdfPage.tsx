import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { createEveryPageGroups, describeSplitGroups, parseSplitPageGroups, type SplitPageGroup } from "../domain/split-pdf";
import { createLazyPdfSplitter } from "../infrastructure/pdflib/lazy-pdf-splitter";
import type { SplitPdfInspection, SplitPdfProgress, SplitPdfResult } from "../ports/split-pdf";

const processor = createLazyPdfSplitter();

interface SplitDownload extends SplitPdfResult {
  readonly zipUrl: string;
  readonly fileUrls: readonly string[];
}

export function SplitPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const downloadRef = useRef<SplitDownload | null>(null);
  const thumbnailUrlsRef = useRef<readonly string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<SplitPdfInspection | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<readonly string[]>([]);
  const [mode, setMode] = useState<"every" | "custom">("every");
  const [rangeValue, setRangeValue] = useState("");
  const [groups, setGroups] = useState<readonly SplitPageGroup[]>([]);
  const [progress, setProgress] = useState<SplitPdfProgress | null>(null);
  const [download, setDownload] = useState<SplitDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { thumbnailUrlsRef.current = thumbnailUrls; }, [thumbnailUrls]);
  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => {
    abortRef.current?.abort();
    thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    revokeDownload(downloadRef.current);
  }, []);

  function clearDownload(): void {
    setDownload((current) => { revokeDownload(current); return null; });
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
    setGroups([]);
    setRangeValue("");
    setError(null);
    setIsInspecting(true);
    try {
      const nextInspection = await processor.inspect(selected, setProgress, controller.signal);
      if (nextInspection.pageCount < 2) throw new Error("This PDF contains only one page, so there is nothing to split.");
      const defaultMode = nextInspection.pageCount <= 100 ? "every" : "custom";
      const defaultGroups = defaultMode === "every"
        ? createEveryPageGroups(nextInspection.pageCount)
        : createBalancedGroups(nextInspection.pageCount);
      setFile(selected);
      setInspection(nextInspection);
      setThumbnailUrls(nextInspection.pages.map((page) => URL.createObjectURL(page.thumbnail)));
      setMode(defaultMode);
      setGroups(defaultGroups);
      setRangeValue(describeSplitGroups(createBalancedGroups(nextInspection.pageCount)));
    } catch (inspectError) {
      if (!(inspectError instanceof Error && inspectError.name === "AbortError")) setError(messageFromError(inspectError));
    } finally {
      setProgress(null);
      setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function chooseMode(nextMode: "every" | "custom"): void {
    if (inspection === null) return;
    clearDownload();
    setError(null);
    setMode(nextMode);
    try {
      setGroups(nextMode === "every" ? createEveryPageGroups(inspection.pageCount) : parseSplitPageGroups(rangeValue, inspection.pageCount));
    } catch (modeError) {
      setGroups([]);
      setError(messageFromError(modeError));
    }
  }

  function applyRanges(): void {
    if (inspection === null) return;
    clearDownload();
    setError(null);
    try {
      setGroups(parseSplitPageGroups(rangeValue, inspection.pageCount));
    } catch (rangeError) {
      setGroups([]);
      setError(messageFromError(rangeError));
    }
  }

  async function splitPdf(): Promise<void> {
    if (file === null || inspection === null) return;
    let nextGroups = groups;
    if (mode === "custom") {
      try { nextGroups = parseSplitPageGroups(rangeValue, inspection.pageCount); }
      catch (rangeError) { setGroups([]); setError(messageFromError(rangeError)); return; }
      setGroups(nextGroups);
    }
    if (nextGroups.length < 2) return;
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsSplitting(true);
    try {
      const result = await processor.split(file, nextGroups, setProgress, controller.signal);
      setDownload({ ...result, zipUrl: URL.createObjectURL(result.zipBlob), fileUrls: result.files.map((output) => URL.createObjectURL(output.blob)) });
    } catch (splitError) {
      if (!(splitError instanceof Error && splitError.name === "AbortError")) setError(messageFromError(splitError));
    } finally {
      setProgress(null);
      setIsSplitting(false);
    }
  }

  function startOver(): void {
    abortRef.current?.abort();
    clearDownload();
    clearThumbnails();
    setFile(null);
    setInspection(null);
    setGroups([]);
    setRangeValue("");
    setProgress(null);
    setError(null);
  }

  const includedPages = groups.reduce((total, group) => total + group.pageIndexes.length, 0);

  return (
    <main className="split-page">
      <section className="split-pdf-hero"><span className="hero-kicker">PRIVATE PDF SPLITTER</span><h1>Split PDF pages online for free.</h1><p>Create one PDF per page or divide a document into custom page ranges. Everything happens locally in your browser.</p><div className="split-trust-row" aria-label="Tool benefits"><span><b aria-hidden="true">✓</b> Free</span><span><b aria-hidden="true">▤</b> Native pages</span><span><b aria-hidden="true">⚡</b> No upload</span></div></section>

      <section className="split-tool" id="split-pdf-tool" aria-labelledby="split-tool-title">
        <div className="split-steps" aria-label="Split PDF workflow"><span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "✓"}</b><i>Choose PDF</i></span><span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "✓"}</b><i>Choose split</i></span><span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span></div>
        <input ref={inputRef} className="split-file-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />
        {inspection === null ? (
          <button type="button" className="split-drop-zone" disabled={isInspecting} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}><span className="split-file-icon" aria-hidden="true">PDF</span><strong>{isInspecting ? progress?.message ?? "Preparing page previews…" : "Drop your PDF here"}</strong><small>Split every page or define separate ranges such as 1-3, 4-6, 7-10.</small><i>Choose PDF</i><em>Up to 100 MB and 300 pages · processed locally</em></button>
        ) : (
          <div className="split-workspace">
            <header className="split-document-header"><div><span aria-hidden="true">PDF</span><div><h2 id="split-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages · {formatBytes(inspection.byteLength)}</p></div></div><button type="button" onClick={startOver}>Choose another PDF</button></header>
            <div className="split-layout">
              <section className="split-preview-panel" aria-labelledby="split-preview-title"><div className="split-panel-heading"><div><span>1</span><div><h2 id="split-preview-title">Document pages</h2><p>Preview the source before choosing output ranges.</p></div></div><strong>{inspection.pageCount} pages</strong></div><div className="split-page-grid">{inspection.pages.map((page, index) => <figure key={page.pageIndex}><div><img src={thumbnailUrls[index]} alt={`Preview of page ${index + 1}`} /></div><figcaption>Page {index + 1}</figcaption></figure>)}</div></section>
              <aside className="split-settings-panel" aria-labelledby="split-settings-title">
                <div className="split-panel-heading"><div><span>2</span><div><h2 id="split-settings-title">Split settings</h2><p>Choose how many PDFs to create.</p></div></div></div>
                <div className="split-mode-options"><button type="button" className={mode === "every" ? "is-selected" : ""} aria-pressed={mode === "every"} disabled={inspection.pageCount > 100} onClick={() => chooseMode("every")}><b>Every page</b><span>Create one PDF for each page{inspection.pageCount > 100 ? " (100-output limit)" : ""}.</span></button><button type="button" className={mode === "custom" ? "is-selected" : ""} aria-pressed={mode === "custom"} onClick={() => chooseMode("custom")}><b>Custom ranges</b><span>Make one PDF for each comma-separated range.</span></button></div>
                {mode === "custom" ? <label className="split-range-label"><strong>Output ranges</strong><span>Example: 1-3, 4-6, 7-10</span><div><input type="text" value={rangeValue} aria-label="Output ranges" onChange={(event) => { setRangeValue(event.target.value); setGroups([]); clearDownload(); }} onKeyDown={(event) => { if (event.key === "Enter") applyRanges(); }} /><button type="button" onClick={applyRanges}>Apply</button></div></label> : null}
                <div className="split-summary"><span><strong>{groups.length || "—"}</strong>Output PDFs</span><span><strong>{includedPages || "—"}</strong>Included pages</span><span><strong>{inspection.pageCount - includedPages}</strong>Excluded</span></div>
                {inspection.hasSignatures ? <p className="split-warning"><strong>Digital signature warning:</strong> creating new PDFs invalidates the source document's digital signatures.</p> : null}
                <p className="split-scope-note"><strong>Native-page splitting</strong>Pages are copied without intentional rasterization. Document-level bookmarks, attachments, metadata, scripts, and some interactive structures may not transfer.</p>
                <button type="button" className="split-primary-button" disabled={isSplitting || groups.length < 2} onClick={() => void splitPdf()}>{isSplitting ? progress?.message ?? "Splitting PDF…" : `Create ${groups.length || ""} split PDFs`}</button>
                {isSplitting ? <button type="button" className="split-cancel-button" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
              </aside>
            </div>
          </div>
        )}
        {error !== null ? <p className="split-error" role="alert">{error}</p> : null}
        {download !== null ? <section className="split-result" aria-labelledby="split-result-title"><div className="split-result-heading"><span aria-hidden="true">✓</span><div><h2 id="split-result-title">Your split PDFs are ready</h2><p>{download.outputCount} PDFs created from {download.pageCount} source pages. The original file is unchanged.</p></div><a href={download.zipUrl} download={download.zipDownloadName}>Download all as ZIP</a></div><details><summary>Download individual PDFs</summary><div>{download.files.map((output, index) => <a key={output.downloadName} href={download.fileUrls[index]} download={output.downloadName}><span>Pages {output.label}</span><small>{output.pageCount} page{output.pageCount === 1 ? "" : "s"}</small><b>Download</b></a>)}</div></details><button type="button" onClick={startOver}>Split another PDF</button></section> : null}
      </section>

      <section className="split-benefits" aria-label="Split PDF benefits"><article><span aria-hidden="true">1</span><div><h2>Split every page</h2><p>Turn each source page into its own downloadable PDF.</p></div></article><article><span aria-hidden="true">1-3</span><div><h2>Choose custom ranges</h2><p>Create separate documents for chapters, sections, or records.</p></div></article><article><span aria-hidden="true">⌂</span><div><h2>Private and local</h2><p>Preview, splitting, ZIP creation, and download happen in your browser.</p></div></article></section>
      <section className="split-seo-copy"><h2>How to split a PDF online</h2><ol><li>Choose a PDF from your device.</li><li>Select Every page or enter separate custom ranges.</li><li>Review the number of output files and included pages.</li><li>Create the files and download all outputs as one ZIP.</li></ol><h2>Split PDFs without uploading</h2><p>PDFMech reads the source and creates each output locally in your browser. The original PDF is not sent to a remote splitting service.</p><h2>Every page or custom ranges</h2><p>Every page mode creates a separate one-page PDF. Custom ranges create one output per comma-separated range, such as 1-3, 4-6, 7-10.</p><h2>Split PDF FAQ</h2><h3>Does PDFMech upload my file?</h3><p>No. Page previews, splitting, validation, ZIP packaging, and downloads are produced locally.</p><h3>Can I split a PDF into chapters?</h3><p>Yes. Enter each chapter as a separate range. For example, 1-5, 6-12, 13-20 creates three PDFs.</p><h3>Will text remain selectable?</h3><p>Ordinary PDF pages are copied natively instead of intentionally converted into screenshots, so selectable text and vector content can remain intact.</p><h3>Does splitting change my original PDF?</h3><p>No. PDFMech creates new files and leaves the source PDF unchanged.</p><nav className="split-related-links" aria-label="Related PDF tools"><strong>Related tools</strong><a href="/merge-pdf">Merge PDF</a><a href="/extract-pdf-pages">Extract PDF pages</a><a href="/delete-pdf-pages">Delete PDF pages</a></nav></section>
    </main>
  );
}

function createBalancedGroups(pageCount: number): readonly SplitPageGroup[] {
  const midpoint = Math.ceil(pageCount / 2);
  return [{ label: `1-${midpoint}`, pageIndexes: Array.from({ length: midpoint }, (_, index) => index) }, { label: `${midpoint + 1}-${pageCount}`, pageIndexes: Array.from({ length: pageCount - midpoint }, (_, index) => midpoint + index) }];
}

function revokeDownload(download: SplitDownload | null): void {
  if (download === null) return;
  URL.revokeObjectURL(download.zipUrl);
  download.fileUrls.forEach((url) => URL.revokeObjectURL(url));
}

function formatBytes(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function messageFromError(error: unknown): string { return error instanceof Error ? error.message : "The PDF could not be split. Please try another file."; }
