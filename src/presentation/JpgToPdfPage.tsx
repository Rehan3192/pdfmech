import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { JPG_TO_PDF_LIMITS, moveJpgItem, type JpgPdfMargin, type JpgPdfOrientation, type JpgPdfPageSize } from "../domain/jpg-to-pdf";
import { createLazyJpgToPdfProcessor } from "../infrastructure/pdflib/lazy-jpg-to-pdf";
import type { JpgInspection, JpgToPdfProgress, JpgToPdfResult } from "../ports/jpg-to-pdf";

const processor = createLazyJpgToPdfProcessor();

interface JpgEntry { readonly id: string; readonly file: File; readonly inspection: JpgInspection; readonly previewUrl: string; }
interface JpgPdfDownload extends JpgToPdfResult { readonly url: string; }

export function JpgToPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const entriesRef = useRef<readonly JpgEntry[]>([]);
  const downloadRef = useRef<JpgPdfDownload | null>(null);
  const [entries, setEntries] = useState<readonly JpgEntry[]>([]);
  const [pageSize, setPageSize] = useState<JpgPdfPageSize>("fit");
  const [orientation, setOrientation] = useState<JpgPdfOrientation>("auto");
  const [margin, setMargin] = useState<JpgPdfMargin>("small");
  const [progress, setProgress] = useState<JpgToPdfProgress | null>(null);
  const [download, setDownload] = useState<JpgPdfDownload | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => {
    abortRef.current?.abort();
    entriesRef.current.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    if (downloadRef.current !== null) URL.revokeObjectURL(downloadRef.current.url);
  }, []);

  const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);

  function clearDownload(): void {
    setDownload((current) => { if (current !== null) URL.revokeObjectURL(current.url); return null; });
  }

  async function addFiles(files: readonly File[]): Promise<void> {
    if (files.length === 0) return;
    if (entries.length + files.length > JPG_TO_PDF_LIMITS.maxFiles) { setError(`Choose no more than ${JPG_TO_PDF_LIMITS.maxFiles} JPG images in total.`); return; }
    const nextTotalBytes = totalBytes + files.reduce((sum, file) => sum + file.size, 0);
    if (nextTotalBytes > JPG_TO_PDF_LIMITS.maxTotalBytes) { setError("The selected images exceed the 150 MB combined limit."); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsAdding(true);
    const inspected: JpgEntry[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setProgress({ phase: "inspecting", completed: index, total: files.length, message: `Checking ${file.name}` });
        const inspection = await processor.inspect(file, controller.signal);
        inspected.push({ id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`, file, inspection, previewUrl: URL.createObjectURL(file) });
      }
      setEntries((current) => [...current, ...inspected]);
    } catch (addError) {
      inspected.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
      if (!(addError instanceof Error && addError.name === "AbortError")) setError(messageFromError(addError));
    } finally {
      setProgress(null);
      setIsAdding(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function moveEntry(fromIndex: number, toIndex: number): void {
    setEntries((current) => moveJpgItem(current, fromIndex, toIndex));
    clearDownload();
  }

  function removeEntry(id: string): void {
    setEntries((current) => {
      const removed = current.find((entry) => entry.id === id);
      if (removed !== undefined) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
    clearDownload();
    setError(null);
  }

  async function createPdf(): Promise<void> {
    if (entries.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsConverting(true);
    try {
      const result = await processor.convert(entries.map((entry) => ({ file: entry.file, width: entry.inspection.width, height: entry.inspection.height })), { pageSize, orientation, margin }, setProgress, controller.signal);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (convertError) {
      if (!(convertError instanceof Error && convertError.name === "AbortError")) setError(messageFromError(convertError));
    } finally {
      setProgress(null);
      setIsConverting(false);
    }
  }

  function startOver(): void {
    abortRef.current?.abort();
    entries.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    setEntries([]);
    clearDownload();
    setProgress(null);
    setError(null);
  }

  function updateSetting(action: () => void): void { action(); clearDownload(); setError(null); }

  return (
    <main className="jpg-pdf-page">
      <section className="jpg-pdf-hero">
        <span className="hero-kicker">PRIVATE JPG TO PDF CONVERTER</span>
        <h1>Convert JPG images to one PDF.</h1>
        <p>Arrange photos or scans, choose the page layout, and create one PDF directly in your browser. Your images never leave your device.</p>
        <div className="jpg-pdf-trust"><span><b aria-hidden="true">&#10003;</b> Free</span><span><b aria-hidden="true">&#8645;</b> Arrange images</span><span><b aria-hidden="true">&#9889;</b> No upload</span></div>
      </section>

      <section className="jpg-pdf-tool" id="jpg-to-pdf-tool" aria-labelledby="jpg-pdf-tool-title">
        <div className="jpg-pdf-steps"><span className={entries.length === 0 ? "is-active" : "is-complete"}><b>{entries.length === 0 ? "1" : "\u2713"}</b><i>Choose JPGs</i></span><span className={entries.length > 0 && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "\u2713"}</b><i>Arrange &amp; set pages</i></span><span className={download !== null ? "is-active" : ""}><b>3</b><i>Download PDF</i></span></div>
        <input ref={inputRef} className="jpg-pdf-input" type="file" accept="image/jpeg,.jpg,.jpeg" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void addFiles(Array.from(event.target.files ?? []))} />

        {entries.length === 0 ? <button type="button" className="jpg-pdf-drop" disabled={isAdding} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void addFiles(Array.from(event.dataTransfer.files)); }}><span className="jpg-pdf-stack" aria-hidden="true"><i>JPG</i><i>JPG</i></span><strong>{isAdding ? progress?.message ?? "Checking images..." : "Drop JPG images here"}</strong><small>Add photos, scans, receipts, or screenshots in the order they should appear.</small><em>Choose JPG images</em><span>Up to 25 images - 150 MB combined - processed locally</span></button> : (
          <div className="jpg-pdf-workspace">
            <header className="jpg-pdf-document"><div><span aria-hidden="true">JPG</span><div><h2 id="jpg-pdf-tool-title">Images ready for PDF</h2><p>{entries.length} image{entries.length === 1 ? "" : "s"} - {formatBytes(totalBytes)}</p></div></div><button type="button" disabled={isAdding || entries.length >= JPG_TO_PDF_LIMITS.maxFiles} onClick={() => inputRef.current?.click()}>{isAdding ? progress?.message ?? "Adding images..." : "+ Add more JPGs"}</button></header>
            <div className="jpg-pdf-layout">
              <section className="jpg-pdf-images" aria-labelledby="jpg-pdf-images-title"><div className="jpg-pdf-heading"><div><span>1</span><div><h2 id="jpg-pdf-images-title">Arrange images</h2><p>The first image becomes page 1.</p></div></div><strong>{entries.length} pages</strong></div><ol>{entries.map((entry, index) => <li key={entry.id}><span className="jpg-pdf-order">{index + 1}</span><div className="jpg-pdf-preview"><img src={entry.previewUrl} alt={`Preview of ${entry.inspection.fileName}`} /></div><div className="jpg-pdf-file"><strong>{entry.inspection.fileName}</strong><span>{entry.inspection.width} × {entry.inspection.height} px - {formatBytes(entry.file.size)}</span></div><div className="jpg-pdf-actions"><button type="button" disabled={index === 0} aria-label={`Move ${entry.inspection.fileName} up`} onClick={() => moveEntry(index, index - 1)}>&uarr;<span>Up</span></button><button type="button" disabled={index === entries.length - 1} aria-label={`Move ${entry.inspection.fileName} down`} onClick={() => moveEntry(index, index + 1)}>&darr;<span>Down</span></button><button type="button" className="is-remove" aria-label={`Remove ${entry.inspection.fileName}`} onClick={() => removeEntry(entry.id)}>&times;<span>Remove</span></button></div></li>)}</ol></section>
              <aside className="jpg-pdf-settings" aria-labelledby="jpg-pdf-settings-title"><div className="jpg-pdf-heading"><div><span>2</span><div><h2 id="jpg-pdf-settings-title">PDF page settings</h2><p>Control paper size, orientation, and spacing.</p></div></div></div>
                <fieldset><legend>Page size</legend><div className="jpg-pdf-choice-row">{([['fit','Fit image'],['a4','A4'],['letter','Letter']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={pageSize === value} className={pageSize === value ? "is-selected" : ""} onClick={() => updateSetting(() => setPageSize(value))}>{label}</button>)}</div></fieldset>
                <fieldset><legend>Orientation</legend><div className="jpg-pdf-choice-row">{([['auto','Auto'],['portrait','Portrait'],['landscape','Landscape']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={orientation === value} className={orientation === value ? "is-selected" : ""} onClick={() => updateSetting(() => setOrientation(value))}>{label}</button>)}</div></fieldset>
                <fieldset><legend>Margin</legend><div className="jpg-pdf-choice-row">{([['none','None'],['small','Small'],['large','Large']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={margin === value} className={margin === value ? "is-selected" : ""} onClick={() => updateSetting(() => setMargin(value))}>{label}</button>)}</div></fieldset>
                <div className="jpg-pdf-summary"><span><small>Pages</small><strong>{entries.length}</strong></span><span><small>Paper</small><strong>{pageSize === "fit" ? "Image fit" : pageSize.toUpperCase()}</strong></span><span><small>Margin</small><strong>{capitalize(margin)}</strong></span></div>
                <p className="jpg-pdf-note"><strong>One image per page</strong>Each JPG is placed proportionally on a white PDF page. Images are never stretched or cropped.</p>
                <button type="button" className="jpg-pdf-primary" disabled={isConverting} onClick={() => void createPdf()}>{isConverting ? progress?.message ?? "Creating PDF..." : `Create PDF with ${entries.length} page${entries.length === 1 ? "" : "s"}`}</button>{isConverting ? <button type="button" className="jpg-pdf-cancel" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
              </aside>
            </div>
          </div>
        )}

        {error !== null ? <p className="jpg-pdf-error" role="alert">{error}</p> : null}
        {download !== null ? <section className="jpg-pdf-result" aria-labelledby="jpg-pdf-result-title"><span aria-hidden="true">&#10003;</span><div><h2 id="jpg-pdf-result-title">Your PDF is ready</h2><p>{download.pageCount} page{download.pageCount === 1 ? "" : "s"} - {formatBytes(download.outputBytes)} - source images unchanged</p></div><a href={download.url} download={download.downloadName}>Download PDF</a><button type="button" onClick={startOver}>Convert other images</button></section> : null}
      </section>

      <section className="jpg-pdf-benefits"><article><span aria-hidden="true">&#8645;</span><div><h2>Arrange before converting</h2><p>Move every image up or down to control the PDF page order.</p></div></article><article><span aria-hidden="true">A4</span><div><h2>Flexible page layouts</h2><p>Fit pages to images or choose printable A4 and Letter paper.</p></div></article><article><span aria-hidden="true">&#128274;</span><div><h2>Private local conversion</h2><p>Image decoding, PDF creation, and validation happen on your device.</p></div></article></section>
      <section className="jpg-pdf-copy"><h2>How to convert JPG images to PDF</h2><ol><li>Choose one or more JPG images from your device.</li><li>Move images up or down into the required page order.</li><li>Select Fit image, A4, or Letter pages, then choose orientation and margins.</li><li>Create and download one validated PDF in your browser.</li></ol><h2>Combine multiple JPG files into one PDF</h2><p>Each image becomes one PDF page in the exact order shown. You can add, remove, and rearrange images before creating the document.</p><h2>Private browser-local image conversion</h2><p>PDFMech decodes the JPG files, builds the PDF, and validates its page count inside your browser. Your images are not uploaded to a conversion server.</p><h2>Page size, orientation, and margin options</h2><p>Fit image follows each image shape, while A4 and Letter are useful for printing. Auto orientation follows each image, and margins add white space without cropping the picture.</p><h2>JPG to PDF FAQ</h2><h3>Are my JPG images uploaded?</h3><p>No. JPG inspection, arrangement, PDF creation, validation, and download happen locally in your browser.</p><h3>Can I combine several JPGs into one PDF?</h3><p>Yes. Add up to 25 images and arrange them. Each image becomes one page in the finished PDF.</p><h3>Will PDFMech crop or stretch my images?</h3><p>No. Each JPG is scaled proportionally to fit the selected page and margin area.</p><h3>Should I choose Fit image, A4, or Letter?</h3><p>Fit image is best for preserving the original image shape. Choose A4 or Letter when you need standard printable pages.</p><nav className="jpg-pdf-related"><strong>Related tools</strong><a href="/pdf-to-jpg">PDF to JPG</a><a href="/merge-pdf">Merge PDF</a><a href="/ocr-pdf">OCR PDF</a><a href="/tools">All PDF tools</a></nav></section>
    </main>
  );
}

function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function capitalize(value: string): string { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
function messageFromError(error: unknown): string { return error instanceof Error ? error.message : "The JPG images could not be converted to PDF. Please try again."; }
