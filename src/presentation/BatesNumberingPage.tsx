import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import {
  BATES_POSITIONS,
  formatBatesLabel,
  parseBatesPageRange,
  validateBatesSequence,
  type BatesPosition,
} from "../domain/bates";
import { createLazyBatesNumberer } from "../infrastructure/pdflib/lazy-bates-numberer";
import type { BatesInspection, BatesOutputFile } from "../ports/bates";

const numberer = createLazyBatesNumberer();

interface PendingFile {
  readonly id: string;
  readonly file: File;
  readonly inspection: BatesInspection;
  readonly pageRange: string;
}

interface DownloadFile extends BatesOutputFile {
  readonly url: string;
}

export function BatesNumberingPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<readonly PendingFile[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("PDFM-");
  const [suffix, setSuffix] = useState("");
  const [startNumber, setStartNumber] = useState(1);
  const [digits, setDigits] = useState(6);
  const [fontSize, setFontSize] = useState(10);
  const [color, setColor] = useState("#121726");
  const [position, setPosition] = useState<BatesPosition>("bottom-right");
  const [results, setResults] = useState<readonly DownloadFile[]>([]);

  useEffect(() => () => {
    results.forEach((result) => URL.revokeObjectURL(result.url));
  }, [results]);

  const selection = useMemo(() => {
    try {
      const requests = files.map((item) => ({
        file: item.file,
        pageIndexes: parseBatesPageRange(item.pageRange, item.inspection.pageCount),
      }));
      return { requests, count: requests.reduce((total, item) => total + item.pageIndexes.length, 0), error: null };
    } catch (rangeError) {
      return { requests: [], count: 0, error: messageFromError(rangeError) };
    }
  }, [files]);

  const preview = useMemo(() => {
    try {
      const settings = { prefix, suffix, startNumber, digits };
      if (selection.count === 0) return { first: formatBatesLabel(startNumber, settings), last: null, error: selection.error };
      const labels = validateBatesSequence(selection.count, settings);
      return { ...labels, error: selection.error };
    } catch (previewError) {
      return { first: "Check settings", last: null, error: messageFromError(previewError) };
    }
  }, [digits, prefix, selection, startNumber, suffix]);

  async function addFiles(selected: FileList | readonly File[]): Promise<void> {
    const incoming = Array.from(selected);
    if (incoming.length === 0) return;
    setIsInspecting(true);
    setError(null);
    try {
      const additions: PendingFile[] = [];
      for (const file of incoming) {
        const inspection = await numberer.inspect(file);
        additions.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          inspection,
          pageRange: "all",
        });
      }
      setFiles((current) => [...current, ...additions]);
      clearResults();
    } catch (inspectError) {
      setError(messageFromError(inspectError));
    } finally {
      setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function clearResults(): void {
    setResults((current) => {
      current.forEach((result) => URL.revokeObjectURL(result.url));
      return [];
    });
  }

  function updateRange(id: string, pageRange: string): void {
    setFiles((current) => current.map((item) => item.id === id ? { ...item, pageRange } : item));
    clearResults();
  }

  function moveFile(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= files.length) return;
    setFiles((current) => {
      const next = [...current];
      const item = next[index];
      if (item === undefined) return current;
      next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
    clearResults();
  }

  async function processFiles(): Promise<void> {
    setError(null);
    if (selection.error !== null) {
      setError(selection.error);
      return;
    }
    try {
      validateBatesSequence(selection.count, { prefix, suffix, startNumber, digits });
      setIsProcessing(true);
      clearResults();
      const result = await numberer.process(
        selection.requests,
        { prefix, suffix, startNumber, digits, position, fontSize, color, margin: 24 },
        (next) => setProgress(`Numbering ${next.currentFileName} (${next.completedFiles + 1} of ${next.totalFiles})`),
      );
      setResults(result.files.map((file) => ({ ...file, url: URL.createObjectURL(file.blob) })));
      setProgress(`${result.numberedPageCount} pages numbered across ${result.files.length} PDF${result.files.length === 1 ? "" : "s"}.`);
    } catch (processError) {
      setError(messageFromError(processError));
    } finally {
      setIsProcessing(false);
    }
  }

  const hasSignatures = files.some((item) => item.inspection.hasSignatures);

  return (
    <main className="bates-page">
      <section className="bates-hero">
        <span className="hero-kicker">PRIVATE BROWSER TOOL</span>
        <h1>Add Bates numbers to PDFs privately.</h1>
        <p>Apply continuous page numbers to one or multiple PDFs. Set the prefix, digits, page range, and position without uploading your documents.</p>
        <div className="bates-trust-row" aria-label="Tool benefits">
          <span><b aria-hidden="true">✓</b> Free</span>
          <span><b aria-hidden="true">▣</b> No signup</span>
          <span><b aria-hidden="true">⚡</b> Files stay on your device</span>
        </div>
      </section>

      <section className="bates-workspace" id="bates-numbering-tool" aria-labelledby="bates-workspace-title">
        <header className="bates-workspace-header">
          <div><span>1</span><div><h2 id="bates-workspace-title">Choose PDFs</h2><p>File order controls the numbering sequence.</p></div></div>
          {files.length > 0 ? <button type="button" className="bates-secondary-button" onClick={() => inputRef.current?.click()}>+ Add PDFs</button> : null}
        </header>
        <input ref={inputRef} className="bates-file-input" type="file" accept="application/pdf,.pdf" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void addFiles(event.target.files ?? [])} />

        {files.length === 0 ? (
          <button
            className="bates-drop-zone"
            type="button"
            disabled={isInspecting}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()}
            onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}
          >
            <span className="bates-file-icon" aria-hidden="true">PDF</span>
            <strong>{isInspecting ? "Reading your PDF…" : "Drop your PDFs here"}</strong>
            <small>or choose one or more PDF files</small>
            <i>Choose PDFs</i>
            <em>Up to 100 MB per file · processed locally</em>
          </button>
        ) : (
          <div className="bates-layout">
            <section className="bates-file-panel" aria-labelledby="bates-files-title">
              <div className="bates-panel-title"><div><span>2</span><h2 id="bates-files-title">Review files</h2></div><small>{files.length} PDF{files.length === 1 ? "" : "s"} · {selection.count} pages selected</small></div>
              <ol className="bates-file-list">
                {files.map((item, index) => (
                  <li key={item.id}>
                    <span className="bates-file-order">{index + 1}</span>
                    <div className="bates-file-copy"><strong>{item.file.name}</strong><small>{item.inspection.pageCount} pages · {formatBytes(item.file.size)}</small></div>
                    <label>Pages<input aria-label={`Pages to number in ${item.file.name}`} value={item.pageRange} onChange={(event) => updateRange(item.id, event.target.value)} placeholder="all or 1-5, 8" /></label>
                    <div className="bates-file-actions">
                      <button type="button" aria-label={`Move ${item.file.name} up`} disabled={index === 0} onClick={() => moveFile(index, -1)}>↑</button>
                      <button type="button" aria-label={`Move ${item.file.name} down`} disabled={index === files.length - 1} onClick={() => moveFile(index, 1)}>↓</button>
                      <button type="button" aria-label={`Remove ${item.file.name}`} onClick={() => { setFiles((current) => current.filter((candidate) => candidate.id !== item.id)); clearResults(); }}>×</button>
                    </div>
                  </li>
                ))}
              </ol>
              {selection.error !== null ? <p className="bates-inline-error" role="alert">{selection.error}</p> : null}
            </section>

            <aside className="bates-settings-panel" aria-labelledby="bates-settings-title">
              <div className="bates-panel-title"><div><span>3</span><h2 id="bates-settings-title">Number settings</h2></div></div>
              <div className="bates-field-grid">
                <label>Prefix<input value={prefix} maxLength={32} onChange={(event) => { setPrefix(event.target.value); clearResults(); }} /></label>
                <label>Suffix<input value={suffix} maxLength={32} onChange={(event) => { setSuffix(event.target.value); clearResults(); }} placeholder="Optional" /></label>
                <label>Start number<input type="number" min="0" step="1" value={startNumber} onChange={(event) => { setStartNumber(Number(event.target.value)); clearResults(); }} /></label>
                <label>Digits<select value={digits} onChange={(event) => { setDigits(Number(event.target.value)); clearResults(); }}>{[4, 5, 6, 7, 8, 9, 10, 11, 12].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label>Font size<select value={fontSize} onChange={(event) => { setFontSize(Number(event.target.value)); clearResults(); }}>{[8, 9, 10, 11, 12, 14, 16, 18].map((value) => <option key={value} value={value}>{value} pt</option>)}</select></label>
                <label>Color<span className="bates-color-field"><input type="color" value={color} aria-label="Bates number color" onChange={(event) => { setColor(event.target.value); clearResults(); }} /><input value={color} pattern="#[0-9a-fA-F]{6}" onChange={(event) => { setColor(event.target.value); clearResults(); }} /></span></label>
              </div>
              <fieldset className="bates-position-field"><legend>Position</legend><div>{BATES_POSITIONS.map((value) => <button key={value} type="button" className={position === value ? "is-active" : ""} aria-pressed={position === value} onClick={() => { setPosition(value); clearResults(); }}><span aria-hidden="true" />{positionLabel(value)}</button>)}</div></fieldset>
              <div className="bates-preview-card">
                <div className={`bates-preview-paper is-${position}`}><span style={{ color, fontSize: `${Math.max(7, fontSize * 0.8)}px` }}>{preview.first}</span></div>
                <div><small>Sequence preview</small><strong>{preview.first}</strong>{preview.last !== null ? <span>through {preview.last}</span> : null}</div>
              </div>
              <button className="bates-primary-button" type="button" disabled={isProcessing || selection.count === 0 || preview.error !== null} onClick={() => void processFiles()}>{isProcessing ? "Adding Bates numbers…" : `Add Bates numbers to ${selection.count} page${selection.count === 1 ? "" : "s"}`}</button>
            </aside>
          </div>
        )}

        {hasSignatures ? <p className="bates-warning"><strong>Signed PDF warning:</strong> adding numbers changes the file and can invalidate existing digital signatures.</p> : null}
        {error !== null ? <p className="bates-error" role="alert">{error}</p> : null}

        {results.length > 0 ? (
          <section className="bates-results" aria-labelledby="bates-results-title">
            <div className="bates-panel-title"><div><span>4</span><h2 id="bates-results-title">Your numbered PDFs are ready</h2></div><small>{progress}</small></div>
            <ul>{results.map((result) => <li key={result.sourceName}><div><strong>{result.downloadName}</strong><small>{result.numberedPageCount} pages · {result.firstLabel} to {result.lastLabel}</small></div><a href={result.url} download={result.downloadName}>Download PDF</a></li>)}</ul>
            <button type="button" className="bates-secondary-button" onClick={() => { clearResults(); setFiles([]); setProgress(""); }}>Start over</button>
          </section>
        ) : isProcessing ? <p className="bates-progress" role="status">{progress}</p> : null}
      </section>

      <section className="bates-info-grid" aria-label="About Bates numbering">
        <article><span aria-hidden="true">#</span><div><h2>Continuous numbering</h2><p>Keep one sequence running across several PDFs in the exact file order you choose.</p></div></article>
        <article><span aria-hidden="true">⌁</span><div><h2>Flexible labels</h2><p>Add a prefix or suffix, choose the digit length, and number only the pages you need.</p></div></article>
        <article><span aria-hidden="true">⌂</span><div><h2>Private and local</h2><p>Your source documents are processed in this browser and are not uploaded to PDFMech.</p></div></article>
      </section>

      <section className="bates-seo-copy">
        <h2>What is Bates numbering?</h2>
        <p>Bates numbering adds a unique, sequential identifier to document pages. Legal, compliance, audit, and records teams use Bates labels to reference pages consistently across a document set.</p>
        <h2>How to add Bates numbers to a PDF</h2>
        <ol><li>Choose one or more PDF files and arrange them in sequence.</li><li>Select all pages or enter a range for each file.</li><li>Set the starting number, prefix, suffix, digits, color, size, and page position.</li><li>Process the files locally, then download each numbered PDF.</li></ol>
        <h2>Important document considerations</h2>
        <p>Always keep the original files. Adding visible numbering changes each PDF and may invalidate digital signatures. PDFMech creates separate downloads instead of overwriting your originals.</p>
        <h2>Bates numbering PDF FAQ</h2>
        <h3>Are my PDFs uploaded for Bates numbering?</h3>
        <p>No. PDFMech reads, numbers, and creates the new PDFs locally in your browser. The source documents are not sent to a PDFMech processing server.</p>
        <h3>Can one Bates sequence continue across multiple PDFs?</h3>
        <p>Yes. Arrange the files in the required order and PDFMech continues the sequence across every selected page in that order.</p>
        <h3>Can I number only selected pages?</h3>
        <p>Yes. Use all pages or enter a range such as 1-5, 8, 12 for each PDF before processing.</p>
        <h3>Will Bates numbering affect digital signatures?</h3>
        <p>It can. Adding a visible number changes the PDF and may invalidate an existing digital signature, so keep the original signed file.</p>
        <nav className="bates-related-links" aria-label="Related PDF tools">
          <strong>Related tools</strong>
          <a href="/ocr-pdf">Make a scanned PDF searchable</a>
          <a href="/reorder-pdf-pages">Reorder PDF pages</a>
          <a href="/editor">Open the PDF editor</a>
        </nav>
      </section>
    </main>
  );
}

function positionLabel(position: BatesPosition): string {
  return position.split("-").map((part) => part[0]?.toLocaleUpperCase("en") + part.slice(1)).join(" ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try another PDF.";
}
