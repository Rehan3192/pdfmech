# Product Specification

Status: Approved  
Phase: 1 — Product definition  
Working title: PDF Editor  
Last updated: 2026-07-30
Approved by: Project owner  
Approval date: 2026-07-30

## 1. Product goal

Create a trustworthy, privacy-first web application that lets people make common PDF edits directly in their browser without uploading the document, creating an account, receiving a watermark, or encountering a download paywall.

The first release will prioritize dependable everyday editing over claiming feature parity with desktop publishing or professional prepress software.

## 2. Target users

### Primary users

People who occasionally need to edit a PDF quickly:

- Students completing or correcting documents
- Job seekers editing applications and forms
- Freelancers preparing client documents
- Office workers making small document corrections
- Individuals signing, annotating, or organizing personal documents

### Initial usage environment

- Desktop and laptop browsers are the primary editing environment.
- Mobile browsers support opening, filling, signing, and light annotation.
- Full mobile layout editing is desirable but is not a Version 1 launch requirement.

## 3. User problem

Many users need a small number of PDF operations but do not want to:

- Purchase a recurring subscription
- Create an account
- Upload confidential documents
- Discover a paywall only after editing
- Install a desktop application
- Receive a watermarked result

## 4. Product promise

Proposed public promise:

> Edit PDFs privately in your browser. No upload, account, watermark, or download paywall.

This promise is a product constraint, not merely marketing language.

## 5. Core principles

1. Documents remain on the user's device by default.
2. Essential editing and downloading are genuinely free.
3. The original file is never overwritten.
4. The product describes limitations honestly.
5. Unsupported documents fail safely and visibly.
6. Editing actions are reversible until export.
7. Exported files are checked before being offered for download.
8. Accessibility and keyboard operation are built into the interaction model.
9. Analytics must never receive document contents, filenames, entered text, or signatures.
10. Optional future cloud features must remain separate from local editing.

## 6. Version 1 scope

### 6.1 File handling

- Open a PDF using a file picker or drag and drop.
- Validate the file type and parseability locally.
- Display page thumbnails and the selected page.
- Support PDFs containing pages of different dimensions and rotations.
- Download the edited result as a new file.
- Clear the active document and its locally saved recovery data.

### 6.2 Content additions

- Add text.
- Change added text's font family, size, color, and alignment.
- Move, resize, duplicate, and delete added objects.
- Add whiteout rectangles for visual replacement.
- Add images.
- Add checkmarks and basic shapes.

### 6.3 Annotation

- Highlight an area.
- Draw freehand strokes.
- Add a visual signature by drawing, typing, or selecting an image.

### 6.4 Forms

- Detect and fill supported standard PDF form fields.
- Preserve filled values in the exported document.
- Clearly report unsupported form technologies.

### 6.5 Page organization

- Reorder pages.
- Rotate pages.
- Duplicate pages.
- Delete pages.
- Add pages from another PDF.

### 6.6 Editing workflow

- Select and manipulate editable objects.
- Undo and redo supported operations.
- Zoom without changing edit placement.
- Warn about unsaved work before destructive navigation.
- Recover an interrupted local session when technically possible.

## 7. Explicit non-goals for Version 1

Version 1 will not promise:

- Full paragraph reflow comparable to a word processor
- Reliable native editing of every existing PDF text object
- Editing of every embedded font
- OCR for scanned documents
- Conversion between PDF and Word, Excel, or PowerPoint
- Cryptographic digital signatures
- Preservation of an existing digital signature after modification
- Real-time collaboration
- Cloud document storage or cross-device synchronization
- Batch processing
- Professional prepress, color-separation, or print-production tools
- Guaranteed repair of corrupted PDFs
- Support for dynamic XFA forms

Visual text replacement in Version 1 means covering existing content and placing new text above it. The interface must not misrepresent this as native paragraph editing.

## 8. Privacy requirements

- PDF bytes must not be transmitted to an application server during local editing.
- All rendering and Version 1 editing operations must run on the user's device.
- Local recovery must use browser storage and be clearly disclosed.
- The user must be able to disable recovery and clear saved data.
- Recovery data must expire automatically after a documented period.
- Error reporting must exclude document bytes, filenames, text, form values, and signatures.
- Third-party scripts must not be able to inspect the editor's document state.
- Advertising scripts, if ever used, must not run inside the editor application.
- Network behavior must be testable so the local-processing claim can be verified.

## 9. Security and document-integrity requirements

- Treat every opened PDF as untrusted input.
- Process expensive work outside the main interface thread where practical.
- Set resource limits for file size, page count, dimensions, and render scale.
- Display a clear warning before editing a digitally signed document.
- Explain that modifying a signed PDF normally invalidates its existing signature.
- Never overwrite the user's original file.
- Reopen or parse-check the generated result before enabling download.
- Preserve document features when supported; warn when an export may discard them.
- Do not silently export a blank, incomplete, or known-invalid document.

## 10. Version 1 acceptance criteria

