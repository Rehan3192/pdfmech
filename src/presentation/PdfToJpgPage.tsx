import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { PDF_TO_JPG_PRESETS, parsePdfPageSelection, type PdfToJpgQuality } from "../domain/pdf-to-jpg";
import { createLazyPdfToJpgProcessor } from "../infrastructure/pdflib/lazy-pdf-to-jpg";
import type { PdfToJpgInspection, PdfToJpgProgress, PdfToJpgResult } from "../ports/pdf-to-jpg";

const processor = createLazyPdfToJpgProcessor();

interface PdfToJpgDownload extends PdfToJpgResult { readonly url: string; }

export function PdfToJpgPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const thumbnailUrlsRef = useRef<readonly string[]>([]);
  const downloadRef = useRef<PdfToJpgDownload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<PdfToJpgInspection | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<readonly string[]>([]);
  const [selectionMode, setSelectionMode] = useState<"all" | "custom">("all");
  const [pageRange, setPageRange] = useState("");
  const [quality, setQuality] = useState<PdfToJpgQuality>("balanced");
  const [progress, setProgress] = useState<PdfToJpgProgress | null>(null);
  const [download, setDownload] = useState<PdfToJpgDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { thumbnailUrlsRef.current = thumbnailUrls; }, [thumbnailUrls]);
  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => {
    abortRef.current?.abort();
    thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    if (downloadRef.current !== null) URL.revokeObjectURL(downloadRef.current.url);
  }, []);

  function clearDownload(): void {
    setDownload((current) => {
      if (current !== null) URL.revokeObjectURL(current.url);
      return null;
    });
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
    setError(null);
    setSelectionMode("all");
    setPageRange("");
    setIsInspecting(true);
    try {
      const nextInspection = await processor.inspect(selected, setProgress, controller.signal);
      setFile(selected);
      setInspection(nextInspection);
      setThumbnailUrls(nextInspection.pages.map((page) => URL.createObjectURL(page.thumbnail)));
    } catch (inspectError) {
      if (!(inspectError instanceof Error && inspectError.name === "AbortError")) setError(messageFromError(inspectError));
    } finally {
      setProgress(null);
      setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function selectedPageIndexes(): readonly number[] {
    if (inspection === null) return [];
    return selectionMode === "all"
      ? Array.from({ length: inspection.pageCount }, (_, index) => index)
      : parsePdfPageSelection(pageRange, inspection.pageCount);
  }

  function selectSinglePage(pageIndex: number): void {
    setSelectionMode("custom");
    setPageRange(String(pageIndex + 1));
    setError(null);
    clearDownload();
  }

  async function convertPdf(): Promise<void> {
    if (file === null || inspection === null) return;
    let pageIndexes: readonly number[];
    try { pageIndexes = selectedPageIndexes(); }
    catch (selectionError) { setError(messageFromError(selectionError)); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsConverting(true);
    try {
      const result = await processor.convert(file, pageIndexes, quality, setProgress, controller.signal);
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
    clearDownload();
    clearThumbnails();
    setFile(null);
    setInspection(null);
    setProgress(null);
    setError(null);
  }

  let selectedCount = inspection?.pageCount ?? 0;
  if (inspection !== null && selectionMode === "custom") {
    try { selectedCount = parsePdfPageSelection(pageRange, inspection.pageCount).length; }
    catch { selectedCount = 0; }
  }

  return (
    <main className="pdf-jpg-page">
      <section className="pdf-jpg-hero">
        <span className="hero-kicker">PRIVATE PDF TO JPG CONVERTER</span>
        <h1>Convert PDF pages to JPG images.</h1>
        <p>Turn every page—or only the pages you choose—into clear JPG files directly in your browser. Your PDF is never uploaded.</p>
        <div className="pdf-jpg-trust" aria-label="PDF to JPG benefits"><span><b aria-hidden="true">&#10003;</b> Free</span><span><b aria-hidden="true">&#9889;</b> No upload</span><span><b aria-hidden="true">JPG</b> Three quality levels</span></div>
      </section>

      <section className="pdf-jpg-tool" id="pdf-to-jpg-tool" aria-labelledby="pdf-jpg-tool-title">
        <div className="pdf-jpg-steps" aria-label="PDF to JPG workflow">
          <span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "\u2713"}</b><i>Choose PDF</i></span>
          <span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "\u2713"}</b><i>Select pages</i></span>
          <span className={download !== null ? "is-active" : ""}><b>3</b><i>Download JPG</i></span>
        </div>
        <input ref={inputRef} className="pdf-jpg-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />

        {inspection === null ? (
          <button type="button" className="pdf-jpg-drop" disabled={isInspecting} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}>
            <span className="pdf-jpg-file-icon" aria-hidden="true">PDF</span>
            <strong>{isInspecting ? progress?.message ?? "Preparing your PDF..." : "Drop your PDF here"}</strong>
            <small>Convert reports, presentations, scans, diagrams, or individual PDF pages.</small>
            <i>Choose PDF</i>
            <em>Up to 100 MB and 300 pages - processed locally</em>
          </button>
        ) : (
          <div className="pdf-jpg-workspace">
            <header className="pdf-jpg-document"><div><span aria-hidden="true">PDF</span><div><h2 id="pdf-jpg-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages - {formatBytes(inspection.byteLength)}</p></div></div><button type="button" onClick={startOver}>Choose another PDF</button></header>
            <div className="pdf-jpg-layout">
              <section className="pdf-jpg-preview" aria-labelledby="pdf-jpg-preview-title">
                <div className="pdf-jpg-section-heading"><div><span>1</span><div><h2 id="pdf-jpg-preview-title">Page preview</h2><p>Tap a page to convert only that page.</p></div></div><strong>{inspection.pageCount} pages</strong></div>
                <div className="pdf-jpg-page-grid">{inspection.pages.map((page, index) => {
                  const isSelected = selectionMode === "all" || (() => { try { return parsePdfPageSelection(pageRange, inspection.pageCount).includes(page.pageIndex); } catch { return false; } })();
                  return <button type="button" key={page.pageIndex} className={isSelected ? "is-selected" : ""} aria-pressed={isSelected} onClick={() => selectSinglePage(page.pageIndex)}><span><img src={thumbnailUrls[index]} alt={`Preview of page ${index + 1}`} /><i aria-hidden="true">{isSelected ? "\u2713" : ""}</i></span><strong>Page {index + 1}</strong><small>{Math.round(page.width)} × {Math.round(page.height)} pt</small></button>;
                })}</div>
              </section>

              <aside className="pdf-jpg-settings" aria-labelledby="pdf-jpg-settings-title">
                <div className="pdf-jpg-section-heading"><div><span>2</span><div><h2 id="pdf-jpg-settings-title">Export settings</h2><p>Choose pages and image quality.</p></div></div></div>
                <fieldset className="pdf-jpg-page-choice"><legend>Pages to convert</legend><label><input type="radio" name="jpg-pages" checked={selectionMode === "all"} onChange={() => { setSelectionMode("all"); setError(null); clearDownload(); }} /><span><b>All pages</b><small>{inspection.pageCount} JPG images</small></span></label><label><input type="radio" name="jpg-pages" checked={selectionMode === "custom"} onChange={() => { setSelectionMode("custom"); setPageRange(pageRange || "1"); setError(null); clearDownload(); }} /><span><b>Custom pages</b><small>Examples: 1, 3-5, 8</small></span></label></fieldset>
                {selectionMode === "custom" ? <label className="pdf-jpg-range"><span>Page numbers</span><input aria-label="Pages to convert" value={pageRange} onChange={(event) => { setPageRange(event.target.value); setError(null); clearDownload(); }} placeholder="1, 3-5, 8" inputMode="numeric" /></label> : null}
                <fieldset className="pdf-jpg-quality"><legend>JPG quality</legend>{PDF_TO_JPG_PRESETS.map((preset) => <button type="button" key={preset.quality} aria-pressed={quality === preset.quality} className={quality === preset.quality ? "is-selected" : ""} onClick={() => { setQuality(preset.quality); clearDownload(); }}><span><b>{preset.label}</b>{preset.quality === "balanced" ? <i>Recommended</i> : null}</span><small>{preset.description}</small><em aria-hidden="true">{quality === preset.quality ? "\u2713" : ""}</em></button>)}</fieldset>
                <div className="pdf-jpg-summary"><span><small>Selected</small><strong>{selectedCount || "—"}</strong></span><span><small>Format</small><strong>JPG</strong></span><span><small>Delivery</small><strong>{selectedCount === 1 ? "Image" : "ZIP"}</strong></span></div>
                <p className="pdf-jpg-note"><strong>Image output</strong>Each selected page becomes a flat JPG image. Selectable text, links, forms, layers, and signatures are not included as interactive PDF features.</p>
                <button type="button" className="pdf-jpg-primary" disabled={isConverting || selectedCount === 0} onClick={() => void convertPdf()}>{isConverting ? progress?.message ?? "Converting pages..." : `Convert ${selectedCount || "selected"} page${selectedCount === 1 ? "" : "s"} to JPG`}</button>
                {isConverting ? <button type="button" className="pdf-jpg-cancel" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
              </aside>
            </div>
          </div>
        )}

        {error !== null ? <p className="pdf-jpg-error" role="alert">{error}</p> : null}
        {download !== null ? <section className="pdf-jpg-result" aria-labelledby="pdf-jpg-result-title"><span aria-hidden="true">&#10003;</span><div><h2 id="pdf-jpg-result-title">{download.imageCount === 1 ? "Your JPG image is ready" : `${download.imageCount} JPG images are ready`}</h2><p>{download.isZip ? "Images are packaged in one ZIP file" : "Single page exported as JPG"} - {formatBytes(download.outputBytes)}</p></div><a href={download.url} download={download.downloadName}>{download.isZip ? "Download JPG ZIP" : "Download JPG"}</a></section> : null}
      </section>

      <section className="pdf-jpg-benefits" aria-label="PDF to JPG benefits"><article><span aria-hidden="true">JPG</span><div><h2>Choose exactly which pages</h2><p>Export the complete document or enter a custom page range.</p></div></article><article><span aria-hidden="true">&#128274;</span><div><h2>Private browser conversion</h2><p>Rendering and image creation happen locally on your device.</p></div></article><article><span aria-hidden="true">ZIP</span><div><h2>Simple multi-page download</h2><p>Multiple page images arrive together in one ZIP archive.</p></div></article></section>

      <section className="pdf-jpg-copy">
        <h2>How to convert a PDF to JPG</h2><ol><li>Choose a PDF from your device.</li><li>Select every page or enter individual page numbers and ranges.</li><li>Choose Web, Balanced, or High JPG quality.</li><li>Download one JPG or a ZIP containing multiple page images.</li></ol>
        <h2>Private browser-local PDF conversion</h2><p>PDFMech renders the selected pages and creates JPG images inside your browser. Your source PDF and generated images are not sent to a conversion server.</p>
        <h2>Page selection and JPG quality</h2><p>Use custom ranges when you only need certain pages. Balanced works well for most documents, Web produces smaller files, and High preserves more page detail.</p>
        <h2>What changes when PDF pages become images</h2><p>JPG preserves the visible appearance as a flat image. Selectable text, links, forms, layers, accessibility structure, and digital signatures do not remain interactive.</p>
        <h2>PDF to JPG FAQ</h2><h3>Does PDFMech upload my PDF?</h3><p>No. PDF rendering, JPG creation, and ZIP packaging happen locally in your browser.</p><h3>Can I convert only one PDF page?</h3><p>Yes. Choose Custom pages, enter one page number, or tap a page preview. A single selection downloads directly as a JPG.</p><h3>Why do multiple pages download as a ZIP?</h3><p>A ZIP keeps all selected JPG images together and avoids triggering a separate browser download for every page.</p><h3>Which JPG quality should I choose?</h3><p>Balanced is recommended for most documents. Choose Web for smaller images or High when fine text and graphics need more detail.</p>
        <nav className="pdf-jpg-related" aria-label="Related PDF tools"><strong>Related tools</strong><a href="/compress-pdf">Compress PDF</a><a href="/extract-pdf-pages">Extract PDF Pages</a><a href="/ocr-pdf">OCR PDF</a><a href="/tools">All PDF tools</a></nav>
      </section>
    </main>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "The PDF could not be converted to JPG. Please try another file.";
}
