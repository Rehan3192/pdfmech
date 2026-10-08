import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { parseSplitPageGroups, type SplitPageGroup } from "../domain/split-pdf";
import {
  SMART_SPLIT_MAX_OUTPUTS,
  createFixedSizeGroups,
  createInitialAssignments,
  filenamesFromColumn,
  normalizePdfFilename,
  parseFilenameTable,
  suggestFilenameColumn,
  validateSplitRenamePlan,
  type FilenameTable,
  type SplitRenameAssignment,
} from "../domain/split-rename";
import { createLazyPdfSplitter } from "../infrastructure/pdflib/lazy-pdf-splitter";
import type { SplitPdfInspection, SplitPdfProgress, SplitPdfResult } from "../ports/split-pdf";

const processor = createLazyPdfSplitter();

interface SplitRenameDownload extends SplitPdfResult {
  readonly zipUrl: string;
  readonly fileUrls: readonly string[];
  readonly manifestUrl?: string;
}

interface ImportedNames {
  readonly fileName: string;
  readonly text: string;
  readonly hasHeader: boolean;
  readonly table: FilenameTable;
  readonly columnIndex: number;
  readonly names: readonly string[];
}

export function SplitRenamePage() {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const namesInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const thumbnailUrlsRef = useRef<readonly string[]>([]);
  const downloadRef = useRef<SplitRenameDownload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<SplitPdfInspection | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<readonly string[]>([]);
  const [mode, setMode] = useState<"fixed" | "ranges">("fixed");
  const [pagesPerGroup, setPagesPerGroup] = useState(1);
  const [ranges, setRanges] = useState("");
  const [groups, setGroups] = useState<readonly SplitPageGroup[]>([]);
  const [imported, setImported] = useState<ImportedNames | null>(null);
  const [assignments, setAssignments] = useState<readonly SplitRenameAssignment[]>([]);
  const [ignoredRows, setIgnoredRows] = useState<ReadonlySet<number>>(new Set());
  const [includeManifest, setIncludeManifest] = useState(true);
  const [progress, setProgress] = useState<SplitPdfProgress | null>(null);
  const [download, setDownload] = useState<SplitRenameDownload | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { thumbnailUrlsRef.current = thumbnailUrls; }, [thumbnailUrls]);
  useEffect(() => { downloadRef.current = download; }, [download]);
  useEffect(() => () => {
    abortRef.current?.abort();
    thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    revokeDownload(downloadRef.current);
  }, []);

  const validation = useMemo(() => inspection === null ? null : validateSplitRenamePlan({
    groups,
    assignments,
    importedNameCount: imported?.names.length ?? 0,
    ignoredRowIndexes: ignoredRows,
    pageCount: inspection.pageCount,
  }), [assignments, groups, ignoredRows, imported, inspection]);

  const usedRows = useMemo(() => new Set(assignments.flatMap((assignment) => assignment.sourceRowIndex === null ? [] : [assignment.sourceRowIndex])), [assignments]);
  const unusedRows = imported?.names.map((name, rowIndex) => ({ name, rowIndex })).filter(({ rowIndex }) => !usedRows.has(rowIndex)) ?? [];
  const planReady = validation?.canExport === true && groups.length >= 2;
  const canExport = planReady && !isBusy;

  function clearDownload(): void {
    setDownload((current) => { revokeDownload(current); return null; });
  }

  function replaceGroups(nextGroups: readonly SplitPageGroup[]): void {
    clearDownload();
    setGroups(nextGroups);
    setAssignments(createInitialAssignments(nextGroups, imported?.names ?? []));
    setIgnoredRows(new Set());
  }

  async function choosePdf(selected: File | null): Promise<void> {
    if (selected === null) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
    setThumbnailUrls([]);
    setFile(null);
    setInspection(null);
    setGroups([]);
    setAssignments([]);
    setError(null);
    setIsBusy(true);
    try {
      const nextInspection = await processor.inspect(selected, setProgress, controller.signal);
      if (nextInspection.pageCount < 2) throw new Error("Choose a PDF with at least two pages for batch splitting.");
      const defaultGroupSize = Math.ceil(nextInspection.pageCount / SMART_SPLIT_MAX_OUTPUTS);
      const nextGroups = createFixedSizeGroups(nextInspection.pageCount, defaultGroupSize);
      setFile(selected);
      setInspection(nextInspection);
      setThumbnailUrls(nextInspection.pages.map((page) => URL.createObjectURL(page.thumbnail)));
      setMode("fixed");
      setPagesPerGroup(defaultGroupSize);
      setRanges(defaultRanges(nextInspection.pageCount));
      setGroups(nextGroups);
      setAssignments(createInitialAssignments(nextGroups, imported?.names ?? []));
      setIgnoredRows(new Set());
    } catch (caught) {
      if (!(caught instanceof Error && caught.name === "AbortError")) setError(messageFromError(caught));
    } finally {
      setProgress(null);
      setIsBusy(false);
      if (pdfInputRef.current !== null) pdfInputRef.current.value = "";
    }
  }

  function applyFixedSize(value: number): void {
    if (inspection === null) return;
    setPagesPerGroup(value);
    setError(null);
    try { replaceGroups(createFixedSizeGroups(inspection.pageCount, value)); }
    catch (caught) { setGroups([]); setAssignments([]); setError(messageFromError(caught)); }
  }

  function applyRanges(): void {
    if (inspection === null) return;
    setError(null);
    try { replaceGroups(parseSplitPageGroups(ranges, inspection.pageCount, SMART_SPLIT_MAX_OUTPUTS)); }
    catch (caught) { setGroups([]); setAssignments([]); setError(messageFromError(caught)); }
  }

  async function chooseNames(selected: File | null): Promise<void> {
    if (selected === null) return;
    setError(null);
    try {
      const text = await selected.text();
      const hasHeader = !selected.name.toLocaleLowerCase("en").endsWith(".txt");
      const table = parseFilenameTable(text, selected.name, hasHeader);
      const columnIndex = suggestFilenameColumn(table);
      const names = filenamesFromColumn(table, columnIndex);
      setImported({ fileName: selected.name, text, hasHeader, table, columnIndex, names });
      setAssignments(createInitialAssignments(groups, names));
      setIgnoredRows(new Set());
      clearDownload();
    } catch (caught) { setError(messageFromError(caught)); }
    finally { if (namesInputRef.current !== null) namesInputRef.current.value = ""; }
  }

  function reparseImported(hasHeader: boolean): void {
    if (imported === null) return;
    try {
      const table = parseFilenameTable(imported.text, imported.fileName, hasHeader);
      const columnIndex = Math.min(imported.columnIndex, table.columns.length - 1);
      const names = filenamesFromColumn(table, columnIndex);
      setImported({ ...imported, hasHeader, table, columnIndex, names });
      setAssignments(createInitialAssignments(groups, names));
      setIgnoredRows(new Set());
      clearDownload();
      setError(null);
    } catch (caught) { setError(messageFromError(caught)); }
  }

  function chooseColumn(columnIndex: number): void {
    if (imported === null) return;
    const names = filenamesFromColumn(imported.table, columnIndex);
    setImported({ ...imported, columnIndex, names });
    setAssignments(createInitialAssignments(groups, names));
    setIgnoredRows(new Set());
    clearDownload();
  }

  function assignRow(groupIndex: number, rowIndex: number | null): void {
    setAssignments((current) => {
      const next = current.map((item) => ({ ...item }));
      const target = next[groupIndex];
      if (target === undefined) return current;
      if (rowIndex === null) {
        next[groupIndex] = { ...target, sourceRowIndex: null, filename: "" };
        return next;
      }
      const otherIndex = next.findIndex((item) => item.sourceRowIndex === rowIndex);
      if (otherIndex >= 0 && otherIndex !== groupIndex) {
        const other = next[otherIndex]!;
        next[otherIndex] = { ...other, sourceRowIndex: target.sourceRowIndex, filename: target.filename };
      }
      next[groupIndex] = { ...target, sourceRowIndex: rowIndex, filename: imported?.names[rowIndex] ?? "" };
      return next;
    });
    setIgnoredRows((current) => {
      if (rowIndex === null || !current.has(rowIndex)) return current;
      const next = new Set(current); next.delete(rowIndex); return next;
    });
    clearDownload();
  }

  function updateFilename(groupIndex: number, filename: string): void {
    setAssignments((current) => current.map((item, index) => index === groupIndex ? { ...item, filename } : item));
    clearDownload();
  }

  function moveAssignment(groupIndex: number, delta: -1 | 1): void {
    const otherIndex = groupIndex + delta;
    if (otherIndex < 0 || otherIndex >= assignments.length) return;
    setAssignments((current) => {
      const next = [...current];
      const first = next[groupIndex]!;
      const second = next[otherIndex]!;
      next[groupIndex] = { ...second, groupIndex };
      next[otherIndex] = { ...first, groupIndex: otherIndex };
      return next;
    });
    clearDownload();
  }

  function toggleIgnoredRow(rowIndex: number): void {
    setIgnoredRows((current) => {
      const next = new Set(current);
      if (next.has(rowIndex)) next.delete(rowIndex); else next.add(rowIndex);
      return next;
    });
    clearDownload();
  }

  async function generate(): Promise<void> {
    if (file === null || inspection === null || validation === null || !canExport) return;
    const controller = new AbortController();
    abortRef.current = controller;
    clearDownload();
    setError(null);
    setIsBusy(true);
    try {
      const namedGroups = groups.map((group, index) => ({ ...group, outputName: validation.normalizedNames[index] ?? "" }));
      const result = await processor.split(file, namedGroups, setProgress, controller.signal, { includeManifest });
      setDownload({
        ...result,
        zipUrl: URL.createObjectURL(result.zipBlob),
        fileUrls: result.files.map((output) => URL.createObjectURL(output.blob)),
        ...(result.manifestBlob === undefined ? {} : { manifestUrl: URL.createObjectURL(result.manifestBlob) }),
      });
    } catch (caught) {
      if (!(caught instanceof Error && caught.name === "AbortError")) setError(messageFromError(caught));
    } finally {
      setProgress(null);
      setIsBusy(false);
    }
  }

  function startOver(): void {
    abortRef.current?.abort();
    thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
    clearDownload();
    setFile(null); setInspection(null); setThumbnailUrls([]); setGroups([]); setAssignments([]);
    setImported(null); setIgnoredRows(new Set()); setError(null); setProgress(null);
  }

  return (
    <main className="split-rename-page">
      <section className="split-rename-hero">
        <span className="hero-kicker">SAFE BATCH DOCUMENT WORKFLOW</span>
        <h1>Split a PDF into Multiple Files and Automatically Rename Them</h1>
        <p>Import filenames from CSV or TXT, verify every document-to-name match, and download a locally generated ZIP.</p>
        <div aria-label="Tool benefits"><span><b>✓</b> No upload</span><span><b>✓</b> Strict matching</span><span><b>✓</b> Verified export</span></div>
      </section>

      <section className="split-rename-workflow" id="split-pdf-and-rename-tool" aria-label="Split and rename PDF workflow">
        <ol className="split-rename-steps">
          <li className={inspection === null ? "is-active" : "is-done"}><b>{inspection === null ? "1" : "✓"}</b><span>Upload PDF<small>Source stays local</small></span></li>
          <li className={inspection !== null && imported === null ? "is-active" : imported !== null ? "is-done" : ""}><b>{imported === null ? "2" : "✓"}</b><span>Configure<small>Groups and names</small></span></li>
          <li className={inspection !== null && imported !== null && download === null ? "is-active" : download !== null ? "is-done" : ""}><b>{download === null ? "3" : "✓"}</b><span>Review matches<small>Resolve every issue</small></span></li>
          <li className={download !== null ? "is-active" : ""}><b>4</b><span>Download<small>Verified ZIP</small></span></li>
        </ol>

        <input ref={pdfInputRef} className="split-rename-hidden-input" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void choosePdf(event.target.files?.[0] ?? null)} />
        <input ref={namesInputRef} className="split-rename-hidden-input" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event: ChangeEvent<HTMLInputElement>) => void chooseNames(event.target.files?.[0] ?? null)} />

        {inspection === null ? (
          <button className="split-rename-drop" type="button" disabled={isBusy} onClick={() => pdfInputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void choosePdf(event.dataTransfer.files[0] ?? null); }}>
            <span aria-hidden="true">PDF</span><strong>{isBusy ? progress?.message ?? "Reading your PDF…" : "Drop your source PDF here"}</strong><p>Choose the large document that contains the records you need to separate.</p><i>Choose PDF</i><small>Up to 100 MB and 300 pages · processed entirely in this tab</small>
          </button>
        ) : (
          <div className="split-rename-app">
            <header className="split-rename-filebar"><div><span>PDF</span><div><strong>{inspection.fileName}</strong><small>{inspection.pageCount} pages · {formatBytes(inspection.byteLength)}</small></div></div><button type="button" onClick={startOver}>Start over</button></header>

            <div className="split-rename-config">
              <section>
                <span className="split-rename-section-number">1</span><div><h2>Configure splitting</h2><p>Every source page must belong to exactly one group.</p></div>
                <div className="split-rename-mode"><button type="button" className={mode === "fixed" ? "is-selected" : ""} onClick={() => { setMode("fixed"); applyFixedSize(pagesPerGroup); }}><b>Every N pages</b><small>Best for equal-length records</small></button><button type="button" className={mode === "ranges" ? "is-selected" : ""} onClick={() => { setMode("ranges"); setGroups([]); setAssignments([]); clearDownload(); }}><b>Manual ranges</b><small>For unequal document lengths</small></button></div>
                {mode === "fixed" ? <label className="split-rename-field"><span>Pages per output PDF</span><input aria-label="Pages per output PDF" type="number" min="1" max={inspection.pageCount} value={pagesPerGroup} onChange={(event) => applyFixedSize(Math.max(1, Number(event.target.value) || 1))} /></label> : <label className="split-rename-field"><span>Nonoverlapping page ranges</span><div><input aria-label="Page ranges" type="text" value={ranges} onChange={(event) => { setRanges(event.target.value); setGroups([]); setAssignments([]); clearDownload(); }} placeholder="1-3, 4-6, 7-9" /><button type="button" onClick={applyRanges}>Apply</button></div></label>}
                <p className="split-rename-summary"><b>{groups.length}</b> output groups <span>·</span> <b>{groups.reduce((sum, group) => sum + group.pageIndexes.length, 0)}</b> of {inspection.pageCount} pages assigned</p>
              </section>

              <section>
                <span className="split-rename-section-number">2</span><div><h2>Import filenames</h2><p>Choose the exact CSV column or use one name per TXT line.</p></div>
                {imported === null ? <button type="button" className="split-rename-import" onClick={() => namesInputRef.current?.click()}><span>CSV / TXT</span><b>Choose filename list</b><small>No list data leaves this browser.</small></button> : <div className="split-rename-imported"><header><div><strong>{imported.fileName}</strong><small>{imported.names.length} filename rows</small></div><button type="button" onClick={() => namesInputRef.current?.click()}>Replace</button></header>{!imported.fileName.toLocaleLowerCase("en").endsWith(".txt") ? <><label><input type="checkbox" checked={imported.hasHeader} onChange={(event) => reparseImported(event.target.checked)} /> First row contains column headings</label><label className="split-rename-field"><span>Filename column</span><select aria-label="Filename column" value={imported.columnIndex} onChange={(event) => chooseColumn(Number(event.target.value))}>{imported.table.columns.map((column, index) => <option value={index} key={`${column}-${index}`}>{column}</option>)}</select></label></> : null}</div>}
              </section>
            </div>

            {inspection.hasSignatures ? <p className="split-rename-warning"><strong>Digital signature warning:</strong> splitting creates new PDFs and may invalidate signatures from the source document.</p> : null}
            {(inspection.byteLength >= 50 * 1024 * 1024 || groups.length >= 100) ? <p className="split-rename-warning"><strong>Large batch:</strong> keep this tab open. PDFMech yields between files, but available browser memory still determines whether this batch can finish.</p> : null}

            <section className="split-rename-review" aria-labelledby="split-rename-review-title">
              <header><div><span className="split-rename-section-number">3</span><div><h2 id="split-rename-review-title">Review every association</h2><p>The preview, source pages, imported row, and final filename must describe the same record.</p></div></div><span className={planReady ? "is-ready" : "is-blocked"}>{planReady ? "All checks passed" : groups.length < 2 ? "Create at least 2 groups" : `${validation?.issues.length ?? 0} issue${validation?.issues.length === 1 ? "" : "s"} to resolve`}</span></header>
              <div className="split-rename-review-list">
                {groups.map((group, groupIndex) => {
                  const assignment = assignments[groupIndex];
                  const normalized = normalizePdfFilename(assignment?.filename ?? "");
                  const groupIssues = validation?.issues.filter((issue) => issue.groupIndex === groupIndex) ?? [];
                  const isPartial = mode === "fixed" && group.pageIndexes.length < pagesPerGroup;
                  return <article className={groupIssues.length === 0 ? "is-valid" : "is-invalid"} key={`${group.label}-${groupIndex}`}>
                    <figure><img src={thumbnailUrls[group.pageIndexes[0] ?? 0]} alt={`First page of group ${groupIndex + 1}`} /><figcaption>Group {groupIndex + 1}</figcaption></figure>
                    <div className="split-rename-range"><small>Source pages</small><strong>{group.label}</strong><span>{group.pageIndexes.length} page{group.pageIndexes.length === 1 ? "" : "s"}{isPartial ? " · partial final group" : ""}</span></div>
                    <label><span>Assigned filename row</span><select aria-label={`Filename row for group ${groupIndex + 1}`} value={assignment?.sourceRowIndex ?? "manual"} onChange={(event) => assignRow(groupIndex, event.target.value === "manual" ? null : Number(event.target.value))}><option value="manual">Manual / unresolved</option>{imported?.names.map((name, rowIndex) => <option key={rowIndex} value={rowIndex}>Row {rowIndex + 1}: {name || "(blank)"}</option>)}</select></label>
                    <label><span>Output filename</span><input aria-label={`Output filename for group ${groupIndex + 1}`} value={assignment?.filename ?? ""} onChange={(event) => updateFilename(groupIndex, event.target.value)} placeholder="Employee name or document ID" /><small>{normalized.filename !== "" && normalized.changed ? `Exports safely as ${normalized.filename}` : normalized.filename}</small></label>
                    <div className="split-rename-row-actions"><button type="button" disabled={groupIndex === 0} onClick={() => moveAssignment(groupIndex, -1)} aria-label={`Move group ${groupIndex + 1} filename up`}>↑</button><button type="button" disabled={groupIndex === groups.length - 1} onClick={() => moveAssignment(groupIndex, 1)} aria-label={`Move group ${groupIndex + 1} filename down`}>↓</button></div>
                    <div className="split-rename-status">{groupIssues.length === 0 ? <span>✓ Ready</span> : groupIssues.map((issue) => <span key={`${issue.code}-${issue.message}`}>! {issue.message}</span>)}</div>
                  </article>;
                })}
              </div>
            </section>

            {unusedRows.length > 0 ? <section className="split-rename-unused"><h2>Unused imported rows</h2><p>Every unused row must be assigned above or explicitly ignored. Ignoring never shifts another mapping.</p><div>{unusedRows.map(({ name, rowIndex }) => <label key={rowIndex}><input type="checkbox" checked={ignoredRows.has(rowIndex)} onChange={() => toggleIgnoredRow(rowIndex)} /><span><b>Row {rowIndex + 1}</b>{name || "(blank)"}</span><em>{ignoredRows.has(rowIndex) ? "Ignored" : "Needs decision"}</em></label>)}</div></section> : null}

            <section className="split-rename-export">
              <div><h2>Export integrity check</h2><p>{planReady ? `Ready to create ${groups.length} PDFs. Every source page and filename mapping is accounted for.` : "Export remains locked until at least two complete groups exist and every mapping, page range, and filename conflict is resolved."}</p><label><input type="checkbox" checked={includeManifest} onChange={(event) => { setIncludeManifest(event.target.checked); clearDownload(); }} /> Include CSV manifest with source pages and verification status</label></div>
              <button type="button" disabled={!canExport} onClick={() => void generate()}>{isBusy ? progress?.message ?? "Generating locally…" : `Generate ${groups.length} PDFs + ZIP`}</button>
              {isBusy ? <button type="button" className="split-rename-cancel" onClick={() => abortRef.current?.abort()}>Cancel processing</button> : null}
            </section>
          </div>
        )}

        {error !== null ? <p className="split-rename-error" role="alert"><strong>Could not continue.</strong> {error}{/password/i.test(error) ? <> If you are authorized to open it, use <a href="/unlock-pdf">Unlock PDF</a> first.</> : null}</p> : null}

        {download !== null ? <section className="split-rename-result" aria-labelledby="split-rename-result-title"><span aria-hidden="true">✓</span><div><h2 id="split-rename-result-title">Batch created and verified</h2><p>{download.outputCount} named PDFs contain {download.pageCount} verified source pages. The ZIP was reopened and checked before this success message appeared.</p><div><a href={download.zipUrl} download={download.zipDownloadName}>Download verified ZIP</a>{download.manifestUrl !== undefined ? <a href={download.manifestUrl} download={download.manifestDownloadName}>Download CSV manifest</a> : null}</div><details><summary>Download individual PDFs</summary>{download.files.map((output, index) => <a key={output.downloadName} href={download.fileUrls[index]} download={output.downloadName}>{output.downloadName}<small>Pages {output.sourcePageIndexes.map((page) => page + 1).join(", ")}</small></a>)}</details></div></section> : null}
      </section>

      <section className="split-rename-benefits"><article><b>Visual matching</b><p>Compare the first source page, range, imported row, and final filename in one review list.</p></article><article><b>No silent reassignment</b><p>Missing and extra rows are explicit. A gap never pushes every later name onto the wrong document.</p></article><article><b>Local and verified</b><p>PDF bytes, filenames, and previews stay in this tab. Outputs and ZIP entries are validated before success.</p></article></section>
      <section className="split-rename-copy"><h2>How to split and rename a PDF in bulk</h2><ol><li>Choose the source PDF from your device.</li><li>Split it every N pages or enter complete, nonoverlapping ranges.</li><li>Import a CSV or TXT file and select the filename column.</li><li>Review each visual document-to-filename association and resolve every warning.</li><li>Create the files locally, then download the verified ZIP and optional manifest.</li></ol><h2>Designed to prevent batch naming mistakes</h2><p>PDFMech blocks export when a group has no name, two normalized filenames collide, source pages overlap or are missing, or an imported row has not been assigned or deliberately ignored.</p><h2>Private browser-based processing</h2><p>The source document, page previews, imported filename data, generated PDFs, and manifest remain in your browser. They are not sent to PDFMech analytics or an editing server.</p><h2>Current browser limits</h2><p>This release supports PDFs up to 100 MB and 300 pages, with up to {SMART_SPLIT_MAX_OUTPUTS} output files per batch. Actual capacity depends on available device memory. Keep the tab open while a large batch is being generated.</p><nav aria-label="Related PDF tools"><a href="/split-pdf">Simple Split PDF</a><a href="/merge-pdf">Merge PDF</a><a href="/extract-pdf-pages">Extract PDF pages</a><a href="/unlock-pdf">Unlock PDF</a></nav></section>
    </main>
  );
}

function defaultRanges(pageCount: number): string {
  const midpoint = Math.ceil(pageCount / 2);
  return `1-${midpoint}, ${midpoint + 1}-${pageCount}`;
}

function revokeDownload(download: SplitRenameDownload | null): void {
  if (download === null) return;
  URL.revokeObjectURL(download.zipUrl);
  download.fileUrls.forEach((url) => URL.revokeObjectURL(url));
  if (download.manifestUrl !== undefined) URL.revokeObjectURL(download.manifestUrl);
}

function formatBytes(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function messageFromError(error: unknown): string { return error instanceof Error ? error.message : "The batch could not be prepared. Please try another file."; }
