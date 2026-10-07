import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { assessPdfPassword, DEFAULT_PROTECT_PDF_PERMISSIONS, validateProtectPdfPassword, type ProtectPdfPermissions } from "../domain/protect-pdf";
import { createLazyPdfProtector } from "../infrastructure/pdflib/lazy-pdf-protector";
import type { ProtectPdfInspection, ProtectPdfProgress, ProtectPdfResult } from "../ports/protect-pdf";

const processor = createLazyPdfProtector();

interface ProtectPdfDownload extends ProtectPdfResult {
  readonly url: string;
}

export function ProtectPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const downloadRef = useRef<ProtectPdfDownload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<ProtectPdfInspection | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [permissions, setPermissions] = useState<ProtectPdfPermissions>(DEFAULT_PROTECT_PDF_PERMISSIONS);
  const [progress, setProgress] = useState<ProtectPdfProgress | null>(null);
  const [download, setDownload] = useState<ProtectPdfDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProtecting, setIsProtecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assessment = assessPdfPassword(password);

  useEffect(() => { previewUrlRef.current = previewUrl; }, [previewUrl]);
  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => {
    abortRef.current?.abort();
    if (previewUrlRef.current !== null) URL.revokeObjectURL(previewUrlRef.current);
    if (downloadRef.current !== null) URL.revokeObjectURL(downloadRef.current.url);
  }, []);

  function clearPreview(): void {
    setPreviewUrl((current) => {
      if (current !== null) URL.revokeObjectURL(current);
      return null;
    });
  }

  function clearDownload(): void {
    setDownload((current) => {
      if (current !== null) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function chooseFile(selected: File | null): Promise<void> {
    if (selected === null) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    clearPreview();
    clearDownload();
    setFile(null);
    setInspection(null);
    setPassword("");
    setConfirmation("");
    setPermissions(DEFAULT_PROTECT_PDF_PERMISSIONS);
    setError(null);
    setIsInspecting(true);
    try {
      const nextInspection = await processor.inspect(selected, setProgress, controller.signal);
      setFile(selected);
      setInspection(nextInspection);
      setPreviewUrl(URL.createObjectURL(nextInspection.preview));
    } catch (inspectError) {
      if (!(inspectError instanceof Error && inspectError.name === "AbortError")) setError(messageFromError(inspectError));
    } finally {
      setProgress(null);
      setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  async function protectPdf(): Promise<void> {
    if (file === null || inspection === null) return;
    const validationError = validateProtectPdfPassword(password, confirmation);
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsProtecting(true);
    try {
      const result = await processor.protect(file, password, permissions, setProgress, controller.signal);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (protectError) {
      if (!(protectError instanceof Error && protectError.name === "AbortError")) setError(messageFromError(protectError));
    } finally {
      setProgress(null);
      setIsProtecting(false);
    }
  }

  function startOver(): void {
    abortRef.current?.abort();
    clearPreview();
    clearDownload();
    setFile(null);
    setInspection(null);
    setPassword("");
    setConfirmation("");
    setProgress(null);
    setError(null);
  }

  function setPermission(key: keyof ProtectPdfPermissions, value: boolean): void {
    setPermissions((current) => ({ ...current, [key]: value }));
    clearDownload();
  }

  return (
    <main className="protect-pdf-page">
      <section className="protect-pdf-hero">
        <span className="hero-kicker">PRIVATE AES-256 PDF PROTECTION</span>
        <h1>Password protect a PDF online for free.</h1>
        <p>Add an open password to your PDF directly in your browser. The document and password never leave your device.</p>
        <div className="protect-pdf-trust" aria-label="Protect PDF benefits"><span><b aria-hidden="true">&#10003;</b> Free</span><span><b aria-hidden="true">256</b> AES-256</span><span><b aria-hidden="true">&#9889;</b> No upload</span></div>
      </section>

      <section className="protect-pdf-tool" id="protect-pdf-tool" aria-labelledby="protect-pdf-tool-title">
        <div className="protect-pdf-steps" aria-label="Protect PDF workflow">
          <span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "\u2713"}</b><i>Choose PDF</i></span>
          <span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "\u2713"}</b><i>Set password</i></span>
          <span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span>
        </div>
        <input ref={inputRef} className="protect-pdf-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />

        {inspection === null ? (
          <button type="button" className="protect-pdf-drop" disabled={isInspecting} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}>
            <span className="protect-pdf-file-icon" aria-hidden="true"><i>PDF</i><b>&#128274;</b></span>
            <strong>{isInspecting ? progress?.message ?? "Checking your PDF..." : "Drop your PDF here"}</strong>
            <small>Choose an unprotected PDF to encrypt with a password.</small>
            <i>Choose PDF</i>
            <em>Up to 100 MB and 300 pages - processed locally</em>
          </button>
        ) : (
          <div className="protect-pdf-workspace">
            <header className="protect-pdf-document"><div><span aria-hidden="true">PDF</span><div><h2 id="protect-pdf-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages - {formatBytes(inspection.byteLength)}</p></div></div><button type="button" onClick={startOver}>Choose another PDF</button></header>
            <div className="protect-pdf-layout">
              <section className="protect-pdf-preview" aria-labelledby="protect-preview-title">
                <div className="protect-pdf-heading"><span>1</span><div><h2 id="protect-preview-title">Document preview</h2><p>Confirm you selected the correct file.</p></div></div>
                <div className="protect-pdf-preview-frame">{previewUrl !== null ? <img src={previewUrl} alt="Preview of the first PDF page" /> : null}<span>Page 1 of {inspection.pageCount}</span></div>
                <div className="protect-pdf-file-facts"><span><small>Original file</small><strong>{formatBytes(inspection.byteLength)}</strong></span><span><small>Pages</small><strong>{inspection.pageCount}</strong></span><span><small>Output</small><strong>AES-256 PDF</strong></span></div>
                {inspection.hasSignatures ? <p className="protect-pdf-signature"><strong>Signed PDF detected.</strong> Adding encryption changes the document and can invalidate existing digital signatures. Keep the original signed file.</p> : null}
              </section>

              <aside className="protect-pdf-settings" aria-labelledby="protect-settings-title">
                <div className="protect-pdf-heading"><span>2</span><div><h2 id="protect-settings-title">Create an open password</h2><p>This password will be required to view the PDF.</p></div></div>
                <label className="protect-pdf-password"><span>Password</span><div><input aria-label="Password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); clearDownload(); setError(null); }} placeholder="At least 8 characters" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button></div></label>
                <div className="protect-pdf-strength" data-score={assessment.score}><div aria-hidden="true"><i /><i /><i /><i /></div><span>{password === "" ? "Use a long, unique password" : assessment.label}</span></div>
                <label className="protect-pdf-password"><span>Confirm password</span><div><input aria-label="Confirm password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); clearDownload(); setError(null); }} placeholder="Enter it again" /></div></label>

                <details className="protect-pdf-permissions">
                  <summary><span><strong>PDF permissions</strong><small>Optional viewer restrictions</small></span><b aria-hidden="true">+</b></summary>
                  <div>
                    <label><span><strong>Allow printing</strong><small>Permit printing from compatible PDF readers.</small></span><input type="checkbox" checked={permissions.printing} onChange={(event) => setPermission("printing", event.target.checked)} /></label>
                    <label><span><strong>Allow copying</strong><small>Permit text and image extraction.</small></span><input type="checkbox" checked={permissions.copying} onChange={(event) => setPermission("copying", event.target.checked)} /></label>
                    <label><span><strong>Allow editing</strong><small>Permit document changes in compatible readers.</small></span><input type="checkbox" checked={permissions.editing} onChange={(event) => setPermission("editing", event.target.checked)} /></label>
                    <p>Permissions depend on the PDF reader. The open password is the meaningful security control.</p>
                  </div>
                </details>

                <div className="protect-pdf-encryption"><span aria-hidden="true">&#128274;</span><div><strong>AES-256 encryption</strong><p>A separate encrypted copy is created. Your original PDF stays unchanged.</p></div></div>
                <button type="button" className="protect-pdf-primary" disabled={isProtecting} onClick={() => void protectPdf()}>{isProtecting ? progress?.message ?? "Protecting PDF..." : "Protect PDF"}</button>
                {isProtecting ? <button type="button" className="protect-pdf-cancel" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
              </aside>
            </div>
          </div>
        )}

        {error !== null ? <p className="protect-pdf-error" role="alert">{error}</p> : null}
        {download !== null ? (
          <section className="protect-pdf-result" aria-labelledby="protect-result-title">
            <span aria-hidden="true">&#10003;</span><div><h2 id="protect-result-title">Your protected PDF is ready</h2><p>{download.pageCount} pages secured with {download.encryption}. Keep the password somewhere safe—PDFMech cannot recover it.</p></div><a href={download.url} download={download.downloadName}>Download protected PDF</a>
          </section>
        ) : null}
      </section>

      <section className="protect-pdf-benefits" aria-label="Password protect PDF benefits"><article><span aria-hidden="true">256</span><div><h2>AES-256 encryption</h2><p>The downloaded PDF requires the password before compatible readers can open its contents.</p></div></article><article><span aria-hidden="true">&#128274;</span><div><h2>Password stays private</h2><p>The source file and password are processed by a local WebAssembly worker in your browser.</p></div></article><article><span aria-hidden="true">PDF</span><div><h2>Pages stay native</h2><p>Protection encrypts the document without intentionally rasterizing or rebuilding its pages.</p></div></article></section>

      <section className="protect-pdf-copy">
        <h2>How to password protect a PDF online</h2><ol><li>Choose an unprotected PDF from your device.</li><li>Create and confirm a strong open password.</li><li>Optionally choose printing, copying, and editing permissions.</li><li>Protect and download the AES-256 encrypted copy.</li></ol>
        <h2>Private browser-local PDF encryption</h2><p>PDFMech loads the encryption engine and processes the document in a browser worker. The PDF and password are not uploaded to a PDFMech processing server.</p>
        <h2>AES-256 open-password protection</h2><p>The new PDF uses AES-256 encryption and requires the password to open. Use a long, unique passphrase and store it safely because PDFMech does not receive or recover passwords.</p>
        <h2>PDF permission limits</h2><p>Printing, copying, and editing restrictions are instructions for compatible PDF readers and can be ignored by some software. A strong open password provides the meaningful protection.</p>
        <h2>Protect PDF FAQ</h2><h3>Does PDFMech upload my PDF or password?</h3><p>No. Inspection, encryption, verification, and download happen locally in your browser.</p><h3>What encryption does PDFMech use?</h3><p>The protected output uses AES-256 PDF encryption.</p><h3>Can PDFMech recover a forgotten password?</h3><p>No. PDFMech never receives or stores the password. Keep it in a trusted password manager or another safe place.</p><h3>Can I protect an already encrypted PDF?</h3><p>Not on this page. Remove the existing password first, then protect the unencrypted copy with a new password.</p>
        <nav className="protect-pdf-related" aria-label="Related PDF tools"><strong>Related tools</strong><a href="/redact-pdf">Secure PDF Redaction</a><a href="/remove-pdf-metadata">Remove PDF Metadata</a><a href="/compress-pdf">Compress PDF</a><a href="/tools">All PDF tools</a></nav>
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
  return error instanceof Error ? error.message : "The PDF could not be password protected. Please try another file.";
}
