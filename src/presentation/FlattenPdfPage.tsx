import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { createLazyFormFlattener } from "../infrastructure/pdflib/lazy-form-flattener";
import type { FlattenFormResult, FormInspection } from "../ports/form-flattener";

const flattener = createLazyFormFlattener();

interface FlattenedDownload extends FlattenFormResult {
  readonly url: string;
}

export function FlattenPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<FormInspection | null>(null);
  const [download, setDownload] = useState<FlattenedDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isFlattening, setIsFlattening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (download !== null) URL.revokeObjectURL(download.url);
  }, [download]);

  function clearDownload(): void {
    setDownload((current) => {
      if (current !== null) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function chooseFile(selected: File | null): Promise<void> {
    if (selected === null) return;
    setError(null);
    setInspection(null);
    setFile(null);
    clearDownload();
    setIsInspecting(true);
    try {
      const nextInspection = await flattener.inspect(selected);
      setFile(selected);
      setInspection(nextInspection);
      if (nextInspection.hasXfa) {
        setError("This PDF uses an XFA form. XFA is not supported because flattening it may lose visible content.");
      } else if (nextInspection.fields.length === 0) {
        setError("No editable AcroForm fields were found. The PDF may already be flattened or may use ordinary page content instead of form fields.");
      }
    } catch (inspectError) {
      setError(messageFromError(inspectError));
    } finally {
      setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  async function flattenPdf(): Promise<void> {
    if (file === null || inspection === null) return;
    setError(null);
    setIsFlattening(true);
    clearDownload();
    try {
      const result = await flattener.flatten(file);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (flattenError) {
      setError(messageFromError(flattenError));
    } finally {
      setIsFlattening(false);
    }
  }

  function startOver(): void {
    clearDownload();
    setFile(null);
    setInspection(null);
    setError(null);
  }

  return (
    <main className="flatten-page">
      <section className="flatten-hero">
        <span className="hero-kicker">PRIVATE FORM TOOL</span>
        <h1>Flatten PDF forms online for free.</h1>
        <p>Turn completed PDF form fields into fixed page content for consistent viewing and printing. Your file stays in your browser.</p>
        <div className="flatten-trust-row" aria-label="Tool benefits">
          <span><b aria-hidden="true">✓</b> Free</span>
          <span><b aria-hidden="true">▣</b> No signup</span>
          <span><b aria-hidden="true">⚡</b> No upload</span>
        </div>
      </section>

      <section className="flatten-tool" id="flatten-pdf-tool" aria-labelledby="flatten-tool-title">
        <div className="flatten-steps" aria-label="Flatten PDF workflow">
          <span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "✓"}</b><i>Choose PDF</i></span>
          <span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "✓"}</b><i>Review fields</i></span>
          <span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span>
        </div>
        <input ref={inputRef} className="flatten-file-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />

        {inspection === null ? (
          <button
            type="button"
            className="flatten-drop-zone"
            disabled={isInspecting}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()}
            onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}
          >
            <span className="flatten-file-icon" aria-hidden="true">PDF</span>
            <strong>{isInspecting ? "Inspecting form fields…" : "Drop your filled PDF form here"}</strong>
            <small>Choose a PDF with editable AcroForm fields</small>
            <i>Choose PDF</i>
            <em>Up to 100 MB · processed locally</em>
          </button>
        ) : (
          <div className="flatten-review-layout">
            <section className="flatten-document-card" aria-labelledby="flatten-tool-title">
              <header><div><span aria-hidden="true">PDF</span><div><h2 id="flatten-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages · {formatBytes(inspection.byteLength)}</p></div></div><button type="button" onClick={startOver} aria-label="Remove PDF">×</button></header>
              <div className="flatten-preview" aria-hidden="true">
                <div className="flatten-paper"><span /><span /><span /><span /><i>Editable form</i></div>
                <div className="flatten-arrow">→</div>
                <div className="flatten-paper is-fixed"><span /><span /><span /><span /><i>Fixed content</i></div>
              </div>
              <p className="flatten-local-note"><b aria-hidden="true">⌂</b><span><strong>Processed on your device</strong>Your PDF is not sent to a PDFMech server.</span></p>
            </section>

            <aside className="flatten-field-card" aria-labelledby="flatten-fields-title">
              <span className="flatten-card-kicker">FORM INSPECTION</span>
              <h2 id="flatten-fields-title">{inspection.fields.length} editable field{inspection.fields.length === 1 ? "" : "s"} found</h2>
              <p>Flattening keeps each field's current visible appearance but removes its editability.</p>
              {inspection.fields.length > 0 ? (
                <ul>{inspection.fields.slice(0, 8).map((field, index) => <li key={`${field.name}-${index}`}><span>{field.type}</span><strong>{field.name || `Unnamed field ${index + 1}`}</strong></li>)}{inspection.fields.length > 8 ? <li className="flatten-more-fields">+ {inspection.fields.length - 8} more fields</li> : null}</ul>
              ) : <div className="flatten-empty-fields">No editable AcroForm fields detected.</div>}
              {inspection.hasSignatures ? <p className="flatten-warning"><strong>Digital signature warning:</strong> modifying and flattening this PDF can invalidate existing signatures.</p> : null}
              {inspection.hasXfa ? <p className="flatten-warning"><strong>XFA form detected:</strong> this form type is not supported.</p> : null}
              <button className="flatten-primary-button" type="button" disabled={isFlattening || inspection.fields.length === 0 || inspection.hasXfa} onClick={() => void flattenPdf()}>{isFlattening ? "Flattening locally…" : `Flatten ${inspection.fields.length} field${inspection.fields.length === 1 ? "" : "s"}`}</button>
            </aside>
          </div>
        )}

        {error !== null ? <p className="flatten-error" role="alert">{error}</p> : null}
        {download !== null ? (
          <section className="flatten-result" aria-labelledby="flatten-result-title">
            <span aria-hidden="true">✓</span>
            <div><h2 id="flatten-result-title">Your flattened PDF is ready</h2><p>{download.flattenedFieldCount} fields fixed across {download.pageCount} pages. The original file remains unchanged.</p></div>
            <a href={download.url} download={download.downloadName}>Download flattened PDF</a>
            <button type="button" onClick={startOver}>Start over</button>
          </section>
        ) : null}
      </section>

      <section className="flatten-benefits" aria-label="Flatten PDF benefits">
        <article><span aria-hidden="true">▤</span><div><h2>Consistent appearance</h2><p>Make completed fields look the same in viewers and printed copies.</p></div></article>
        <article><span aria-hidden="true">◫</span><div><h2>No editable fields</h2><p>Field appearances become page content and the interactive controls are removed.</p></div></article>
        <article><span aria-hidden="true">⌂</span><div><h2>Private and local</h2><p>Inspection, flattening, validation, and download happen in this browser.</p></div></article>
      </section>

      <section className="flatten-seo-copy">
        <h2>What does flattening a PDF form do?</h2>
        <p>Flattening converts the current appearance of interactive PDF form fields into fixed page content. Text fields, checkboxes, radio buttons, dropdowns, and other supported AcroForm controls are no longer editable in the downloaded copy.</p>
        <h2>How to flatten PDF form fields</h2>
        <ol><li>Choose a completed PDF form from your device.</li><li>Review the number and types of editable fields detected.</li><li>Select Flatten fields to create a fixed copy locally.</li><li>Download the validated flattened PDF while keeping the original.</li></ol>
        <h2>Scope and limitations</h2>
        <p>This tool flattens interactive AcroForm fields. It does not promise to flatten arbitrary annotations, optional content layers, attachments, scripts, or XFA forms. Adding changes may also invalidate a digital signature.</p>
        <h2>Flatten PDF FAQ</h2>
        <h3>Is my PDF uploaded?</h3><p>No. PDFMech inspects, flattens, validates, and creates the output in your browser.</p>
        <h3>Will the form fields still be editable?</h3><p>No. Supported field appearances become fixed page content in the downloaded copy.</p>
        <h3>Does flattening replace my original file?</h3><p>No. PDFMech creates a separate flattened PDF and leaves the source file unchanged.</p>
        <h3>Are XFA forms supported?</h3><p>No. XFA forms are detected and blocked because this browser-local method cannot preserve them reliably.</p>
        <nav className="flatten-related-links" aria-label="Related PDF tools"><strong>Related tools</strong><a href="/bates-numbering-pdf">Add Bates numbers</a><a href="/ocr-pdf">Make a PDF searchable</a><a href="/editor">Open the PDF editor</a></nav>
      </section>
    </main>
  );
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try another PDF.";
}
