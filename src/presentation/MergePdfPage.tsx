import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { calculateMergeTotals, MERGE_LIMITS, moveMergeItem } from "../domain/merge-pdf";
import { createLazyPdfMerger } from "../infrastructure/pdflib/lazy-pdf-merger";
import type { MergePdfInspection, MergePdfProgress, MergePdfResult } from "../ports/merge-pdf";

const processor = createLazyPdfMerger();

interface MergeEntry {
  readonly id: string;
  readonly file: File;
  readonly inspection: MergePdfInspection;
  readonly thumbnailUrl: string;
}

interface MergeDownload extends MergePdfResult { readonly url: string; }

export function MergePdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const entriesRef = useRef<readonly MergeEntry[]>([]);
  const downloadRef = useRef<MergeDownload | null>(null);
  const [entries, setEntries] = useState<readonly MergeEntry[]>([]);
  const [progress, setProgress] = useState<MergePdfProgress | null>(null);
  const [download, setDownload] = useState<MergeDownload | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => {
    abortRef.current?.abort();
    entriesRef.current.forEach((entry) => URL.revokeObjectURL(entry.thumbnailUrl));
    if (downloadRef.current !== null) URL.revokeObjectURL(downloadRef.current.url);
  }, []);

  const totals = calculateMergeTotals(entries.map((entry) => ({ byteLength: entry.file.size, pageCount: entry.inspection.pageCount })));

  function clearDownload(): void {
    setDownload((current) => {
      if (current !== null) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function addFiles(files: readonly File[]): Promise<void> {
    if (files.length === 0) return;
    const availableSlots = MERGE_LIMITS.maxFiles - entries.length;
    if (availableSlots <= 0 || files.length > availableSlots) {
      setError(`Choose no more than ${MERGE_LIMITS.maxFiles} PDF files in total.`);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsAdding(true);
    const inspected: MergeEntry[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setProgress({ phase: "inspecting", completed: index, total: files.length, message: `Checking ${file.name}` });
        const inspection = await processor.inspect(file, () => undefined, controller.signal);
        inspected.push({
          id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
          file,
          inspection,
          thumbnailUrl: URL.createObjectURL(inspection.thumbnail),
        });
      }
      const next = [...entries, ...inspected];
      const nextTotals = calculateMergeTotals(next.map((entry) => ({ byteLength: entry.file.size, pageCount: entry.inspection.pageCount })));
      if (nextTotals.byteLength > MERGE_LIMITS.maxTotalBytes) throw new Error("The selected PDFs exceed the 250 MB combined limit.");
      if (nextTotals.pageCount > MERGE_LIMITS.maxTotalPages) throw new Error(`The selected PDFs exceed the ${MERGE_LIMITS.maxTotalPages}-page combined limit.`);
      setEntries(next);
    } catch (addError) {
      inspected.forEach((entry) => URL.revokeObjectURL(entry.thumbnailUrl));
      if (!(addError instanceof Error && addError.name === "AbortError")) setError(messageFromError(addError));
    } finally {
      setProgress(null);
      setIsAdding(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function moveEntry(fromIndex: number, toIndex: number): void {
    setEntries((current) => moveMergeItem(current, fromIndex, toIndex));
    clearDownload();
    setError(null);
  }

  function removeEntry(id: string): void {
    setEntries((current) => {
      const removed = current.find((entry) => entry.id === id);
      if (removed !== undefined) URL.revokeObjectURL(removed.thumbnailUrl);
      return current.filter((entry) => entry.id !== id);
    });
    clearDownload();
    setError(null);
  }

  async function mergeFiles(): Promise<void> {
    if (entries.length < 2) return;
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsMerging(true);
    try {
      const result = await processor.merge(entries.map((entry) => ({ file: entry.file, pageCount: entry.inspection.pageCount })), setProgress, controller.signal);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (mergeError) {
      if (!(mergeError instanceof Error && mergeError.name === "AbortError")) setError(messageFromError(mergeError));
    } finally {
      setProgress(null);
      setIsMerging(false);
    }
  }

  function startOver(): void {
    abortRef.current?.abort();
    entries.forEach((entry) => URL.revokeObjectURL(entry.thumbnailUrl));
    setEntries([]);
    clearDownload();
    setProgress(null);
    setError(null);
  }

  return (
    <main className="merge-page">
      <section className="merge-hero">
        <span className="hero-kicker">PRIVATE PDF COMBINER</span>
        <h1>Merge PDF files online for free.</h1>
        <p>Combine multiple PDFs in the order you choose and download one new document. Every file stays on your device.</p>
        <div className="merge-trust-row" aria-label="Tool benefits"><span><b aria-hidden="true">✓</b> Free</span><span><b aria-hidden="true">▤</b> Native pages</span><span><b aria-hidden="true">⚡</b> No upload</span></div>
      </section>

      <section className="merge-tool" id="merge-pdf-tool" aria-labelledby="merge-tool-title">
        <div className="merge-steps" aria-label="Merge PDF workflow">
          <span className={entries.length === 0 ? "is-active" : "is-complete"}><b>{entries.length === 0 ? "1" : "✓"}</b><i>Choose PDFs</i></span>
          <span className={entries.length > 0 && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "✓"}</b><i>Arrange files</i></span>
          <span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span>
        </div>
        <input ref={inputRef} className="merge-file-input" type="file" accept="application/pdf,.pdf" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void addFiles(Array.from(event.target.files ?? []))} />

        {entries.length === 0 ? (
          <button type="button" className="merge-drop-zone" disabled={isAdding} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void addFiles(Array.from(event.dataTransfer.files)); }}>
            <span className="merge-stack-icon" aria-hidden="true"><i>PDF</i><i>PDF</i></span>
            <strong>{isAdding ? progress?.message ?? "Checking PDFs…" : "Drop PDF files here"}</strong>
            <small>Select two or more PDFs, then arrange their order before merging.</small>
            <em>Choose PDF files</em>
            <span>Up to 20 files · 250 MB combined · processed locally</span>
          </button>
        ) : (
          <div className="merge-workspace">
            <header className="merge-document-header">
              <div><span aria-hidden="true">PDF</span><div><h2 id="merge-tool-title">PDFs ready to combine</h2><p>{totals.fileCount} files · {totals.pageCount} pages · {formatBytes(totals.byteLength)}</p></div></div>
              <button type="button" disabled={isAdding || entries.length >= MERGE_LIMITS.maxFiles} onClick={() => inputRef.current?.click()}>{isAdding ? progress?.message ?? "Adding…" : "+ Add more PDFs"}</button>
            </header>
            <div className="merge-layout">
              <section className="merge-files-panel" aria-labelledby="merge-files-title">
                <div className="merge-panel-heading"><div><span>1</span><div><h2 id="merge-files-title">Arrange PDF files</h2><p>The first file appears first in the merged PDF.</p></div></div><strong>{entries.length} files</strong></div>
                <ol className="merge-file-list">
                  {entries.map((entry, index) => (
                    <li key={entry.id}>
                      <span className="merge-order" aria-label={`Position ${index + 1}`}>{index + 1}</span>
                      <div className="merge-preview"><img src={entry.thumbnailUrl} alt={`First page preview of ${entry.inspection.fileName}`} /></div>
                      <div className="merge-file-copy"><strong>{entry.inspection.fileName}</strong><span>{entry.inspection.pageCount} page{entry.inspection.pageCount === 1 ? "" : "s"} · {formatBytes(entry.file.size)}</span>{entry.inspection.hasSignatures ? <small>Contains a digital signature</small> : null}</div>
                      <div className="merge-file-actions">
                        <button type="button" disabled={index === 0} aria-label={`Move ${entry.inspection.fileName} up`} onClick={() => moveEntry(index, index - 1)}>↑<span>Up</span></button>
                        <button type="button" disabled={index === entries.length - 1} aria-label={`Move ${entry.inspection.fileName} down`} onClick={() => moveEntry(index, index + 1)}>↓<span>Down</span></button>
                        <button type="button" className="is-remove" aria-label={`Remove ${entry.inspection.fileName}`} onClick={() => removeEntry(entry.id)}>×<span>Remove</span></button>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <aside className="merge-settings-panel" aria-labelledby="merge-settings-title">
                <div className="merge-panel-heading"><div><span>2</span><div><h2 id="merge-settings-title">Merge summary</h2><p>Review the output before combining.</p></div></div></div>
                <div className="merge-summary"><span><strong>{totals.fileCount}</strong>PDF files</span><span><strong>{totals.pageCount}</strong>Total pages</span><span><strong>{formatBytes(totals.byteLength)}</strong>Input size</span></div>
                <p className="merge-order-note"><strong>Output order</strong>{entries.map((entry, index) => `${index + 1}. ${entry.inspection.fileName}`).join(" → ")}</p>
                {entries.some((entry) => entry.inspection.hasSignatures) ? <p className="merge-warning"><strong>Digital signature warning:</strong> combining PDFs creates a new document, so source signatures will not remain valid.</p> : null}
                <p className="merge-scope-note"><strong>Native-page merge</strong>Pages are copied without intentional rasterization. Document-level bookmarks, metadata, attachments, scripts, forms, links, and signatures may not transfer or remain valid.</p>
                {entries.length < 2 ? <p className="merge-help">Add at least one more PDF to continue.</p> : null}
                <button type="button" className="merge-primary-button" disabled={isMerging || entries.length < 2} onClick={() => void mergeFiles()}>{isMerging ? progress?.message ?? "Merging PDFs…" : `Merge ${entries.length} PDFs`}</button>
                {isMerging ? <button type="button" className="merge-cancel-button" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
              </aside>
            </div>
          </div>
        )}

        {error !== null ? <p className="merge-error" role="alert">{error}</p> : null}
        {download !== null ? <section className="merge-result" aria-labelledby="merge-result-title"><span aria-hidden="true">✓</span><div><h2 id="merge-result-title">Your merged PDF is ready</h2><p>{download.mergedFileCount} PDFs combined into one {download.pageCount}-page document. Your source files are unchanged.</p></div><a href={download.url} download={download.downloadName}>Download merged PDF</a><button type="button" onClick={startOver}>Merge other PDFs</button></section> : null}
      </section>

      <section className="merge-benefits" aria-label="Merge PDF benefits"><article><span aria-hidden="true">↕</span><div><h2>Choose the file order</h2><p>Move PDFs up or down before creating the combined document.</p></div></article><article><span aria-hidden="true">▤</span><div><h2>Keep native PDF pages</h2><p>Pages are copied into the output without intentionally becoming screenshots.</p></div></article><article><span aria-hidden="true">⌂</span><div><h2>Private and local</h2><p>Preview, merging, validation, and download happen inside your browser.</p></div></article></section>

      <section className="merge-seo-copy">
        <h2>How to merge PDF files online</h2><ol><li>Choose two or more PDF files from your device.</li><li>Review each first-page preview and move files into the required order.</li><li>Select Merge PDFs and wait while the pages are copied locally.</li><li>Download the new combined PDF without changing the source files.</li></ol>
        <h2>Combine PDF files without uploading them</h2><p>PDFMech processes each selected document in your browser. The PDFs are not sent to PDFMech or a remote merging service.</p>
        <h2>Native PDF page merging</h2><p>Pages are copied from each source file into one new PDF in the order shown. They are not intentionally rasterized, helping ordinary text and vector content remain sharp.</p>
        <h2>Important merge limits</h2><p>The new document may not preserve document-level bookmarks, metadata, attachments, scripts, digital signatures, or every interactive form and link. Password-protected or damaged PDFs are not supported.</p>
        <h2>Merge PDF FAQ</h2>
        <h3>Are my PDF files uploaded?</h3><p>No. Previewing, ordering, merging, validation, and download happen locally in your browser.</p>
        <h3>Can I change the order before merging?</h3><p>Yes. Use the Move Up and Move Down controls to set the file order. Pages within each PDF keep their original order.</p>
        <h3>Will merging turn pages into images?</h3><p>No. PDFMech copies native PDF pages instead of intentionally converting them into screenshots.</p>
        <h3>Are digitally signed PDFs supported?</h3><p>They may be merged, but creating a new combined document means the original digital signatures will not remain valid.</p>
        <nav className="merge-related-links" aria-label="Related PDF tools"><strong>Related tools</strong><a href="/extract-pdf-pages">Extract PDF pages</a><a href="/delete-pdf-pages">Delete PDF pages</a><a href="/reorder-pdf-pages">Reorder PDF pages</a></nav>
      </section>
    </main>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "The PDF files could not be merged. Please try again.";
}
