import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";

import { isCompletedFormValue, type FormFieldValue } from "../domain/fill-pdf-form";
import { createLazyPdfFormFiller } from "../infrastructure/pdflib/lazy-pdf-form-filler";
import type { FillableFormField, FillPdfFormInspection, FillPdfFormResult } from "../ports/fill-pdf-form";

const filler = createLazyPdfFormFiller();

interface FillPdfDownload extends FillPdfFormResult {
  readonly url: string;
}

export function FillPdfFormPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<FillPdfFormInspection | null>(null);
  const [values, setValues] = useState<Readonly<Record<string, FormFieldValue>>>({});
  const [flatten, setFlatten] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<FillPdfDownload | null>(null);

  useEffect(() => () => {
    if (download !== null) URL.revokeObjectURL(download.url);
  }, [download]);

  const editableFields = useMemo(() => inspection?.fields.filter((field) => field.kind !== "unsupported" && !field.readOnly) ?? [], [inspection]);
  const completedCount = useMemo(() => editableFields.filter((field) => isCompletedFormValue(values[field.name] ?? field.value)).length, [editableFields, values]);
  const unsupportedCount = useMemo(() => inspection?.fields.filter((field) => field.kind === "unsupported").length ?? 0, [inspection]);

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
    setValues({});
    setFlatten(false);
    clearDownload();
    setIsInspecting(true);
    try {
      const nextInspection = await filler.inspect(selected);
      setFile(selected);
      setInspection(nextInspection);
      setValues(Object.fromEntries(nextInspection.fields.map((field) => [field.name, field.value])));
      if (nextInspection.hasXfa) {
        setError("This PDF uses an XFA form. XFA forms are not supported because browser-local editing may lose visible content.");
      } else if (nextInspection.fields.length === 0) {
        setError("No interactive AcroForm fields were found. The PDF may already be flattened or may use ordinary page content instead of form fields.");
      } else if (nextInspection.fields.every((field) => field.kind === "unsupported" || field.readOnly)) {
        setError("No supported editable text, checkbox, radio, dropdown, or list fields were found.");
      }
    } catch (inspectError) {
      setError(messageFromError(inspectError));
    } finally {
      setIsInspecting(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function setFieldValue(name: string, value: FormFieldValue): void {
    setValues((current) => ({ ...current, [name]: value }));
    clearDownload();
  }

  function resetFields(): void {
    if (inspection === null) return;
    setValues(Object.fromEntries(inspection.fields.map((field) => [field.name, field.value])));
    clearDownload();
    setError(null);
  }

  async function savePdf(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (file === null || inspection === null || inspection.hasXfa || editableFields.length === 0) return;
    setError(null);
    setIsSaving(true);
    clearDownload();
    try {
      const result = await filler.fill(file, values, flatten);
      setDownload({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (saveError) {
      setError(messageFromError(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  function startOver(): void {
    clearDownload();
    setFile(null);
    setInspection(null);
    setValues({});
    setFlatten(false);
    setError(null);
  }

  return (
    <main className="fill-form-page">
      <section className="fill-form-hero">
        <span className="hero-kicker">PRIVATE PDF FORM FILLER</span>
        <h1>Fill PDF forms online for free.</h1>
        <p>Complete interactive PDF fields and download an editable or flattened copy. Your document stays in your browser.</p>
        <div className="fill-form-trust" aria-label="Tool benefits">
          <span><b aria-hidden="true">✓</b> Free</span>
          <span><b aria-hidden="true">▣</b> No signup</span>
          <span><b aria-hidden="true">⚡</b> No upload</span>
        </div>
      </section>

      <section className="fill-form-tool" id="fill-pdf-form-tool" aria-labelledby="fill-form-tool-title">
        <div className="fill-form-steps" aria-label="Fill PDF workflow">
          <span className={inspection === null ? "is-active" : "is-complete"}><b>{inspection === null ? "1" : "✓"}</b><i>Choose PDF</i></span>
          <span className={inspection !== null && download === null ? "is-active" : download !== null ? "is-complete" : ""}><b>{download === null ? "2" : "✓"}</b><i>Fill fields</i></span>
          <span className={download !== null ? "is-active" : ""}><b>3</b><i>Download</i></span>
        </div>

        <input ref={inputRef} className="fill-form-file-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseFile(event.target.files?.[0] ?? null)} />

        {inspection === null ? (
          <button
            type="button"
            className="fill-form-drop-zone"
            disabled={isInspecting}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()}
            onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0] ?? null); }}
          >
            <span className="fill-form-file-icon" aria-hidden="true">PDF</span>
            <strong>{isInspecting ? "Finding form fields…" : "Drop your PDF form here"}</strong>
            <small>Text fields, checkboxes, radio groups, dropdowns, and list boxes</small>
            <i>Choose PDF</i>
            <em>Up to 100 MB · processed locally</em>
          </button>
        ) : (
          <form className="fill-form-workspace" onSubmit={(event) => void savePdf(event)}>
            <aside className="fill-form-summary" aria-label="Document summary">
              <header>
                <span aria-hidden="true">PDF</span>
                <div><h2 id="fill-form-tool-title">{inspection.fileName}</h2><p>{inspection.pageCount} pages · {formatBytes(inspection.byteLength)}</p></div>
                <button type="button" onClick={startOver} aria-label="Remove PDF">×</button>
              </header>
              <div className="fill-form-progress-card">
                <div><strong>{completedCount} of {editableFields.length}</strong><span>editable fields completed</span></div>
                <progress max={Math.max(1, editableFields.length)} value={completedCount} aria-label={`${completedCount} of ${editableFields.length} fields completed`} />
              </div>
              <dl>
                <div><dt>Supported fields</dt><dd>{editableFields.length}</dd></div>
                <div><dt>Read-only or unsupported</dt><dd>{inspection.fields.length - editableFields.length}</dd></div>
                <div><dt>Output</dt><dd>{flatten ? "Flattened copy" : "Editable copy"}</dd></div>
              </dl>
              {inspection.hasSignatures ? <p className="fill-form-warning"><strong>Signature warning</strong>Saving changes can invalidate an existing digital signature.</p> : null}
              {unsupportedCount > 0 ? <p className="fill-form-note"><strong>{unsupportedCount} unsupported field{unsupportedCount === 1 ? "" : "s"}</strong>Signature and button fields are shown but not changed.</p> : null}
              <p className="fill-form-local"><b aria-hidden="true">⌂</b><span><strong>Stays on your device</strong>The PDF and field values are processed only in this browser.</span></p>
            </aside>

            <section className="fill-form-fields" aria-labelledby="fill-form-fields-title">
              <header><div><span className="fill-form-card-kicker">FORM FIELDS</span><h2 id="fill-form-fields-title">Complete your PDF form</h2><p>Field labels are derived from names stored inside the PDF.</p></div><button type="button" onClick={resetFields}>Reset fields</button></header>
              <div className="fill-form-field-list">
                {inspection.fields.map((field, index) => <FormFieldControl key={field.name} field={field} index={index} value={values[field.name] ?? field.value} onChange={(value) => setFieldValue(field.name, value)} />)}
              </div>
              <label className="fill-form-flatten-option">
                <input type="checkbox" checked={flatten} onChange={(event) => { setFlatten(event.target.checked); clearDownload(); }} />
                <span><strong>Flatten fields after filling</strong><small>Make supported field appearances fixed and non-editable in the downloaded copy.</small></span>
              </label>
              <button className="fill-form-primary" type="submit" disabled={isSaving || inspection.hasXfa || editableFields.length === 0}>{isSaving ? "Saving locally…" : `Save completed PDF (${editableFields.length} fields)`}</button>
            </section>
          </form>
        )}

        {error !== null ? <p className="fill-form-error" role="alert">{error}</p> : null}
        {download !== null ? (
          <section className="fill-form-result" aria-labelledby="fill-form-result-title">
            <span aria-hidden="true">✓</span>
            <div><h2 id="fill-form-result-title">Your completed PDF is ready</h2><p>{download.updatedFieldCount} supported fields saved across {download.pageCount} pages. {download.flattened ? "The output fields are fixed." : "The output fields remain editable."}</p></div>
            <a href={download.url} download={download.downloadName}>Download filled PDF</a>
            <button type="button" onClick={startOver}>Fill another PDF</button>
          </section>
        ) : null}
      </section>

      <section className="fill-form-benefits" aria-label="Fill PDF benefits">
        <article><span aria-hidden="true">Aa</span><div><h2>Common form controls</h2><p>Complete supported text, checkbox, radio, dropdown, and list fields from one clear panel.</p></div></article>
        <article><span aria-hidden="true">▤</span><div><h2>Editable or flattened</h2><p>Keep fields interactive for later changes or make their current appearances fixed.</p></div></article>
        <article><span aria-hidden="true">⌂</span><div><h2>Private and local</h2><p>Field inspection, editing, validation, and PDF creation happen in this browser.</p></div></article>
      </section>

      <section className="fill-form-seo-copy">
        <h2>How to fill a PDF form online</h2>
        <ol><li>Choose a PDF containing interactive AcroForm fields.</li><li>Complete the supported fields in the form panel.</li><li>Choose whether the downloaded fields should remain editable or be flattened.</li><li>Save and download the completed PDF without uploading it.</li></ol>
        <h2>Fill text fields, checkboxes, radio buttons, and dropdowns</h2>
        <p>PDFMech reads field names and choices already stored in the PDF. It supports common AcroForm controls while leaving unsupported buttons and signature fields unchanged.</p>
        <h2>Keep PDF fields editable or flatten them</h2>
        <p>An editable copy can be changed later in a compatible PDF viewer. A flattened copy converts supported field appearances into fixed page content for consistent viewing and printing.</p>
        <h2>Private browser-local form filling</h2>
        <p>Your source PDF and entered values stay on your device during supported processing. PDFMech creates a separate output and does not replace the original file.</p>
        <h2>Fill PDF form FAQ</h2>
        <h3>Is my PDF or form data uploaded?</h3><p>No. Supported form inspection, editing, rendering, validation, and download happen locally in your browser.</p>
        <h3>Which PDF fields are supported?</h3><p>PDFMech supports AcroForm text fields, checkboxes, radio groups, dropdowns, and list boxes. Buttons and cryptographic signature fields are not edited.</p>
        <h3>Can I keep the form editable?</h3><p>Yes. Fields remain interactive by default. Enable flattening only when you want the supported field appearances fixed into the page.</p>
        <h3>Are XFA forms supported?</h3><p>No. XFA forms are detected and blocked because this browser-local workflow cannot preserve them reliably.</p>
        <nav className="fill-form-related" aria-label="Related PDF tools"><strong>Continue your form workflow</strong><a href="/sign-pdf">Sign the completed PDF</a><a href="/flatten-pdf">Flatten PDF forms</a><a href="/protect-pdf">Password protect the PDF</a></nav>
      </section>
    </main>
  );
}

function FormFieldControl({ field, index, value, onChange }: { readonly field: FillableFormField; readonly index: number; readonly value: FormFieldValue; readonly onChange: (value: FormFieldValue) => void }) {
  const id = `fill-form-field-${index}`;
  if (field.kind === "unsupported") return <div className="fill-form-field is-unsupported"><FieldHeading field={field} index={index} /><p>This field type is preserved but cannot be completed here.</p></div>;
  if (field.kind === "checkbox") return <label className="fill-form-field is-checkbox" htmlFor={id}><FieldHeading field={field} index={index} /><span className="fill-form-checkbox-control"><input id={id} type="checkbox" checked={value === true} disabled={field.readOnly} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true">✓</i><b>{value === true ? "Checked" : "Not checked"}</b></span></label>;
  if (field.kind === "radio") return <fieldset className="fill-form-field" disabled={field.readOnly}><FieldHeading field={field} index={index} /> <div className="fill-form-choice-grid"><label><input type="radio" name={id} checked={value === ""} onChange={() => onChange("")} />Not selected</label>{field.options.map((option) => <label key={option}><input type="radio" name={id} checked={value === option} onChange={() => onChange(option)} />{option}</label>)}</div></fieldset>;
  if (field.kind === "dropdown") return <label className="fill-form-field" htmlFor={id}><FieldHeading field={field} index={index} /><select id={id} disabled={field.readOnly} value={Array.isArray(value) ? value[0] ?? "" : ""} onChange={(event) => onChange(event.target.value === "" ? [] : [event.target.value])}><option value="">Choose an option</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
  if (field.kind === "option-list") return <label className="fill-form-field" htmlFor={id}><FieldHeading field={field} index={index} /><select id={id} multiple disabled={field.readOnly} value={Array.isArray(value) ? [...value] : []} onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select><small>Hold Ctrl or Command to select multiple options.</small></label>;
  return <label className="fill-form-field" htmlFor={id}><FieldHeading field={field} index={index} />{field.multiline ? <textarea id={id} rows={4} value={typeof value === "string" ? value : ""} maxLength={field.maxLength ?? undefined} readOnly={field.readOnly} onChange={(event) => onChange(event.target.value)} /> : <input id={id} type="text" value={typeof value === "string" ? value : ""} maxLength={field.maxLength ?? undefined} readOnly={field.readOnly} onChange={(event) => onChange(event.target.value)} />}{field.maxLength !== null ? <small>Maximum {field.maxLength} characters</small> : null}</label>;
}

function FieldHeading({ field, index }: { readonly field: FillableFormField; readonly index: number }) {
  return <span className="fill-form-field-heading"><span><b>{index + 1}</b><strong>{field.label}</strong></span><i>{field.readOnly ? "Read only" : field.typeLabel}</i></span>;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try another PDF.";
}
