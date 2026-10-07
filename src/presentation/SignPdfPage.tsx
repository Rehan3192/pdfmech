import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type PointerEvent } from "react";

import { clampSignaturePlacement, signatureHeightRatio, type SignaturePlacement } from "../domain/sign-pdf";
import { createLazyPdfSigner } from "../infrastructure/pdflib/lazy-pdf-signer";
import type { SignPdfInspection, SignPdfProgress, SignPdfResult } from "../ports/sign-pdf";

const processor = createLazyPdfSigner();
interface SignatureAsset { readonly blob: Blob; readonly url: string; readonly aspectRatio: number; }
interface SignDownload extends SignPdfResult { readonly url: string; }
interface DragState { readonly id: string; readonly pointerX: number; readonly pointerY: number; readonly x: number; readonly y: number; }

export function SignPdfPage() {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const thumbnailsRef = useRef<readonly string[]>([]);
  const signatureRef = useRef<SignatureAsset | null>(null);
  const downloadRef = useRef<SignDownload | null>(null);
  const placementIdRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<SignPdfInspection | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<readonly string[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [mode, setMode] = useState<"draw" | "type" | "upload">("draw");
  const [typedName, setTypedName] = useState("");
  const [inkColor, setInkColor] = useState("#10283d");
  const [signature, setSignature] = useState<SignatureAsset | null>(null);
  const [hasDrawnInk, setHasDrawnInk] = useState(false);
  const [placements, setPlacements] = useState<readonly SignaturePlacement[]>([]);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SignPdfProgress | null>(null);
  const [download, setDownload] = useState<SignDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { thumbnailsRef.current = thumbnailUrls; }, [thumbnailUrls]);
  useEffect(() => { signatureRef.current = signature; }, [signature]);
  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => { abortRef.current?.abort(); thumbnailsRef.current.forEach(URL.revokeObjectURL); if (signatureRef.current !== null) URL.revokeObjectURL(signatureRef.current.url); if (downloadRef.current !== null) URL.revokeObjectURL(downloadRef.current.url); }, []);
  useEffect(() => { if (mode === "draw") clearDrawing(); }, [inkColor, inspection, mode]);

  function clearDownload(): void { setDownload((current) => { if (current !== null) URL.revokeObjectURL(current.url); return null; }); }
  function clearThumbnails(): void { setThumbnailUrls((current) => { current.forEach(URL.revokeObjectURL); return []; }); }
  function updateWork(action: () => void): void { action(); clearDownload(); setError(null); }

  async function choosePdf(selected: File | null): Promise<void> {
    if (selected === null) return;
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller;
    clearDownload(); clearThumbnails(); setFile(null); setInspection(null); setPlacements([]); setActivePage(0); setError(null); setIsInspecting(true);
    try { const next = await processor.inspect(selected, setProgress, controller.signal); setFile(selected); setInspection(next); setThumbnailUrls(next.pages.map((page) => URL.createObjectURL(page.thumbnail))); }
    catch (reason) { if (!(reason instanceof Error && reason.name === "AbortError")) setError(errorMessage(reason)); }
    finally { setProgress(null); setIsInspecting(false); if (pdfInputRef.current !== null) pdfInputRef.current.value = ""; }
  }

  function replaceSignature(blob: Blob, aspectRatio: number): void {
    const next = { blob, aspectRatio, url: URL.createObjectURL(blob) };
    setSignature((current) => { if (current !== null) URL.revokeObjectURL(current.url); return next; });
    setPlacements([]); setSelectedPlacementId(null); clearDownload(); setError(null);
  }

  async function createTypedSignature(): Promise<void> {
    const name = typedName.trim();
    if (name.length === 0) { setError("Enter the name or signature text to use."); return; }
    await document.fonts.ready;
    const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 240;
    const context = canvas.getContext("2d"); if (context === null) return;
    context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = inkColor; context.textAlign = "center"; context.textBaseline = "middle"; context.font = 'italic 92px "Playfair Display", serif';
    const measured = context.measureText(name); if (measured.width > 820) context.font = `italic ${Math.max(38, 92 * 820 / measured.width)}px "Playfair Display", serif`;
    context.fillText(name, 450, 118);
    replaceSignature(await canvasBlob(canvas), canvas.width / canvas.height);
  }

  async function uploadSignature(selected: File | null): Promise<void> {
    if (selected === null) return;
    if (!/^image\/(png|jpeg)$/.test(selected.type) || selected.size > 10 * 1024 * 1024) { setError("Choose a PNG or JPG signature image up to 10 MB."); return; }
    try { const dimensions = await imageDimensions(selected); replaceSignature(selected, dimensions.width / dimensions.height); }
    catch { setError("The signature image could not be opened."); }
    finally { if (imageInputRef.current !== null) imageInputRef.current.value = ""; }
  }

  function clearDrawing(): void {
    const canvas = drawCanvasRef.current; if (canvas === null) return;
    canvas.width = 900; canvas.height = 260; const context = canvas.getContext("2d"); context?.clearRect(0, 0, canvas.width, canvas.height); setHasDrawnInk(false);
  }
  function drawPoint(event: PointerEvent<HTMLCanvasElement>, start: boolean): void {
    const canvas = event.currentTarget; const context = canvas.getContext("2d"); if (context === null) return;
    const rect = canvas.getBoundingClientRect(); const x = (event.clientX - rect.left) * canvas.width / rect.width; const y = (event.clientY - rect.top) * canvas.height / rect.height;
    context.strokeStyle = inkColor; context.lineWidth = 7; context.lineCap = "round"; context.lineJoin = "round";
    if (start) { context.beginPath(); context.moveTo(x, y); } else { context.lineTo(x, y); context.stroke(); }
  }
  function beginDraw(event: PointerEvent<HTMLCanvasElement>): void { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drawingRef.current = true; drawPoint(event, true); }
  function continueDraw(event: PointerEvent<HTMLCanvasElement>): void { if (!drawingRef.current) return; event.preventDefault(); drawPoint(event, false); setHasDrawnInk(true); }
  function finishDraw(): void { drawingRef.current = false; }
  async function useDrawing(): Promise<void> { const canvas = drawCanvasRef.current; if (canvas === null || !hasDrawnInk) { setError("Draw your signature in the box first."); return; } replaceSignature(await canvasBlob(canvas), canvas.width / canvas.height); }

  function addPlacement(): void {
    if (signature === null || inspection === null) { setError("Create or upload a signature first."); return; }
    const page = inspection.pages[activePage]!; const width = .34; const height = signatureHeightRatio(width, signature.aspectRatio, page.width, page.height);
    const placement = clampSignaturePlacement({ id: `signature-${++placementIdRef.current}`, pageIndex: activePage, x: .5 - width / 2, y: .5 - height / 2, width }, signature.aspectRatio, page.width, page.height);
    updateWork(() => { setPlacements((current) => [...current, placement]); setSelectedPlacementId(placement.id); });
  }
  function removePlacement(id: string): void { updateWork(() => { setPlacements((current) => current.filter((item) => item.id !== id)); setSelectedPlacementId((current) => current === id ? null : current); }); }
  function beginMove(event: PointerEvent<HTMLDivElement>, placement: SignaturePlacement): void { if ((event.target as HTMLElement).closest("button") !== null) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { id: placement.id, pointerX: event.clientX, pointerY: event.clientY, x: placement.x, y: placement.y }; setSelectedPlacementId(placement.id); }
  function movePlacement(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current; const stage = event.currentTarget.parentElement; if (drag === null || stage === null || inspection === null || signature === null) return;
    event.preventDefault(); const rect = stage.getBoundingClientRect(); const page = inspection.pages[activePage]!;
    setPlacements((current) => current.map((item) => item.id !== drag.id ? item : clampSignaturePlacement({ ...item, x: drag.x + (event.clientX - drag.pointerX) / rect.width, y: drag.y + (event.clientY - drag.pointerY) / rect.height }, signature.aspectRatio, page.width, page.height)));
    clearDownload();
  }
  function resizeSelected(width: number): void {
    if (inspection === null || signature === null) return; const page = inspection.pages[activePage]!;
    updateWork(() => setPlacements((current) => current.map((item) => item.id !== selectedPlacementId ? item : clampSignaturePlacement({ ...item, width }, signature.aspectRatio, page.width, page.height))));
  }

  async function signPdf(): Promise<void> {
    if (file === null || signature === null || inspection === null) return;
    const controller = new AbortController(); abortRef.current = controller; clearDownload(); setError(null); setIsSigning(true);
    try { const result = await processor.sign(file, signature.blob, signature.aspectRatio, placements, setProgress, controller.signal); setDownload({ ...result, url: URL.createObjectURL(result.blob) }); }
    catch (reason) { if (!(reason instanceof Error && reason.name === "AbortError")) setError(errorMessage(reason)); }
    finally { setProgress(null); setIsSigning(false); }
  }
  function startOver(): void { abortRef.current?.abort(); clearDownload(); clearThumbnails(); setFile(null); setInspection(null); setPlacements([]); setError(null); setProgress(null); }

  const pagePlacements = placements.filter((item) => item.pageIndex === activePage);
  const selectedPlacement = placements.find((item) => item.id === selectedPlacementId) ?? null;
  return <main className="sign-pdf-page">
    <section className="sign-pdf-hero"><span className="hero-kicker">PRIVATE ELECTRONIC SIGNATURE</span><h1>Sign a PDF online for free.</h1><p>Draw, type, or upload your signature, place it on one or more pages, and download a separate signed copy without uploading your document.</p><div><span><b>✓</b> Draw or type</span><span><b>＋</b> Multiple pages</span><span><b>⚡</b> No upload</span></div></section>
    <section className="sign-pdf-tool" id="sign-pdf-tool">
      <div className="sign-pdf-steps"><span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "✓"}</b><i>Choose PDF</i></span><span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "✓"}</b><i>Add signatures</i></span><span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span></div>
      <input ref={pdfInputRef} className="sign-hidden-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void choosePdf(event.target.files?.[0] ?? null)} />
      {inspection === null ? <button type="button" className="sign-pdf-drop" disabled={isInspecting} onClick={() => pdfInputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void choosePdf(event.dataTransfer.files[0] ?? null); }}><span>PDF</span><strong>{isInspecting ? progress?.message ?? "Preparing your PDF..." : "Drop your PDF here"}</strong><small>Add a visible electronic signature to contracts, forms, approvals, or letters.</small><i>Choose PDF</i><em>Up to 100 MB and 300 pages · processed locally</em></button> : <div className="sign-workspace">
        <header className="sign-document"><div><span>PDF</span><div><h2>{inspection.fileName}</h2><p>{inspection.pageCount} pages · {formatBytes(inspection.byteLength)}</p></div></div><button type="button" onClick={startOver}>Choose another PDF</button></header>
        <div className="sign-layout">
          <section className="sign-preview"><header><div><strong>Place signatures</strong><span>Drag a signature into position, then adjust its size.</span></div><b>Page {activePage + 1} / {inspection.pageCount}</b></header><div className="sign-stage-wrap"><div className="sign-stage"><img src={thumbnailUrls[activePage]} alt={`Preview of page ${activePage + 1}`} />{pagePlacements.map((placement) => <div key={placement.id} className={`sign-placement${selectedPlacementId === placement.id ? " is-selected" : ""}`} style={placementStyle(placement, signature, inspection.pages[activePage]!)} onPointerDown={(event) => beginMove(event, placement)} onPointerMove={movePlacement} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}><img src={signature?.url} alt="Placed signature" draggable={false} /><button type="button" aria-label={`Remove signature from page ${activePage + 1}`} onClick={() => removePlacement(placement.id)}>×</button></div>)}</div></div><div className="sign-page-strip" aria-label="PDF pages">{inspection.pages.map((page, index) => { const count = placements.filter((item) => item.pageIndex === index).length; return <button type="button" key={page.pageIndex} className={activePage === index ? "is-active" : ""} onClick={() => { setActivePage(index); setSelectedPlacementId(null); }}><span><img src={thumbnailUrls[index]} alt="" />{count > 0 ? <b>{count}</b> : null}</span><small>{index + 1}</small></button>; })}</div></section>
          <aside className="sign-controls"><span className="sign-controls-kicker">CREATE SIGNATURE</span><h2>Your signature</h2><div className="sign-mode-tabs">{(["draw","type","upload"] as const).map((item) => <button type="button" key={item} className={mode === item ? "is-active" : ""} onClick={() => setMode(item)}>{item[0]!.toUpperCase() + item.slice(1)}</button>)}</div>
            {mode === "draw" ? <div className="sign-draw"><canvas ref={drawCanvasRef} aria-label="Draw signature" onPointerDown={beginDraw} onPointerMove={continueDraw} onPointerUp={finishDraw} onPointerCancel={finishDraw} /><div><button type="button" onClick={clearDrawing}>Clear</button><button type="button" disabled={!hasDrawnInk} onClick={() => void useDrawing()}>Use drawing</button></div></div> : null}
            {mode === "type" ? <div className="sign-type"><label><span>Signature text</span><input aria-label="Signature text" value={typedName} maxLength={60} onChange={(event) => setTypedName(event.target.value)} placeholder="Your name" /></label><div className="sign-type-preview" style={{ color: inkColor }}>{typedName || "Your signature"}</div><button type="button" onClick={() => void createTypedSignature()}>Use typed signature</button></div> : null}
            {mode === "upload" ? <div className="sign-upload"><input ref={imageInputRef} className="sign-hidden-input" type="file" accept="image/png,image/jpeg" onChange={(event) => void uploadSignature(event.target.files?.[0] ?? null)} /><button type="button" onClick={() => imageInputRef.current?.click()}>Choose PNG or JPG</button><p>For the cleanest result, use a transparent PNG containing only your signature.</p></div> : null}
            <label className="sign-color"><span>Ink color</span><input type="color" aria-label="Signature ink color" value={inkColor} onChange={(event) => setInkColor(event.target.value)} /><code>{inkColor.toUpperCase()}</code></label>
            {signature !== null ? <div className="sign-ready"><span>Current signature</span><div><img src={signature.url} alt="Current signature preview" /></div><button type="button" onClick={addPlacement}>+ Add to page {activePage + 1}</button></div> : <p className="sign-empty">Draw, type, or upload a signature to continue.</p>}
            {selectedPlacement !== null && selectedPlacement.pageIndex === activePage ? <label className="sign-size"><span>Selected signature size <b>{Math.round(selectedPlacement.width * 100)}%</b></span><input type="range" aria-label="Selected signature size" min="10" max="65" value={Math.round(selectedPlacement.width * 100)} onChange={(event) => resizeSelected(Number(event.target.value) / 100)} /></label> : null}
            <div className="sign-summary"><span><strong>{placements.length}</strong>Signatures</span><span><strong>{new Set(placements.map((item) => item.pageIndex)).size}</strong>Pages signed</span></div>{inspection.hasSignatures ? <p className="sign-warning"><strong>Existing digital signature detected.</strong> Modifying this PDF will invalidate its current certificate signature.</p> : null}<p className="sign-disclaimer"><strong>Electronic signature only</strong>This adds a visible signature image. It does not create a certificate-based cryptographic digital signature.</p><button type="button" className="sign-primary" disabled={isSigning || placements.length === 0} onClick={() => void signPdf()}>{isSigning ? progress?.message ?? "Signing PDF..." : `Sign PDF with ${placements.length || ""} signature${placements.length === 1 ? "" : "s"}`}</button>{isSigning ? <button type="button" className="sign-cancel" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
          </aside>
        </div>
      </div>}
      {error !== null ? <p className="sign-error" role="alert">{error}</p> : null}
      {download !== null ? <section className="sign-result"><span>✓</span><div><h2>Your signed PDF is ready</h2><p>{download.signatureCount} visible signature{download.signatureCount === 1 ? "" : "s"} added. Your original PDF is unchanged.</p></div><a href={download.url} download={download.downloadName}>Download signed PDF</a></section> : null}
    </section>
    <section className="sign-benefits"><article><span>✍</span><div><h2>Draw, type, or upload</h2><p>Create a signature with touch or mouse, type your name, or use an existing image.</p></div></article><article><span>↔</span><div><h2>Place it precisely</h2><p>Add signatures to multiple pages, drag them into position, and control their size.</p></div></article><article><span>🔒</span><div><h2>Private local processing</h2><p>Your PDF and signature are processed in your browser and are not uploaded.</p></div></article></section>
    <section className="sign-copy"><h2>How to sign a PDF online</h2><ol><li>Choose a PDF from your device.</li><li>Draw, type, or upload your electronic signature.</li><li>Add the signature to a page, drag it into position, and adjust its size.</li><li>Add more placements if needed, then create and download the signed copy.</li></ol><h2>Draw, type, or upload an electronic signature</h2><p>Use your mouse, trackpad, or touchscreen to draw. You can also render typed signature text or upload a PNG or JPG signature image.</p><h2>Private browser-local PDF signing</h2><p>PDFMech prepares page previews, embeds the signature, validates the output, and creates the download in your browser. The PDF and signature are not sent to a signing server.</p><h2>Electronic signatures and digital signatures are different</h2><p>This tool adds a visible electronic signature image. It does not verify identity, create a certificate, add a trusted timestamp, or produce a certificate-based cryptographic digital signature.</p><h2>Sign PDF FAQ</h2><h3>Does PDFMech upload my PDF or signature?</h3><p>No. Previewing, signature creation, placement, PDF generation, validation, and download happen locally in your browser.</p><h3>Can I sign more than one page?</h3><p>Yes. Open each page, add the current signature, and place it wherever required before creating the signed PDF.</p><h3>Can I move and resize my signature?</h3><p>Yes. Drag a placed signature directly on the page and use the size control for the selected placement.</p><h3>Is this a certificate-based digital signature?</h3><p>No. It is a visible electronic signature. It does not include identity validation, a digital certificate, or cryptographic verification.</p><nav className="sign-related"><strong>Related tools</strong><a href="/flatten-pdf">Flatten PDF forms</a><a href="/protect-pdf">Protect PDF</a><a href="/watermark-pdf">Watermark PDF</a><a href="/tools">All PDF tools</a></nav></section>
  </main>;
}

function placementStyle(placement: SignaturePlacement, signature: SignatureAsset | null, page: SignPdfInspection["pages"][number]): CSSProperties {
  const height = signature === null ? 0 : signatureHeightRatio(placement.width, signature.aspectRatio, page.width, page.height);
  return { left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, width: `${placement.width * 100}%`, height: `${height * 100}%` };
}
function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> { return new Promise((resolve, reject) => canvas.toBlob((blob) => blob === null ? reject(new Error("The signature could not be created.")) : resolve(blob), "image/png")); }
function imageDimensions(blob: Blob): Promise<{ width: number; height: number }> { return new Promise((resolve, reject) => { const url = URL.createObjectURL(blob); const image = new Image(); image.onload = () => { URL.revokeObjectURL(url); image.naturalWidth > 0 && image.naturalHeight > 0 ? resolve({ width: image.naturalWidth, height: image.naturalHeight }) : reject(new Error()); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error()); }; image.src = url; }); }
function formatBytes(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function errorMessage(reason: unknown): string { return reason instanceof Error ? reason.message : "The PDF could not be signed. Please try another file."; }
