import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type PointerEvent } from "react";

import { createNormalizedRedaction, redactedPageCount, type NormalizedPoint, type PdfRedaction } from "../domain/redact-pdf";
import { createLazyPdfRedactor } from "../infrastructure/pdflib/lazy-pdf-redactor";
import type { RedactPdfInspection, RedactPdfProgress, RedactPdfResult } from "../ports/redact-pdf";

const processor = createLazyPdfRedactor();

interface RedactionDownload extends RedactPdfResult { readonly url: string; }
interface DraftRectangle { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }

export function RedactPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const operationAbortRef = useRef<AbortController | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const drawStartRef = useRef<NormalizedPoint | null>(null);
  const redactionIdRef = useRef(0);
  const thumbnailUrlsRef = useRef<readonly string[]>([]);
  const previewUrlRef = useRef<string | null>(null);
  const downloadRef = useRef<RedactionDownload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<RedactPdfInspection | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<readonly string[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [redactions, setRedactions] = useState<readonly PdfRedaction[]>([]);
  const [draft, setDraft] = useState<DraftRectangle | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState<RedactPdfProgress | null>(null);
  const [download, setDownload] = useState<RedactionDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRedacting, setIsRedacting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { thumbnailUrlsRef.current = thumbnailUrls; }, [thumbnailUrls]);
  useEffect(() => { previewUrlRef.current = previewUrl; }, [previewUrl]);
  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => {
    operationAbortRef.current?.abort();
    previewAbortRef.current?.abort();
    thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    if (previewUrlRef.current !== null) URL.revokeObjectURL(previewUrlRef.current);
    if (downloadRef.current !== null) URL.revokeObjectURL(downloadRef.current.url);
  }, []);

  useEffect(() => {
    if (file === null || inspection === null) return;
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setIsPreviewing(true);
    setError(null);
    void processor.renderPreview(file, activePage, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      const nextUrl = URL.createObjectURL(blob);
      setPreviewUrl((current) => { if (current !== null) URL.revokeObjectURL(current); return nextUrl; });
    }).catch((previewError: unknown) => {
      if (!(previewError instanceof Error && previewError.name === "AbortError")) setError(messageFromError(previewError));
    }).finally(() => { if (!controller.signal.aborted) setIsPreviewing(false); });
    return () => controller.abort();
  }, [activePage, file, inspection]);

  function clearDownload(): void {
    setDownload((current) => { if (current !== null) URL.revokeObjectURL(current.url); return null; });
  }

  function clearThumbnails(): void {
    setThumbnailUrls((current) => { current.forEach((url) => URL.revokeObjectURL(url)); return []; });
  }

  async function chooseFile(selected: File | null): Promise<void> {
    if (selected === null) return;
    operationAbortRef.current?.abort();
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    operationAbortRef.current = controller;
    clearDownload();
    clearThumbnails();
    setPreviewUrl((current) => { if (current !== null) URL.revokeObjectURL(current); return null; });
    setFile(null); setInspection(null); setRedactions([]); setActivePage(0); setConfirmed(false); setError(null); setIsInspecting(true);
    try {
      const nextInspection = await processor.inspect(selected, setProgress, controller.signal);
      setFile(selected);
      setInspection(nextInspection);
      setThumbnailUrls(nextInspection.pages.map((page) => URL.createObjectURL(page.thumbnail)));
    } catch (inspectError) {
      if (!(inspectError instanceof Error && inspectError.name === "AbortError")) setError(messageFromError(inspectError));
    } finally {
      setProgress(null); setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function beginDrawing(event: PointerEvent<HTMLDivElement>): void {
    if (isPreviewing || isRedacting || previewUrl === null || stageRef.current === null) return;
    if ((event.target as HTMLElement).closest(".redact-area") !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event, stageRef.current);
    drawStartRef.current = point;
    setDraft({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function continueDrawing(event: PointerEvent<HTMLDivElement>): void {
    const start = drawStartRef.current;
    if (start === null || stageRef.current === null) return;
    event.preventDefault();
    setDraft(rectangleFromPoints(start, pointFromEvent(event, stageRef.current)));
  }

  function finishDrawing(event: PointerEvent<HTMLDivElement>): void {
    const start = drawStartRef.current;
    drawStartRef.current = null;
    setDraft(null);
    if (start === null || stageRef.current === null) return;
    event.preventDefault();
    const redaction = createNormalizedRedaction(`redaction-${++redactionIdRef.current}`, activePage, start, pointFromEvent(event, stageRef.current));
    if (redaction === null) return;
    setRedactions((current) => [...current, redaction]);
    setConfirmed(false);
    clearDownload();
  }

  function removeRedaction(id: string): void {
    setRedactions((current) => current.filter((item) => item.id !== id));
    setConfirmed(false);
    clearDownload();
  }

  async function applyRedactions(): Promise<void> {
    if (file === null || redactions.length === 0 || !confirmed) return;
    const controller = new AbortController();
    operationAbortRef.current = controller;
    clearDownload(); setError(null); setIsRedacting(true);
    try {
      const result = await processor.redact(file, redactions, setProgress, controller.signal);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (redactError) {
      if (!(redactError instanceof Error && redactError.name === "AbortError")) setError(messageFromError(redactError));
    } finally {
      setProgress(null); setIsRedacting(false);
    }
  }

  function startOver(): void {
    operationAbortRef.current?.abort(); previewAbortRef.current?.abort(); clearDownload(); clearThumbnails();
    setPreviewUrl((current) => { if (current !== null) URL.revokeObjectURL(current); return null; });
    setFile(null); setInspection(null); setRedactions([]); setActivePage(0); setConfirmed(false); setError(null); setProgress(null);
  }

  const currentRedactions = redactions.filter((redaction) => redaction.pageIndex === activePage);
  const affectedPages = redactedPageCount(redactions);

  return (
    <main className="redact-pdf-page">
      <section className="redact-pdf-hero"><span className="hero-kicker">PERMANENT LOCAL REDACTION</span><h1>Redact PDF content securely online.</h1><p>Draw over sensitive content and create a new PDF with the covered text and graphics removed from those pages. Nothing is uploaded.</p><div className="redact-pdf-trust"><span><b>&#10003;</b> Permanent</span><span><b>&#128274;</b> Browser-local</span><span><b>&#9675;</b> No account</span></div></section>

      <section className="redact-pdf-tool" id="redact-pdf-tool" aria-labelledby="redact-tool-title">
        <div className="redact-pdf-steps"><span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "\u2713"}</b><i>Choose PDF</i></span><span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "\u2713"}</b><i>Mark content</i></span><span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span></div>
        <input ref={inputRef} className="redact-pdf-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />
        {inspection === null ? <button type="button" className="redact-pdf-drop" disabled={isInspecting} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}><span className="redact-pdf-file-icon">PDF</span><strong>{isInspecting ? progress?.message ?? "Preparing pages..." : "Drop your PDF here"}</strong><small>Mark names, account numbers, addresses, signatures, or other sensitive page content.</small><i>Choose PDF</i><em>Up to 100 MB and 300 pages - processed locally</em></button> : (
          <div className="redact-workspace">
            <header className="redact-document"><div><span>PDF</span><div><h2 id="redact-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages - {formatBytes(inspection.byteLength)}</p></div></div><button type="button" onClick={startOver}>Choose another PDF</button></header>
            <div className="redact-layout">
              <aside className="redact-thumbnails" aria-label="PDF pages"><div><strong>Pages</strong><span>{affectedPages} marked</span></div><div className="redact-thumbnail-list">{inspection.pages.map((page, index) => { const count = redactions.filter((item) => item.pageIndex === index).length; return <button type="button" key={page.pageIndex} className={activePage === index ? "is-active" : ""} onClick={() => setActivePage(index)}><span><img src={thumbnailUrls[index]} alt={`Page ${index + 1}`} />{count > 0 ? <b>{count}</b> : null}</span><small>Page {index + 1}</small></button>; })}</div></aside>
              <section className="redact-editor" aria-label={`Redaction editor for page ${activePage + 1}`}><header><div><strong>Draw redaction areas</strong><span>Drag over every item that must be removed.</span></div><b>Page {activePage + 1} / {inspection.pageCount}</b></header><div className="redact-canvas-scroll">{isPreviewing || previewUrl === null ? <div className="redact-preview-loading">Preparing page {activePage + 1}...</div> : <div ref={stageRef} className="redact-stage" onPointerDown={beginDrawing} onPointerMove={continueDrawing} onPointerUp={finishDrawing} onPointerCancel={() => { drawStartRef.current = null; setDraft(null); }}><img src={previewUrl} alt={`Large preview of page ${activePage + 1}`} draggable={false} />{currentRedactions.map((redaction, index) => <button type="button" key={redaction.id} className="redact-area" style={rectangleStyle(redaction)} aria-label={`Remove redaction ${index + 1} from page ${activePage + 1}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => removeRedaction(redaction.id)}><span>{index + 1}</span><b aria-hidden="true">&times;</b></button>)}{draft !== null ? <span className="redact-draft" style={rectangleStyle(draft)} /> : null}</div>}</div><p className="redact-editor-tip"><b>Tip:</b> slightly extend each box beyond the sensitive content so its edges are fully covered.</p></section>
              <aside className="redact-controls"><span className="redact-controls-kicker">SECURE REDACTION</span><h2>Review your marks</h2><p>Redacted pages are flattened so content beneath the black areas is not retained as selectable PDF text.</p><div className="redact-counts"><span><strong>{redactions.length}</strong>Areas</span><span><strong>{affectedPages}</strong>Pages affected</span><span><strong>{inspection.pageCount - affectedPages}</strong>Pages preserved</span></div><div className="redact-actions"><button type="button" disabled={currentRedactions.length === 0} onClick={() => { setRedactions((current) => current.filter((item) => item.pageIndex !== activePage)); setConfirmed(false); clearDownload(); }}>Clear this page</button><button type="button" disabled={redactions.length === 0} onClick={() => { setRedactions((current) => current.slice(0, -1)); setConfirmed(false); clearDownload(); }}>Undo last</button><button type="button" disabled={redactions.length === 0} onClick={() => { setRedactions([]); setConfirmed(false); clearDownload(); }}>Clear all</button></div><p className="redact-security-note"><strong>What the export does</strong>Marked pages become new page images with solid black areas baked in. Untouched pages remain native. Source metadata, attachments, scripts, and signatures are not carried into the new document.</p>{inspection.hasSignatures ? <p className="redact-signature"><strong>Signed document detected.</strong> The new redacted PDF cannot preserve valid digital signatures.</p> : null}<label className="redact-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I reviewed every page and understand that applied redactions cannot be removed from the downloaded PDF.</span></label><button type="button" className="redact-primary" disabled={isRedacting || redactions.length === 0 || !confirmed} onClick={() => void applyRedactions()}>{isRedacting ? progress?.message ?? "Applying permanent redactions..." : `Apply ${redactions.length || ""} permanent redaction${redactions.length === 1 ? "" : "s"}`}</button>{isRedacting ? <button type="button" className="redact-cancel" onClick={() => operationAbortRef.current?.abort()}>Cancel</button> : null}</aside>
            </div>
          </div>
        )}
        {error !== null ? <p className="redact-error" role="alert">{error}</p> : null}
        {download !== null ? <section className="redact-result"><span>&#10003;</span><div><h2>Your permanently redacted PDF is ready</h2><p>{download.redactionCount} area{download.redactionCount === 1 ? "" : "s"} baked into {download.redactedPageCount} page{download.redactedPageCount === 1 ? "" : "s"}; {download.preservedPageCount} untouched page{download.preservedPageCount === 1 ? "" : "s"} kept native.</p></div><a href={download.url} download={download.downloadName}>Download redacted PDF</a><p><strong>Verify before sharing:</strong> reopen the download, search for the sensitive text, and try copying from the redacted area.</p></section> : null}
      </section>

      <section className="redact-vs-whiteout" aria-labelledby="redact-vs-whiteout-title"><div><span>Before you start</span><h2 id="redact-vs-whiteout-title">Do you need permanent removal?</h2><p>Use this redaction tool for confidential information. If you only need to cover outdated text visually, use Whiteout instead.</p></div><div><a href="/whiteout-pdf"><small>Visual correction</small><strong>Use Whiteout PDF</strong><span>Underlying data may remain →</span></a><a className="is-current" href="#redact-pdf-tool"><small>Sensitive information</small><strong>Use secure redaction</strong><span>Marked content is removed →</span></a></div></section>
      <section className="redact-benefits"><article><span>&#9632;</span><div><h2>Permanent page redaction</h2><p>Selected content is covered before the affected page image is embedded into a new PDF.</p></div></article><article><span>&#128274;</span><div><h2>Private local processing</h2><p>Previewing, drawing, rebuilding, validation, and download happen in your browser.</p></div></article><article><span>&#10003;</span><div><h2>Untouched pages stay native</h2><p>Only pages containing redactions are flattened, preserving quality elsewhere.</p></div></article></section>
      <section className="redact-copy"><h2>How to redact a PDF securely online</h2><ol><li>Choose a PDF from your device.</li><li>Open each page containing sensitive content.</li><li>Drag a black redaction area over every item that must be removed.</li><li>Review all marked pages, apply the redactions, and verify the downloaded PDF.</li></ol><h2>Permanent redaction instead of visual whiteout</h2><p>A visual white rectangle can leave the original text underneath. PDFMech instead renders each marked page and embeds a new flattened page image with the black areas baked in.</p><h2>Private browser-local PDF redaction</h2><p>Your source document is processed locally. PDFMech does not upload it to a remote redaction server.</p><h2>Redaction limits and verification</h2><p>Marked pages lose selectable text, links, forms, annotations, and accessibility structure because they become page images. Always reopen the result and confirm sensitive text cannot be searched, selected, copied, or revealed.</p><h2>Redact PDF FAQ</h2><h3>Is secure redaction different from whiteout?</h3><p>Yes. Whiteout adds a visual cover. Secure redaction rebuilds marked pages without retaining the underlying PDF text or graphics beneath selected regions.</p><h3>Does PDFMech upload my document?</h3><p>No. Page previews, redaction, PDF generation, validation, and download happen in your browser.</p><h3>Will all pages become images?</h3><p>No. Only pages containing redaction areas are flattened. Unmarked pages are copied natively into the new PDF.</p><h3>Can redactions be undone after download?</h3><p>No. Applied redactions are permanent in the generated copy. Your original source PDF remains unchanged on your device.</p><nav className="redact-related"><strong>Related tools</strong><a href="/whiteout-pdf">Visual whiteout</a><a href="/remove-pdf-metadata">Remove metadata</a><a href="/flatten-pdf">Flatten forms</a><a href="/editor">PDF editor</a></nav></section>
    </main>
  );
}

function pointFromEvent(event: PointerEvent<HTMLDivElement>, stage: HTMLDivElement): NormalizedPoint { const bounds = stage.getBoundingClientRect(); return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height }; }
function rectangleFromPoints(start: NormalizedPoint, end: NormalizedPoint): DraftRectangle { const x1 = Math.max(0, Math.min(1, start.x)); const y1 = Math.max(0, Math.min(1, start.y)); const x2 = Math.max(0, Math.min(1, end.x)); const y2 = Math.max(0, Math.min(1, end.y)); return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }; }
function rectangleStyle(rectangle: Pick<PdfRedaction, "x" | "y" | "width" | "height">): CSSProperties { return { left: `${rectangle.x * 100}%`, top: `${rectangle.y * 100}%`, width: `${rectangle.width * 100}%`, height: `${rectangle.height * 100}%` }; }
function formatBytes(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function messageFromError(error: unknown): string { return error instanceof Error ? error.message : "The PDF could not be redacted. Please try another file."; }
