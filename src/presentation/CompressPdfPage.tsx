import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { PDF_COMPRESSION_PRESETS, type PdfCompressionLevel } from "../domain/compress-pdf";
import { createLazyPdfCompressor } from "../infrastructure/pdflib/lazy-pdf-compressor";
import type { CompressPdfInspection, CompressPdfProgress, CompressPdfResult } from "../ports/compress-pdf";

const processor = createLazyPdfCompressor();

interface CompressionDownload extends CompressPdfResult {
  readonly url: string;
}

export function CompressPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const thumbnailUrlsRef = useRef<readonly string[]>([]);
  const downloadRef = useRef<CompressionDownload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<CompressPdfInspection | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<readonly string[]>([]);
  const [level, setLevel] = useState<PdfCompressionLevel>("balanced");
  const [progress, setProgress] = useState<CompressPdfProgress | null>(null);
  const [download, setDownload] = useState<CompressionDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
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
    setError(null);
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

  async function compressPdf(): Promise<void> {
    if (file === null || inspection === null) return;
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsCompressing(true);
    try {
      const result = await processor.compress(file, level, setProgress, controller.signal);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (compressError) {
      if (!(compressError instanceof Error && compressError.name === "AbortError")) setError(messageFromError(compressError));
    } finally {
      setProgress(null);
      setIsCompressing(false);
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

  return (
    <main className="compress-pdf-page">
      <section className="compress-pdf-hero">
        <span className="hero-kicker">PRIVATE PDF COMPRESSOR</span>
        <h1>Compress PDF files online for free.</h1>
        <p>Reduce image-heavy and scanned PDF file sizes directly in your browser. Your document never leaves your device.</p>
        <div className="compress-pdf-trust" aria-label="Compression tool benefits"><span><b aria-hidden="true">&#10003;</b> Free</span><span><b aria-hidden="true">&#9889;</b> No upload</span><span><b aria-hidden="true">3</b> Quality levels</span></div>
      </section>

      <section className="compress-pdf-tool" id="compress-pdf-tool" aria-labelledby="compress-pdf-tool-title">
        <div className="compress-pdf-steps" aria-label="Compress PDF workflow">
          <span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "\u2713"}</b><i>Choose PDF</i></span>
          <span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "\u2713"}</b><i>Choose quality</i></span>
          <span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span>
        </div>
        <input ref={inputRef} className="compress-pdf-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />

        {inspection === null ? (
          <button type="button" className="compress-pdf-drop" disabled={isInspecting} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}>
            <span className="compress-pdf-file-icon" aria-hidden="true">PDF</span>
            <strong>{isInspecting ? progress?.message ?? "Preparing your PDF..." : "Drop your PDF here"}</strong>
            <small>Best for scans, photos, receipts, presentations, and image-heavy documents.</small>
            <i>Choose PDF</i>
            <em>Up to 100 MB and 300 pages - processed locally</em>
          </button>
        ) : (
          <div className="compress-pdf-workspace">
            <header className="compress-pdf-document"><div><span aria-hidden="true">PDF</span><div><h2 id="compress-pdf-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages - {formatBytes(inspection.byteLength)}</p></div></div><button type="button" onClick={startOver}>Choose another PDF</button></header>
            <div className="compress-pdf-layout">
              <section className="compress-pdf-preview" aria-labelledby="compress-preview-title">
                <div className="compress-pdf-heading"><div><span>1</span><div><h2 id="compress-preview-title">Document preview</h2><p>Check the pages before creating a smaller copy.</p></div></div><strong>{inspection.pageCount} pages</strong></div>
                <div className="compress-pdf-page-grid">{inspection.pages.map((page, index) => <figure key={page.pageIndex}><div><img src={thumbnailUrls[index]} alt={`Preview of page ${index + 1}`} /></div><figcaption>Page {index + 1}</figcaption></figure>)}</div>
              </section>
              <aside className="compress-pdf-settings" aria-labelledby="compress-settings-title">
                <div className="compress-pdf-heading"><div><span>2</span><div><h2 id="compress-settings-title">Compression quality</h2><p>Balance page sharpness and file size.</p></div></div></div>
                <div className="compress-pdf-levels">
                  {PDF_COMPRESSION_PRESETS.map((preset) => <button type="button" key={preset.level} className={level === preset.level ? "is-selected" : ""} aria-pressed={level === preset.level} onClick={() => { setLevel(preset.level); clearDownload(); }}><span><b>{preset.label}</b>{preset.level === "balanced" ? <i>Recommended</i> : null}</span><small>{preset.description}</small><em aria-hidden="true">{level === preset.level ? "\u2713" : ""}</em></button>)}
                </div>
                <div className="compress-pdf-summary"><span><small>Original size</small><strong>{formatBytes(inspection.byteLength)}</strong></span><span><small>Pages</small><strong>{inspection.pageCount}</strong></span><span><small>Preset</small><strong>{PDF_COMPRESSION_PRESETS.find((preset) => preset.level === level)?.label}</strong></span></div>
                <p className="compress-pdf-warning"><strong>Important output change</strong>Compression rebuilds each page as an image. Selectable text, forms, links, layers, attachments, and digital signatures will not remain interactive.</p>
                {inspection.hasSignatures ? <p className="compress-pdf-signature"><strong>Signed document detected.</strong> The compressed copy cannot preserve valid digital signatures.</p> : null}
                <p className="compress-pdf-safety"><strong>No accidental size increase</strong>If this preset cannot create a smaller file, PDFMech keeps the original bytes instead.</p>
                <button type="button" className="compress-pdf-primary" disabled={isCompressing} onClick={() => void compressPdf()}>{isCompressing ? progress?.message ?? "Compressing PDF..." : "Compress PDF"}</button>
                {isCompressing ? <button type="button" className="compress-pdf-cancel" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
              </aside>
            </div>
          </div>
        )}

        {error !== null ? <p className="compress-pdf-error" role="alert">{error}</p> : null}
        {download !== null ? (
          <section className={`compress-pdf-result ${download.wasReduced ? "is-reduced" : "is-unchanged"}`} aria-labelledby="compress-result-title">
            <span className="compress-pdf-result-icon" aria-hidden="true">{download.wasReduced ? "\u2713" : "i"}</span>
            <div><h2 id="compress-result-title">{download.wasReduced ? `PDF compressed by ${download.reductionPercent}%` : "This PDF is already efficient at this setting"}</h2><p>{formatBytes(download.sourceBytes)} <b aria-hidden="true">&#8594;</b> {formatBytes(download.outputBytes)}{download.wasReduced ? ` - ${formatBytes(download.sourceBytes - download.outputBytes)} saved` : ". No larger replacement was created."}</p></div>
            <a href={download.url} download={download.downloadName}>Download PDF</a>
            {!download.wasReduced && level !== "strong" ? <button type="button" onClick={() => { setLevel("strong"); clearDownload(); }}>Try Strong compression</button> : null}
          </section>
        ) : null}
      </section>

      <section className="compress-pdf-benefits" aria-label="Compress PDF benefits"><article><span aria-hidden="true">%</span><div><h2>Three compression levels</h2><p>Choose sharper output or prioritize the smallest practical file.</p></div></article><article><span aria-hidden="true">&#128274;</span><div><h2>Private browser processing</h2><p>Rendering, rebuilding, validation, and download happen on your device.</p></div></article><article><span aria-hidden="true">PDF</span><div><h2>Useful for scanned documents</h2><p>Reduce large photo and scan data while preserving the visible pages.</p></div></article></section>

      <section className="compress-pdf-copy">
        <h2>How to compress a PDF online</h2><ol><li>Choose a PDF from your device.</li><li>Review its pages and original file size.</li><li>Select Light, Balanced, or Strong compression.</li><li>Download the smaller PDF created in your browser.</li></ol>
        <h2>Private local PDF compression</h2><p>PDFMech renders and rebuilds the document inside your browser. The source PDF is not uploaded to a remote compression service.</p>
        <h2>Best for scanned and image-heavy PDFs</h2><p>Raster compression is most effective when a PDF contains scans, photographs, screenshots, or presentation graphics. A compact text-only PDF may already be smaller than a rasterized copy.</p>
        <h2>Raster compression limits</h2><p>The compressed copy preserves visible pages but does not preserve selectable text, live forms, links, layers, attachments, or valid digital signatures. Keep the original when those features matter.</p>
        <h2>Compress PDF FAQ</h2><h3>Does PDFMech upload my PDF?</h3><p>No. Previewing, compression, validation, and download happen locally in your browser.</p><h3>Which compression level should I choose?</h3><p>Balanced is recommended for most sharing and email tasks. Choose Light for sharper detail or Strong for a smaller file.</p><h3>Why did my PDF not become smaller?</h3><p>Text-only and already-optimized PDFs can be more efficient than rasterized pages. PDFMech keeps the original bytes when the generated copy would be larger.</p><h3>Will text remain selectable?</h3><p>No. This compressor rebuilds visible pages as images. Use the original file when selectable text, links, forms, or accessibility structure must remain available.</p>
        <nav className="compress-pdf-related" aria-label="Related PDF tools"><strong>Related tools</strong><a href="/ocr-pdf">OCR PDF</a><a href="/deskew-pdf">Deskew PDF</a><a href="/split-pdf">Split PDF</a><a href="/merge-pdf">Merge PDF</a></nav>
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
  return error instanceof Error ? error.message : "The PDF could not be compressed. Please try another file.";
}
