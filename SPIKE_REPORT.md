# Disposable Technical Spike Report

Status: Approved  
Phase: 4 — Disposable technical spike  
Test date: 2026-07-30
Approved by: Project owner  
Approval date: 2026-07-30

## 1. Goal

Test whether the approved browser-local approach can:

- Open PDF bytes from a local file
- Render pages through PDF.js
- Keep edit geometry independent of zoom
- Add text and visual whiteout overlays
- Export those edits with `pdf-lib`
- Reopen and render changed pages with a fresh PDF.js parser
- Download only after validation
- Avoid transmitting document data
- Fail safely for malformed input

The spike is disposable. Passing results validate technical assumptions; they do not make this code the production foundation.

## 2. Implemented experiment

The spike provides:

- Local PDF file selection
- PDF.js worker rendering
- Page navigation
- Canonical edit coordinates measured in PDF points
- Zoom levels from 50% through 200%
- Add-text overlay
- Visual whiteout overlay
- Drag repositioning
- Multi-page edits
- `pdf-lib` export
- Fresh PDF.js parse, page-count check, and changed-page render validation
- Download only after successful validation
- Explicit clear-from-memory action
- File-size and page-count ceilings
- Malformed-file rejection

The experiment deliberately excludes React, cloud storage, accounts, recovery, forms, signatures, OCR, and production styling.

## 3. Pinned dependencies

| Dependency | Version | Role |
|---|---:|---|
| `pdfjs-dist` | 6.2.108 | Parsing, worker rendering, fresh validation |
| `pdf-lib` | 1.17.1 | Experimental export |
| Vite | 8.2.0 | Local development and production build |
| TypeScript | 7.0.2 | Static checking |
| Vitest | 4.1.10 | Geometry tests |
| Playwright | 1.62.0 | Browser workflow and privacy tests |

The lockfile fixes the full dependency graph. The installation audit reported zero known vulnerabilities on 2026-07-30. This is point-in-time evidence, not a permanent security guarantee.

## 4. Purpose-built fixtures

`tests/fixtures/representative.pdf` contains four pages:

1. US Letter portrait
2. Landscape page
3. Page with intrinsic 90-degree rotation
4. Page with an offset crop box inside a larger media box

`tests/fixtures/malformed.pdf` is intentionally invalid.

The fixture generator is committed under `scripts/generate-fixtures.mjs`; private user files are not used.

## 5. Automated evidence

### 5.1 Geometry tests

Command:

```text
npm test
```

Result:

```text
1 test file passed
7 tests passed
```

Covered:

- Identity transform
- Bottom-left PDF to top-left canonical transform
- Quarter-turn transforms with offsets
- Forward/inverse round trips
- Singular-matrix rejection
- Non-finite-coordinate rejection
- Frame-corner transformation before bounds calculation

### 5.2 Browser workflow tests

Command:

```text
npm run test:e2e
```

Result:

```text
6 tests passed
```

The two workflows ran in each of:

- Playwright Chromium
- Playwright Firefox
- Playwright WebKit

Full workflow evidence:

- Opened the four-page PDF through the browser file input.
- Added private-canary text on the portrait page.
- Added a whiteout on the portrait page.
- Changed zoom from 100% to 150%.
- Verified overlay CSS placement scaled by 1.5 within 0.005 CSS pixels.
- Dragged the text 30 × 18 CSS pixels at 150% zoom and verified the stored canonical movement reported by the interface was 20 × 12 PDF points.
- Added text to the intrinsically rotated page.
- Added whiteout to the offset-crop page.
- Exported and downloaded locally.
- Fresh PDF.js validation parsed all four pages and rendered all three changed pages.
- A second parser (`pdf-lib` in the test process) reopened the download.
- Output retained four pages.
- Page 3 retained intrinsic 90-degree rotation.
- Page 4 retained its `x=40`, `y=80`, `width=560`, `height=720` crop box.
- The source fixture SHA-256 remained identical.

Malformed workflow evidence:

- The invalid local fixture produced an error state.
- Export remained disabled.

### 5.3 Privacy canary

The browser test used:

- Filename canary: `PRIVATE_FILENAME_CANARY.pdf`
- Text canary: `PRIVATE_TEXT_CANARY`

Every browser request URL, header collection, and request body observed during the complete workflow was serialized and checked. Neither canary appeared. No observed request carried a request body.

This proves the tested workflow did not upload those values. It does not replace later production network-policy and telemetry audits.

### 5.4 Static and build evidence

Command:

```text
npm run build
```

Passed:

- Strict TypeScript checking
- Vite production compilation
- PDF.js worker asset emission

Observed production assets:

- PDF.js worker: approximately 1.26 MB uncompressed
- Main JavaScript: approximately 859 KB uncompressed / 307 KB gzip
- CSS: approximately 2.5 KB uncompressed

Vite warned that the main bundle exceeds 500 KB. This is accepted for the disposable spike and recorded as a production concern requiring lazy loading/code splitting.

## 6. Requirement evidence matrix

