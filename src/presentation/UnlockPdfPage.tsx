import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { validateUnlockPdfPassword } from "../domain/unlock-pdf";
import { createLazyPdfUnlocker } from "../infrastructure/pdflib/lazy-pdf-unlocker";
import type { UnlockPdfInspection, UnlockPdfProgress, UnlockPdfResult } from "../ports/unlock-pdf";

const processor = createLazyPdfUnlocker();

interface UnlockPdfDownload extends UnlockPdfResult {
  readonly url: string;
}

export function UnlockPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const downloadRef = useRef<UnlockPdfDownload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<UnlockPdfInspection | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [progress, setProgress] = useState<UnlockPdfProgress | null>(null);
  const [download, setDownload] = useState<UnlockPdfDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => {
    abortRef.current?.abort();
    if (downloadRef.current !== null) URL.revokeObjectURL(downloadRef.current.url);
  }, []);

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
    clearDownload();
    setFile(null);
    setInspection(null);
    setPassword("");
    setError(null);
    setIsInspecting(true);
    try {
      const nextInspection = await processor.inspect(selected, setProgress, controller.signal);
      setFile(selected);
      setInspection(nextInspection);
    } catch (inspectError) {
      if (!(inspectError instanceof Error && inspectError.name === "AbortError")) setError(messageFromError(inspectError));
    } finally {
      setProgress(null);
      setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  async function unlockPdf(): Promise<void> {
    if (file === null || inspection === null) return;
    const validationError = validateUnlockPdfPassword(password, inspection.requiresPassword);
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsUnlocking(true);
    try {
      const result = await processor.unlock(file, password, setProgress, controller.signal);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (unlockError) {
      if (!(unlockError instanceof Error && unlockError.name === "AbortError")) setError(messageFromError(unlockError));
    } finally {
      setProgress(null);
      setIsUnlocking(false);
    }
  }

  function startOver(): void {
    abortRef.current?.abort();
    clearDownload();
    setFile(null);
    setInspection(null);
    setPassword("");
    setProgress(null);
    setError(null);
  }

  return (
    <main className="unlock-pdf-page">
      <section className="unlock-pdf-hero">
        <span className="hero-kicker">PRIVATE PDF PASSWORD REMOVAL</span>
        <h1>Unlock a PDF online for free.</h1>
        <p>Remove a known PDF password and download an unrestricted copy directly in your browser. Your file and password stay on your device.</p>
        <div className="unlock-pdf-trust" aria-label="Unlock PDF benefits"><span><b aria-hidden="true">&#10003;</b> Free</span><span><b aria-hidden="true">&#128275;</b> Remove password</span><span><b aria-hidden="true">&#9889;</b> No upload</span></div>
      </section>

      <section className="unlock-pdf-tool" id="unlock-pdf-tool" aria-labelledby="unlock-pdf-tool-title">
        <div className="unlock-pdf-steps" aria-label="Unlock PDF workflow">
          <span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "\u2713"}</b><i>Choose locked PDF</i></span>
          <span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "\u2713"}</b><i>Enter password</i></span>
          <span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span>
        </div>
        <input ref={inputRef} className="unlock-pdf-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />

        {inspection === null ? (
          <button type="button" className="unlock-pdf-drop" disabled={isInspecting} onClick={() => inputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}>
            <span className="unlock-pdf-file-icon" aria-hidden="true"><i>PDF</i><b>&#128274;</b></span>
            <strong>{isInspecting ? progress?.message ?? "Checking PDF protection..." : "Drop your locked PDF here"}</strong>
            <small>You must know the current password if the PDF requires one to open.</small>
            <i>Choose protected PDF</i>
            <em>Up to 100 MB - processed locally</em>
          </button>
        ) : (
          <div className="unlock-pdf-workspace">
            <header className="unlock-pdf-document"><div><span aria-hidden="true">PDF</span><div><h2 id="unlock-pdf-tool-title">{inspection.fileName}</h2><p>{formatBytes(inspection.byteLength)} - Protected PDF</p></div></div><button type="button" onClick={startOver}>Choose another PDF</button></header>
            <div className="unlock-pdf-layout">
              <section className="unlock-pdf-explainer" aria-labelledby="unlock-summary-title">
                <div className="unlock-pdf-visual" aria-hidden="true"><span>PDF</span><b>&#128274;</b><i>&#8594;</i><span>PDF</span><b>&#128275;</b></div>
                <span className="unlock-pdf-status">Encrypted PDF detected</span>
                <h2 id="unlock-summary-title">Create a password-free copy.</h2>
                <p>PDFMech will decrypt this file locally and verify that the downloaded copy opens without encryption.</p>
                <ul><li>The original protected PDF stays unchanged.</li><li>Native pages are preserved without intentional rasterization.</li><li>Existing usage restrictions are removed with the encryption.</li></ul>
              </section>

              <aside className="unlock-pdf-settings" aria-labelledby="unlock-settings-title">
                <div className="unlock-pdf-heading"><span>2</span><div><h2 id="unlock-settings-title">{inspection.requiresPassword ? "Enter the current password" : "Remove PDF restrictions"}</h2><p>{inspection.requiresPassword ? "The correct password is required to decrypt this file." : "This encrypted PDF opens without a password."}</p></div></div>
                {inspection.requiresPassword ? <label className="unlock-pdf-password"><span>Current PDF password</span><div><input aria-label="Current PDF password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); clearDownload(); setError(null); }} placeholder="Enter the password" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button></div></label> : <div className="unlock-pdf-no-password"><span aria-hidden="true">i</span><p>No open password is needed. Continue to remove the encryption and reader restrictions.</p></div>}
                <div className="unlock-pdf-privacy"><span aria-hidden="true">&#128274;</span><div><strong>Your password stays local</strong><p>It is passed only to the browser worker processing this document and is never stored by PDFMech.</p></div></div>
                <button type="button" className="unlock-pdf-primary" disabled={isUnlocking} onClick={() => void unlockPdf()}>{isUnlocking ? progress?.message ?? "Unlocking PDF..." : "Unlock PDF"}</button>
                {isUnlocking ? <button type="button" className="unlock-pdf-cancel" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
                <p className="unlock-pdf-legal"><strong>Only unlock files you are authorized to access.</strong> This tool does not discover, bypass, or crack unknown passwords.</p>
              </aside>
            </div>
          </div>
        )}

        {error !== null ? <p className="unlock-pdf-error" role="alert">{error}</p> : null}
        {download !== null ? <section className="unlock-pdf-result" aria-labelledby="unlock-result-title"><span aria-hidden="true">&#10003;</span><div><h2 id="unlock-result-title">Your unlocked PDF is ready</h2><p>{download.pageCount} page{download.pageCount === 1 ? "" : "s"} verified without PDF encryption. The source file remains protected.</p></div><a href={download.url} download={download.downloadName}>Download unlocked PDF</a></section> : null}
      </section>

      <section className="unlock-pdf-benefits" aria-label="Unlock PDF benefits"><article><span aria-hidden="true">&#128275;</span><div><h2>Remove known passwords</h2><p>Decrypt a PDF when you have the valid current user or owner password.</p></div></article><article><span aria-hidden="true">&#128274;</span><div><h2>Private browser processing</h2><p>The document and password are handled locally by a WebAssembly worker.</p></div></article><article><span aria-hidden="true">PDF</span><div><h2>Separate unlocked copy</h2><p>The original remains protected while the new download opens without a password.</p></div></article></section>

      <section className="unlock-pdf-copy">
        <h2>How to remove a password from a PDF</h2><ol><li>Choose an encrypted PDF from your device.</li><li>Enter the current user or owner password.</li><li>Unlock and verify the PDF locally in your browser.</li><li>Download the separate password-free copy.</li></ol>
        <h2>Private browser-local PDF decryption</h2><p>PDFMech loads the security engine in a browser worker. Your PDF and password are not uploaded to a PDFMech document-processing server.</p>
        <h2>Known-password removal only</h2><p>This tool removes encryption only when the supplied password successfully opens the document. It does not guess, recover, bypass, or crack an unknown PDF password.</p>
        <h2>What changes after unlocking</h2><p>The downloaded copy no longer requires the PDF password and no longer carries encryption permissions. Anyone who receives that copy may be able to open, print, copy, or edit it, so store and share it carefully.</p>
        <h2>Unlock PDF FAQ</h2><h3>Can PDFMech unlock a PDF without its password?</h3><p>No. If the file requires an open password, you must provide a valid current user or owner password.</p><h3>Does PDFMech upload my PDF or password?</h3><p>No. Protection checks, decryption, verification, and download happen locally in your browser.</p><h3>Does unlocking change the original PDF?</h3><p>No. PDFMech creates a separate unencrypted copy and leaves the protected source file unchanged.</p><h3>Why does my PDF open without asking for a password?</h3><p>Some encrypted PDFs use only permission restrictions. PDFMech can remove those restrictions without an open password.</p>
        <nav className="unlock-pdf-related" aria-label="Related PDF tools"><strong>Related tools</strong><a href="/protect-pdf">Protect PDF</a><a href="/redact-pdf">Secure PDF Redaction</a><a href="/remove-pdf-metadata">Remove PDF Metadata</a><a href="/tools">All PDF tools</a></nav>
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
  return error instanceof Error ? error.message : "The PDF password could not be removed. Please try another file.";
}
