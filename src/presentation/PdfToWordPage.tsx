import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { createLazyPdfToWordProcessor } from "../infrastructure/word/lazy-pdf-to-word";
import type { PdfWordInspection, PdfWordResult, WordConversionProgress } from "../ports/word-conversion";

const processor = createLazyPdfToWordProcessor();

interface Download extends PdfWordResult { readonly url: string; }

export function PdfToWordPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const downloadRef = useRef<Download | null>(null);
  const [inspection, setInspection] = useState<PdfWordInspection | null>(null);
  const [progress, setProgress] = useState<WordConversionProgress | null>(null);
  const [download, setDownload] = useState<Download | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => { abortRef.current?.abort(); if (downloadRef.current !== null) URL.revokeObjectURL(downloadRef.current.url); }, []);

  function clearDownload(): void {
    setDownload((current) => { if (current !== null) URL.revokeObjectURL(current.url); return null; });
  }

  async function chooseFile(file: File | null): Promise<void> {
    if (file === null) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload(); setInspection(null); setError(null); setBusy(true);
    try { setInspection(await processor.inspect(file, setProgress, controller.signal)); }
    catch (cause) { if (!(cause instanceof Error && cause.name === "AbortError")) setError(messageFromError(cause)); }
    finally { setBusy(false); setProgress(null); if (inputRef.current !== null) inputRef.current.value = ""; }
  }

  async function convert(): Promise<void> {
    if (inspection === null) return;
    const controller = new AbortController(); abortRef.current = controller; clearDownload(); setError(null); setBusy(true);
    try {
      const result = await processor.convert(inspection, setProgress, controller.signal);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (cause) { if (!(cause instanceof Error && cause.name === "AbortError")) setError(messageFromError(cause)); }
    finally { setBusy(false); setProgress(null); }
  }

  const scannedPages = inspection?.pages.filter((page) => page.lines.length === 0).length ?? 0;
  return (
    <main className="word-converter-page">
      <section className="word-converter-hero">
        <div><span className="hero-kicker">PRIVATE PDF TO WORD</span><h1>Convert PDF to editable Word.</h1><p>Extract selectable PDF text into a downloadable DOCX without uploading your document.</p></div>
        <div className="word-converter-trust"><span>✓ Browser-local</span><span>✓ Editable DOCX</span><span>✓ No account</span></div>
      </section>
      <section className="word-converter-tool" id="pdf-to-word-tool" aria-labelledby="pdf-word-tool-title">
        <header className="word-converter-steps"><span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "✓"}</b> Choose PDF</span><span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "✓"}</b> Review text</span><span className={download !== null ? "is-active" : ""}><b>3</b> Download DOCX</span></header>
        <input ref={inputRef} className="word-converter-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />
        {inspection === null ? (
          <button className="word-converter-drop" type="button" disabled={busy} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}>
            <span aria-hidden="true">PDF</span><strong>{busy ? progress?.message ?? "Reading your PDF..." : "Upload PDF here"}</strong><small>Best for digital PDFs with selectable text</small><i>Choose PDF</i><em>Up to 100 MB and 300 pages · processed locally</em>
          </button>
        ) : (
          <div className="word-converter-workspace">
            <header className="word-converter-file"><span aria-hidden="true">PDF</span><div><h2 id="pdf-word-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages · {formatBytes(inspection.byteLength)} · {inspection.characterCount.toLocaleString()} characters</p></div><button type="button" onClick={() => { setInspection(null); clearDownload(); }}>Change file</button></header>
            <div className="word-converter-layout">
              <section className="word-converter-preview"><h2>Extracted text preview</h2><p>Check that the PDF contains readable selectable text.</p><div>{inspection.pages.slice(0, 3).map((page) => <article key={page.pageNumber}><strong>Page {page.pageNumber}</strong><p>{page.lines.slice(0, 8).join("\n") || "No selectable text found on this page."}</p></article>)}</div></section>
              <aside className="word-converter-settings"><h2>Word output</h2><dl><div><dt>Pages</dt><dd>{inspection.pageCount}</dd></div><div><dt>Text</dt><dd>{inspection.characterCount > 0 ? "Detected" : "Not detected"}</dd></div><div><dt>Scanned pages</dt><dd>{scannedPages}</dd></div></dl>{scannedPages > 0 ? <p className="word-converter-warning">{scannedPages} page{scannedPages === 1 ? " has" : "s have"} no selectable text. Use OCR PDF first if those pages contain scanned words.</p> : null}<p className="word-converter-note"><strong>What transfers</strong>Text becomes editable paragraphs. Exact columns, fonts, spacing, forms, and floating objects may change.</p><button className="word-converter-primary" type="button" disabled={busy || inspection.characterCount === 0} onClick={() => void convert()}>{busy ? progress?.message ?? "Creating DOCX..." : "Convert PDF to Word"}</button>{busy ? <button className="word-converter-cancel" type="button" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}</aside>
            </div>
          </div>
        )}
        {error !== null ? <p className="word-converter-error" role="alert">{error}</p> : null}
        {download !== null ? <section className="word-converter-result"><span>✓</span><div><h2>Your Word document is ready</h2><p>Editable DOCX · {formatBytes(download.outputBytes)}</p></div><a href={download.url} download={download.downloadName}>Download Word file</a></section> : null}
      </section>
      <ConverterCopy />
    </main>
  );
}

function ConverterCopy() {
  return <section className="word-converter-copy"><h2>How to convert PDF to Word</h2><ol><li>Choose a PDF with selectable text.</li><li>Review the extracted text preview.</li><li>Create and download an editable DOCX file.</li></ol><h2>When should I run OCR first?</h2><p>If the preview is empty, the PDF is probably a scan or photo. Make it searchable with OCR PDF, then convert that searchable copy to Word.</p><h2>Conversion limits</h2><p>PDF stores content by page position, while Word reflows editable document structure. Text remains editable, but complex columns, exact fonts, page breaks, forms, and floating graphics may not match the source.</p><nav aria-label="Related tools"><a href="/ocr-pdf">OCR PDF</a><a href="/word-to-pdf">Word to PDF</a><a href="/pdf-to-jpg">PDF to JPG</a><a href="/tools">All PDF tools</a></nav></section>;
}

function formatBytes(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function messageFromError(error: unknown): string { return error instanceof Error ? error.message : "The PDF could not be converted to Word."; }
