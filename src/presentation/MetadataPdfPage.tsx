import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { createLazyMetadataProcessor } from "../infrastructure/pdflib/lazy-metadata-processor";
import type { PdfMetadataInspection, PdfMetadataRemovalResult } from "../ports/metadata";

const processor = createLazyMetadataProcessor();

interface MetadataDownload extends PdfMetadataRemovalResult {
  readonly url: string;
}

export function MetadataPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<PdfMetadataInspection | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);
  const [removeXmp, setRemoveXmp] = useState(false);
  const [download, setDownload] = useState<MetadataDownload | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
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
    setSelectedKeys([]);
    setRemoveXmp(false);
    clearDownload();
    setIsInspecting(true);
    try {
      const nextInspection = await processor.inspect(selected);
      setFile(selected);
      setInspection(nextInspection);
      setSelectedKeys(nextInspection.fields.map((field) => field.key));
      setRemoveXmp(nextInspection.hasXmp);
    } catch (inspectError) {
      setError(messageFromError(inspectError));
    } finally {
      setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function toggleField(key: string): void {
    setSelectedKeys((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  }

  function selectEverything(): void {
    if (inspection === null) return;
    setSelectedKeys(inspection.fields.map((field) => field.key));
    setRemoveXmp(inspection.hasXmp);
  }

  async function removeMetadata(): Promise<void> {
    if (file === null || inspection === null) return;
    setError(null);
    setIsRemoving(true);
    clearDownload();
    try {
      const result = await processor.remove(file, { fieldKeys: selectedKeys, removeXmp });
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (removeError) {
      setError(messageFromError(removeError));
    } finally {
      setIsRemoving(false);
    }
  }

  function startOver(): void {
    clearDownload();
    setFile(null);
    setInspection(null);
    setSelectedKeys([]);
    setRemoveXmp(false);
    setError(null);
  }

  const selectedCount = selectedKeys.length + (removeXmp ? 1 : 0);
  const removableCount = (inspection?.fields.length ?? 0) + (inspection?.hasXmp ? 1 : 0);

  return (
    <main className="metadata-page">
      <section className="metadata-hero">
        <span className="hero-kicker">PRIVATE METADATA TOOL</span>
        <h1>View and remove PDF metadata online.</h1>
        <p>Inspect hidden document details, remove selected fields or clear all detected items, and download a cleaned copy. Your PDF stays in your browser.</p>
        <div className="metadata-trust-row" aria-label="Tool benefits">
          <span><b aria-hidden="true">✓</b> Free</span>
          <span><b aria-hidden="true">▣</b> No signup</span>
          <span><b aria-hidden="true">⚡</b> No upload</span>
        </div>
      </section>

      <section className="metadata-tool" id="pdf-metadata-tool" aria-labelledby="metadata-tool-title">
        <div className="metadata-steps" aria-label="PDF metadata workflow">
          <span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "✓"}</b><i>Choose PDF</i></span>
          <span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "✓"}</b><i>Review details</i></span>
          <span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span>
        </div>
        <input ref={inputRef} className="metadata-file-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />

        {inspection === null ? (
          <button
            type="button"
            className="metadata-drop-zone"
            disabled={isInspecting}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()}
            onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}
          >
            <span className="metadata-file-icon" aria-hidden="true">PDF</span>
            <strong>{isInspecting ? "Reading metadata…" : "Drop your PDF here"}</strong>
            <small>View document properties before choosing what to remove</small>
            <i>Choose PDF</i>
            <em>Up to 100 MB · processed locally</em>
          </button>
        ) : (
          <div className="metadata-review-layout">
            <section className="metadata-document-card" aria-labelledby="metadata-tool-title">
              <header>
                <div><span aria-hidden="true">PDF</span><div><h2 id="metadata-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages · {formatBytes(inspection.byteLength)}</p></div></div>
                <button type="button" onClick={startOver} aria-label="Remove PDF">×</button>
              </header>
              <div className="metadata-document-visual" aria-hidden="true">
                <div className="metadata-paper">
                  <b>Document properties</b>
                  <span><i>Title</i><em>{valueFor(inspection, "Title")}</em></span>
                  <span><i>Author</i><em>{valueFor(inspection, "Author")}</em></span>
                  <span><i>Created</i><em>{valueFor(inspection, "CreationDate")}</em></span>
                  <span><i>Producer</i><em>{valueFor(inspection, "Producer")}</em></span>
                </div>
              </div>
              <p className="metadata-local-note"><b aria-hidden="true">⌂</b><span><strong>Private browser processing</strong>Your PDF and its metadata are not sent to PDFMech.</span></p>
              {inspection.hasSignatures ? <p className="metadata-warning"><strong>Digital signature warning:</strong> saving a modified PDF can invalidate existing signatures.</p> : null}
            </section>

            <aside className="metadata-fields-card" aria-labelledby="metadata-fields-title">
              <span className="metadata-card-kicker">METADATA INSPECTION</span>
              <div className="metadata-fields-heading">
                <div><h2 id="metadata-fields-title">{removableCount} removable item{removableCount === 1 ? "" : "s"}</h2><p>Select the hidden document details to remove.</p></div>
                {removableCount > 0 ? <button type="button" onClick={selectEverything}>Select all</button> : null}
              </div>

              {removableCount === 0 ? (
                <div className="metadata-empty"><b aria-hidden="true">✓</b><div><strong>No removable metadata found</strong><p>This PDF has no standard, custom, or embedded XMP metadata detected by this tool.</p></div></div>
              ) : (
                <div className="metadata-field-list">
                  {inspection.fields.map((field) => (
                    <label key={field.key} className="metadata-field-row">
                      <input type="checkbox" checked={selectedKeys.includes(field.key)} onChange={() => toggleField(field.key)} />
                      <span><strong>{field.label}{field.kind === "custom" ? <small>Custom</small> : null}</strong><em title={field.value}>{formatMetadataValue(field.key, field.value)}</em></span>
                    </label>
                  ))}
                  {inspection.hasXmp ? (
                    <label className="metadata-field-row is-xmp">
                      <input type="checkbox" checked={removeXmp} onChange={(event) => setRemoveXmp(event.target.checked)} />
                      <span><strong>Embedded XMP packet<small>XMP</small></strong><em>May contain duplicate properties, software details, IDs, or editing history.</em></span>
                    </label>
                  ) : null}
                </div>
              )}

              <div className="metadata-selection-summary"><span>{selectedCount} of {removableCount} selected</span>{selectedCount > 0 ? <button type="button" onClick={() => { setSelectedKeys([]); setRemoveXmp(false); }}>Clear selection</button> : null}</div>
              <button className="metadata-primary-button" type="button" disabled={isRemoving || selectedCount === 0} onClick={() => void removeMetadata()}>{isRemoving ? "Removing metadata locally…" : selectedCount === removableCount && removableCount > 0 ? "Remove all detected metadata" : `Remove ${selectedCount} selected item${selectedCount === 1 ? "" : "s"}`}</button>
            </aside>
          </div>
        )}

        {error !== null ? <p className="metadata-error" role="alert">{error}</p> : null}
        {download !== null ? (
          <section className="metadata-result" aria-labelledby="metadata-result-title">
            <span aria-hidden="true">✓</span>
            <div><h2 id="metadata-result-title">Your cleaned PDF is ready</h2><p>{download.removedFieldCount} document field{download.removedFieldCount === 1 ? "" : "s"} removed{download.removedXmp ? " plus the embedded XMP packet" : ""}. All {download.pageCount} pages are preserved.</p></div>
            <a href={download.url} download={download.downloadName}>Download cleaned PDF</a>
            <button type="button" onClick={startOver}>Start over</button>
          </section>
        ) : null}
      </section>

      <section className="metadata-benefits" aria-label="PDF metadata remover benefits">
        <article><span aria-hidden="true">⌕</span><div><h2>See hidden details</h2><p>Review standard properties, custom document-info fields, and embedded XMP metadata.</p></div></article>
        <article><span aria-hidden="true">⌫</span><div><h2>Choose what to remove</h2><p>Clear individual values or select every detected metadata item in one step.</p></div></article>
        <article><span aria-hidden="true">⌂</span><div><h2>Keep pages unchanged</h2><p>Metadata cleanup does not rasterize, reorder, or visibly alter your PDF pages.</p></div></article>
      </section>

      <section className="metadata-seo-copy">
        <h2>What metadata can a PDF contain?</h2>
        <p>A PDF can store a title, author, subject, keywords, creator application, PDF producer, creation and modification dates, custom document-info fields, and a separate XMP metadata packet. These details may not appear on the visible pages.</p>
        <h2>How to remove metadata from a PDF</h2>
        <ol><li>Choose a PDF from your device.</li><li>Review the metadata detected in the document.</li><li>Select individual fields or choose all detected metadata.</li><li>Create and download a cleaned copy locally.</li></ol>
        <h2>Important privacy limitation</h2>
        <p>Removing document metadata does not remove visible names, comments, annotations, attachments, form values, hidden page content, or text inside images. Review the downloaded PDF separately before sharing sensitive material.</p>
        <h2>PDF metadata FAQ</h2>
        <h3>Is my PDF uploaded?</h3><p>No. PDFMech reads and removes supported metadata inside your browser.</p>
        <h3>Will removing metadata change my pages?</h3><p>The tool preserves the PDF page count and does not intentionally rasterize or visibly edit page content.</p>
        <h3>Can I remove only the author or title?</h3><p>Yes. You can select individual standard or custom fields and choose whether to remove the embedded XMP packet.</p>
        <h3>Does this remove every possible trace of personal information?</h3><p>No. It removes supported document-info fields and XMP metadata, not visible text, annotations, attachments, form values, or other page content.</p>
        <nav className="metadata-related-links" aria-label="Related PDF tools"><strong>Related tools</strong><a href="/flatten-pdf">Flatten PDF forms</a><a href="/deskew-pdf">Straighten scanned PDFs</a><a href="/editor">Open the PDF editor</a></nav>
      </section>
    </main>
  );
}

function valueFor(inspection: PdfMetadataInspection, key: string): string {
  const value = inspection.fields.find((field) => field.key === key)?.value;
  return value === undefined ? "Not set" : formatMetadataValue(key, value);
}

function formatMetadataValue(key: string, value: string): string {
  if (key === "CreationDate" || key === "ModDate") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return value;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try another PDF.";
}