| Requirement | Result | Evidence |
|---|---|---|
| Browser-local opening | Pass | File-input workflow in three browser engines |
| PDF.js worker rendering | Pass | Four fixture pages render through emitted worker |
| Canonical zoom independence | Pass for tested case | 100% to 150% overlay scale assertion |
| Text overlay | Pass | Portrait and rotated-page workflow |
| Whiteout overlay | Pass | Portrait and offset-crop workflow |
| Drag support | Pass | Automated drag at 150% zoom proves screen-to-canonical scaling |
| `pdf-lib` export | Pass for fixture | Four-page exported download reopens |
| Fresh PDF.js validation | Pass | All changed pages render before download |
| Original immutability | Pass | Source SHA-256 unchanged |
| No document upload | Pass for observed workflow | Filename/text canaries absent; no request bodies |
| Malformed-file safety | Pass for fixture | Error displayed and export disabled |
| Rotated-page preservation | Pass for fixture | Rotation value remains 90 degrees |
| Crop-box preservation | Pass for fixture | Crop box matches exact expected values |
| QPDF structural validation | Not tested | QPDF is not installed locally |
| Strict production CSP | Not tested | Spike ran through Vite development server |
| Physical Safari | Not tested | Playwright WebKit is not Safari hardware |
| Large-file performance | Not tested | Current fixture is intentionally small |
| Existing-feature preservation | Partially tested | Page count, rotation, and crop box only |
| Encrypted and signed PDFs | Not tested in this spike | Need licensed/purpose-built fixtures and safe capability handling |
| AcroForm preservation/filling | Not tested | Deferred to broader corpus phase |
| IndexedDB recovery | Not applicable | Excluded from disposable spike |

## 7. Findings

### Confirmed

1. PDF.js and `pdf-lib` can coexist in a browser-built application.
2. Local bytes can flow from file input to rendering and export without an application document request.
3. PDF.js viewport matrices provide a credible basis for canonical-to-PDF conversion, including the tested intrinsic rotation and crop offset.
4. Keeping overlays separate from the base page makes zoom changes independent of document state.
5. Fresh-parser rendering can gate downloads.
6. The same workflow behaves consistently in Playwright Chromium, Firefox, and WebKit.
7. Malformed input can fail without enabling export.

### Risks confirmed

1. The PDF stack produces a large initial bundle without code splitting.
2. PDF.js may log warnings such as object indexing during parsing; production logging must be intercepted and sanitized rather than forwarded.
3. The browser briefly holds original, parser, generated, and validation byte copies; large-file memory behavior remains unknown.
4. `pdf-lib` still carries the maintenance risk documented in Phase 2.
5. Structural reopening does not prove preservation of every PDF feature.

## 8. Interpretation of Phase 2 spike questions

| Question | Current answer |
|---|---|
| Worker rendering under proposed CSP | Worker rendering passes; strict CSP remains untested |
| One-point placement through rotation/crop/zoom | Matrix and zoom evidence passes; pixel-level exported placement measurement remains for the corpus phase |
| Text, whiteout, image, form, and page operations | Text and whiteout pass; image, form, and page operations remain untested |
| Which source features change during save | Page count, rotation, and crop survive; systematic preservation study remains |
| Memory/timing at specified sizes | Not tested |
| Fresh PDF.js and QPDF validation | Fresh PDF.js passes; QPDF unavailable |
| No document data in traffic/logs | Network canary passes; production log/telemetry canaries remain |
| Encrypted, signed, malformed, XFA, oversized | Malformed passes; other cases remain |
| IndexedDB recovery | Not part of spike |
| Browser matrix | Automated engines pass on Windows; physical browsers/devices remain |
| Oversized-image and canvas ceilings | Limits configured; boundary fixtures remain |
| Executable PDF actions | Custom UI does not expose execution; dedicated hostile fixtures remain |

## 9. Go/no-go recommendation

Recommendation: **go to the broader corpus and limitation-testing phase, but do not approve the stack for production yet.**

The core local workflow has enough evidence to justify continued testing. Production approval remains gated by:

- Quantitative export-placement checks
- QPDF CI validation
- Feature-preservation corpus results
- Large-file memory and timing measurements
- Encrypted, signed, XFA, form, and resource-boundary behavior
- Strict CSP testing
- Physical-browser/device testing
- A production decision on the stale `pdf-lib` dependency

## 10. Approved decisions

1. Accept the disposable spike as evidence that the core local workflow is feasible.
2. Do not reuse spike code automatically; production code remains a separate decision.
3. Retain PDF.js 6.2.108 as the rendering candidate for the next test phase.
4. Retain `pdf-lib` 1.17.1 only as a conditional experimental exporter.
5. Proceed to the representative corpus and limitation-testing phase.
6. Carry every “not tested” item in Section 6 forward; none may be silently treated as passed.

## 11. Phase 4 completion gate

Phase 4 is complete only when:

- The spike builds successfully.
- Geometry tests pass.
- Browser workflows pass in Chromium, Firefox, and WebKit.
- Privacy canary checks pass.
- Results and limitations are documented.
- The go/no-go recommendation is approved.
- The decisions in Section 10 are approved.

Approval recorded on 2026-07-30. All Phase 4 completion conditions are satisfied.