The release is acceptable only when all of the following are true:

1. At least 95% of supported documents in the approved launch test corpus can be opened, edited, exported, and reopened successfully.
2. Network inspection records zero requests containing PDF bytes, filenames, entered document text, form values, drawings, or signatures during the complete local-editing workflow.
3. Added objects differ from their intended exported position by no more than 1 PDF point at tested zoom levels from 25% through 400%.
4. The placement requirement passes on portrait, landscape, rotated, and mixed-size pages in every supported browser.
5. Every Version 1 editing command passes automated undo and redo tests, including a sequence of at least 100 consecutive reversible commands.
6. Page reorder, rotation, duplication, insertion, and deletion produce the expected page count, order, dimensions, and rotations in 100% of the page-operation test fixtures.
7. Values entered into supported standard form fixtures remain correct after export and reopening.
8. The original file's SHA-256 digest is identical before and after editing.
9. Every enabled browser export passes local reopening and changed-page render checks with a fresh PDF.js instance before download. Every controlled release-corpus export additionally passes QPDF structural validation in CI and reopens in every supported browser.
10. With recovery enabled, refreshing during an editing session restores the latest confirmed local checkpoint; the user can delete that recovery data and verify that it is absent.
11. Signed, encrypted, malformed, oversized, and explicitly unsupported test fixtures produce distinct messages and never silently generate a damaged download.
12. The complete main workflow is operable without a pointing device and meets the applicable WCAG 2.2 Level AA success criteria.
13. The latest stable and previous major versions of Chrome, Edge, Firefox, and Safari pass the launch compatibility suite. Exact versions will be recorded at each release.
14. On the reference mid-range test device selected during Phase 2, a supported 25-page, 20 MB document becomes interactively usable within 5 seconds after local file reading completes.
15. During the reference performance test, the editor remains responsive and no single main-thread task caused by our application exceeds 200 milliseconds under normal interaction.
16. A user can complete the main workflow and download the result without creating an account, paying, or receiving a watermark.
17. No test document's contents appear in application logs, analytics, crash reports, or error-report payloads.

The initial supported-document limits are proposed as 100 MB and 500 pages. Phase 4 must validate these limits on agreed reference devices. Any change requires a documented decision containing test evidence and user-facing behavior; limits may not change silently.

### 10.1 Launch test corpus

Before implementation is considered releasable, the corpus must include licensed or purpose-built fixtures for:

- Plain text and image PDFs
- Portrait, landscape, rotated, and mixed-size pages
- Embedded, subsetted, standard, and unsupported fonts
- AcroForm text fields, checkboxes, radio buttons, dropdowns, and unsupported forms
- Scanned documents
- Password-protected documents with and without a supplied password
- Digitally signed documents
- Malformed and truncated documents
- Documents at, below, and above supported size and page-count limits
- Documents containing links, bookmarks, attachments, annotations, and metadata

The corpus manifest must record the expected result for every fixture. Private user documents must never be added to the repository or test corpus.

## 11. Proposed business model

The local editor and essential downloads remain free.

Potential later revenue:

- Donations or voluntary support
- Carefully separated advertising on public landing pages
- Optional encrypted cloud storage
- Cross-device synchronization
- Team workspaces and shared review
- Reusable organization templates
- Batch workflows

No future paid feature may retroactively break the Version 1 public promise.

## 12. Success measures

Privacy-respecting aggregate measures may include:

- Percentage of editor sessions that reach a successful local export
- Export failure categories that contain no document data
- Time from opening a file to first completed export
- Rate of recovery from a previous local session
- Browser and device performance categories
- Voluntary user satisfaction and issue reports

Page views and sign-ups alone are not sufficient measures of product quality.

## 13. Principal risks

- PDFs vary widely and may contain unusual structures, fonts, forms, or security settings.
- Browser memory limits can make large documents unstable.
- Visual replacement may disappoint users expecting word-processor behavior.
- Export can unintentionally discard unsupported document features.
- A dependency can become unmaintained or change licensing.
- Privacy claims can be undermined by unrelated third-party scripts.
- Mobile browsers may not support comfortable full-document editing.

Each risk must have a tested mitigation or an explicit product limitation before launch.

## 14. Approved decisions

1. Use individuals with occasional PDF-editing needs as the initial audience.
2. Make desktop browsers the primary Version 1 editing target.
3. Keep essential local editing and downloading free without accounts or watermarks.
4. Ship visual text replacement before attempting native existing-text editing.
5. Exclude OCR, cloud accounts, collaboration, and Office conversion from Version 1.
6. Allow future paid convenience features without restricting the free local editor.

## 15. Phase 1 completion gate

Phase 1 is complete only when:

- The product goal and public promise are approved.
- The target users are approved.
- Version 1 inclusions and exclusions are approved.
- Privacy principles are approved.
- The proposed business-model boundary is approved.
- Any requested changes are incorporated into this document.

Approval recorded on 2026-07-30. All Phase 1 completion conditions are satisfied.
