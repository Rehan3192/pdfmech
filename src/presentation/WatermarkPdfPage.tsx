import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent } from "react";

import { parseWatermarkPages, validateWatermarkText, type WatermarkPosition, type WatermarkRotation } from "../domain/watermark-pdf";
import { createLazyPdfWatermarker } from "../infrastructure/pdflib/lazy-pdf-watermarker";
import type { WatermarkInspection, WatermarkProgress, WatermarkResult } from "../ports/watermark-pdf";

const processor = createLazyPdfWatermarker();
interface WatermarkDownload extends WatermarkResult { readonly url: string; }
const positions: readonly { readonly value: WatermarkPosition; readonly label: string }[] = [
  { value: "top-left", label: "Top left" }, { value: "top-right", label: "Top right" }, { value: "center", label: "Center" }, { value: "bottom-left", label: "Bottom left" }, { value: "bottom-right", label: "Bottom right" },
];

export function WatermarkPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const thumbnailUrlsRef = useRef<readonly string[]>([]);
  const downloadRef = useRef<WatermarkDownload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<WatermarkInspection | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<readonly string[]>([]);
  const [previewPage, setPreviewPage] = useState(0);
  const [text, setText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState(54);
  const [color, setColor] = useState("#e23b3b");
  const [opacity, setOpacity] = useState(.28);
  const [rotation, setRotation] = useState<WatermarkRotation>(-45);
  const [position, setPosition] = useState<WatermarkPosition>("center");
  const [pageMode, setPageMode] = useState<"all" | "custom">("all");
  const [pageRange, setPageRange] = useState("");
  const [progress, setProgress] = useState<WatermarkProgress | null>(null);
  const [download, setDownload] = useState<WatermarkDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { thumbnailUrlsRef.current = thumbnailUrls; }, [thumbnailUrls]);
  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => { abortRef.current?.abort(); thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)); if (downloadRef.current !== null) URL.revokeObjectURL(downloadRef.current.url); }, []);

  function clearDownload(): void { setDownload((current) => { if (current !== null) URL.revokeObjectURL(current.url); return null; }); }
  function clearThumbnails(): void { setThumbnailUrls((current) => { current.forEach((url) => URL.revokeObjectURL(url)); return []; }); }
  function updateSetting(action: () => void): void { action(); setError(null); clearDownload(); }

  async function chooseFile(selected: File | null): Promise<void> {
    if (selected === null) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload(); clearThumbnails(); setFile(null); setInspection(null); setPreviewPage(0); setPageMode("all"); setPageRange(""); setError(null); setIsInspecting(true);
    try {
      const next = await processor.inspect(selected, setProgress, controller.signal);
      setFile(selected); setInspection(next); setThumbnailUrls(next.pages.map((page) => URL.createObjectURL(page.thumbnail)));
    } catch (inspectError) { if (!(inspectError instanceof Error && inspectError.name === "AbortError")) setError(messageFromError(inspectError)); }
    finally { setProgress(null); setIsInspecting(false); if (inputRef.current !== null) inputRef.current.value = ""; }
  }

  function selectedPages(): readonly number[] {
    if (inspection === null) return [];
    return pageMode === "all" ? Array.from({ length: inspection.pageCount }, (_, index) => index) : parseWatermarkPages(pageRange, inspection.pageCount);
  }

  async function applyWatermark(): Promise<void> {
    if (file === null || inspection === null) return;
    let pageIndexes: readonly number[];
    try { validateWatermarkText(text); pageIndexes = selectedPages(); }
    catch (validationError) { setError(messageFromError(validationError)); return; }
    const controller = new AbortController(); abortRef.current = controller; clearDownload(); setError(null); setIsApplying(true);
    try {
      const result = await processor.apply(file, { text, fontSize, color, opacity, rotation, position, pageIndexes }, setProgress, controller.signal);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (applyError) { if (!(applyError instanceof Error && applyError.name === "AbortError")) setError(messageFromError(applyError)); }
    finally { setProgress(null); setIsApplying(false); }
  }

  function startOver(): void { abortRef.current?.abort(); clearDownload(); clearThumbnails(); setFile(null); setInspection(null); setError(null); setProgress(null); }

  let selectedPageIndexes: readonly number[] = inspection === null ? [] : Array.from({ length: inspection.pageCount }, (_, index) => index);
  if (inspection !== null && pageMode === "custom") { try { selectedPageIndexes = parseWatermarkPages(pageRange, inspection.pageCount); } catch { selectedPageIndexes = []; } }
  const selectedCount = selectedPageIndexes.length;
  const previewPageSelected = selectedPageIndexes.includes(previewPage);
  const previewStyle = { "--watermark-color": color, "--watermark-opacity": opacity, "--watermark-rotation": `${rotation}deg`, "--watermark-size": `${Math.max(13, Math.min(34, fontSize * .28))}px` } as CSSProperties;

  return (
    <main className="watermark-page">
      <section className="watermark-hero"><span className="hero-kicker">PRIVATE PDF WATERMARK TOOL</span><h1>Add a watermark to a PDF online.</h1><p>Place custom text on every page or a selected range, adjust its style and position, and download a separate PDF without uploading your document.</p><div className="watermark-trust"><span><b aria-hidden="true">&#10003;</b> Free</span><span><b aria-hidden="true">T</b> Custom text</span><span><b aria-hidden="true">&#9889;</b> No upload</span></div></section>
      <section className="watermark-tool" id="watermark-pdf-tool" aria-labelledby="watermark-tool-title">
        <div className="watermark-steps"><span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "\u2713"}</b><i>Choose PDF</i></span><span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "\u2713"}</b><i>Design watermark</i></span><span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span></div>
        <input ref={inputRef} className="watermark-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />
        {inspection === null ? <button type="button" className="watermark-drop" disabled={isInspecting} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}><span aria-hidden="true">PDF</span><strong>{isInspecting ? progress?.message ?? "Preparing your PDF..." : "Drop your PDF here"}</strong><small>Add a visible text watermark to reports, drafts, contracts, or shared copies.</small><i>Choose PDF</i><em>Up to 100 MB and 300 pages - processed locally</em></button> : (
          <div className="watermark-workspace"><header className="watermark-document"><div><span aria-hidden="true">PDF</span><div><h2 id="watermark-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages - {formatBytes(inspection.byteLength)}</p></div></div><button type="button" onClick={startOver}>Choose another PDF</button></header><div className="watermark-layout">
            <section className="watermark-preview-panel"><div className="watermark-heading"><div><span>1</span><div><h2>Preview watermark</h2><p>Review placement on any document page.</p></div></div><strong>Page {previewPage + 1} · {previewPageSelected ? "Watermarked" : "Not selected"}</strong></div><div className="watermark-preview-stage"><div className="watermark-paper"><img src={thumbnailUrls[previewPage]} alt={`Preview of page ${previewPage + 1}`} />{previewPageSelected ? <span className={`is-${position}`} style={previewStyle}>{text.trim() || "WATERMARK"}</span> : null}</div></div><div className="watermark-thumbnails" aria-label="Choose preview page">{inspection.pages.map((page, index) => <button type="button" key={page.pageIndex} className={previewPage === index ? "is-selected" : ""} aria-pressed={previewPage === index} aria-label={`Preview page ${index + 1}${selectedPageIndexes.includes(index) ? ", selected for watermark" : ", not selected"}`} onClick={() => setPreviewPage(index)}><img src={thumbnailUrls[index]} alt="" /><span>{index + 1}</span></button>)}</div></section>
            <aside className="watermark-settings"><div className="watermark-heading"><div><span>2</span><div><h2>Watermark settings</h2><p>Customize text, appearance, and pages.</p></div></div></div><label className="watermark-text"><span>Watermark text</span><input value={text} maxLength={120} onChange={(event) => updateSetting(() => setText(event.target.value))} /></label><div className="watermark-inline"><label><span>Color</span><div><input type="color" aria-label="Watermark color" value={color} onChange={(event) => updateSetting(() => setColor(event.target.value))} /><code>{color.toUpperCase()}</code></div></label><label><span>Size</span><input type="number" aria-label="Watermark size" min="12" max="144" value={fontSize} onChange={(event) => updateSetting(() => setFontSize(Number(event.target.value)))} /></label></div><label className="watermark-slider"><span>Opacity <b>{Math.round(opacity * 100)}%</b></span><input type="range" aria-label="Watermark opacity" min="5" max="100" value={Math.round(opacity * 100)} onChange={(event) => updateSetting(() => setOpacity(Number(event.target.value) / 100))} /></label>
              <fieldset><legend>Rotation</legend><div className="watermark-choice">{([-45,0,45] as const).map((value) => <button type="button" key={value} aria-pressed={rotation === value} className={rotation === value ? "is-selected" : ""} onClick={() => updateSetting(() => setRotation(value))}>{value > 0 ? "+" : ""}{value}&deg;</button>)}</div></fieldset><fieldset><legend>Position</legend><div className="watermark-position-grid">{positions.map((item) => <button type="button" key={item.value} aria-label={item.label} title={item.label} aria-pressed={position === item.value} className={position === item.value ? "is-selected" : ""} onClick={() => updateSetting(() => setPosition(item.value))}><i aria-hidden="true" /></button>)}</div></fieldset>
              <fieldset className="watermark-pages"><legend>Pages to watermark</legend><label><input type="radio" name="watermark-pages" checked={pageMode === "all"} onChange={() => updateSetting(() => setPageMode("all"))} /><span><b>All pages</b><small>{inspection.pageCount} pages</small></span></label><label><input type="radio" name="watermark-pages" checked={pageMode === "custom"} onChange={() => updateSetting(() => { setPageMode("custom"); setPageRange(pageRange || "1"); })} /><span><b>Custom range</b><small>Example: 1, 3-5</small></span></label></fieldset>{pageMode === "custom" ? <input className="watermark-range" aria-label="Pages to watermark" value={pageRange} onChange={(event) => updateSetting(() => setPageRange(event.target.value))} placeholder="1, 3-5" inputMode="numeric" /> : null}
              {inspection.hasSignatures ? <p className="watermark-warning"><strong>Signed PDF detected</strong>Adding a watermark modifies the document, so existing digital signatures will not remain valid.</p> : null}<div className="watermark-summary"><span><small>Selected</small><strong>{selectedCount || "—"}</strong></span><span><small>Position</small><strong>{positionLabel(position)}</strong></span><span><small>Rotation</small><strong>{rotation}&deg;</strong></span></div><button type="button" className="watermark-primary" disabled={isApplying || selectedCount === 0 || text.trim() === ""} onClick={() => void applyWatermark()}>{isApplying ? progress?.message ?? "Applying watermark..." : `Watermark ${selectedCount || "selected"} page${selectedCount === 1 ? "" : "s"}`}</button>{isApplying ? <button type="button" className="watermark-cancel" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}</aside>
          </div></div>
        )}
        {error !== null ? <p className="watermark-error" role="alert">{error}</p> : null}
        {download !== null ? <section className="watermark-result" aria-labelledby="watermark-result-title"><span aria-hidden="true">&#10003;</span><div><h2 id="watermark-result-title">Your watermarked PDF is ready</h2><p>{download.watermarkedPageCount} of {download.pageCount} pages watermarked. Your original PDF is unchanged.</p></div><a href={download.url} download={download.downloadName}>Download watermarked PDF</a></section> : null}
      </section>
      <section className="watermark-benefits"><article><span aria-hidden="true">T</span><div><h2>Flexible text styling</h2><p>Adjust watermark text, color, size, opacity, angle, and position.</p></div></article><article><span aria-hidden="true">1-5</span><div><h2>Choose specific pages</h2><p>Apply the watermark everywhere or only to a custom page range.</p></div></article><article><span aria-hidden="true">&#128274;</span><div><h2>Private local processing</h2><p>Preview, watermarking, validation, and download happen in your browser.</p></div></article></section>
      <section className="watermark-copy"><h2>How to add a watermark to a PDF</h2><ol><li>Choose a PDF from your device.</li><li>Enter watermark text and adjust its color, size, opacity, rotation, and position.</li><li>Select every page or enter a custom page range.</li><li>Apply the watermark and download the separate PDF created in your browser.</li></ol><h2>Custom text watermark controls</h2><p>Add labels such as Confidential, Draft, Sample, Copy, or a company name. The live preview helps you check placement before modifying the document.</p><h2>Private browser-local PDF watermarking</h2><p>PDFMech previews, modifies, validates, and downloads the PDF locally. The source document and watermark text are not uploaded to a processing server.</p><h2>Watermark scope and document limits</h2><p>The watermark becomes visible page content in the generated copy. It does not provide access control, encryption, redaction, or copy prevention, and modifying a signed PDF invalidates its existing signatures.</p><h2>Watermark PDF FAQ</h2><h3>Does PDFMech upload my PDF?</h3><p>No. Page previews, watermarking, validation, and download happen locally in your browser.</p><h3>Can I watermark only certain pages?</h3><p>Yes. Choose Custom range and enter pages such as 1, 3-5, 8.</p><h3>Can I use a transparent watermark?</h3><p>Yes. Adjust opacity from 5% to 100% and review the result in the live page preview.</p><h3>Does a watermark protect confidential information?</h3><p>No. A watermark is a visible label. Use password protection, secure redaction, and appropriate access controls for sensitive documents.</p><nav className="watermark-related"><strong>Related tools</strong><a href="/protect-pdf">Protect PDF</a><a href="/redact-pdf">Secure Redaction</a><a href="/remove-pdf-metadata">Remove Metadata</a><a href="/tools">All PDF tools</a></nav></section>
    </main>
  );
}

function formatBytes(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function positionLabel(value: WatermarkPosition): string { return positions.find((item) => item.value === value)?.label ?? "Center"; }
function messageFromError(error: unknown): string { return error instanceof Error ? error.message : "The watermark could not be applied. Please try another PDF."; }
