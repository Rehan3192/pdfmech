# Phase 19 Export Snapshot Foundation

Status: Approved
Phase: 19 - Export snapshot foundation
Date: 2026-08-11
Approved by: Project owner
Approval date: 2026-08-12

## 1. Goal

Create the first production export foundation without generating PDF bytes yet.

This phase adds a pure application-layer snapshot builder that converts
immutable `EditorDocument` state into a deterministic `ExportSnapshot`. Future
export code will consume this snapshot instead of reading live UI state.

## 2. Scope

Phase 19 establishes:

- pure `createExportSnapshot()` application service;
- stricter `ExportSnapshot` port shape;
- page export entries with source page reference, geometry, and user rotation;
- source references that exclude original filenames;
- form-value and asset-reference inclusion;
- `objectsByPage` as ordered arrays, not unordered object maps;
- deterministic object ordering from `objectOrderByPage`;
- cloned edit objects in the snapshot so export data is isolated from later
  document mutations;
- validation for missing source documents;
- validation for missing objects in page z-order;
- validation for objects listed under the wrong page;
- validation for active objects missing from z-order;
- preserved production browser behavior;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 19 does not implement PDF byte generation, export workers, download UI,
export validation, PDF coordinate conversion, font embedding, image export,
form writing, or QPDF validation. It only creates the immutable snapshot
contract needed before those phases.

## 4. Verification Gate

Phase 19 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Snapshot unit tests prove sources, pages, form values, assets, and ordered
  page objects are captured deterministically.
- Snapshot unit tests prove original filenames are excluded from source export
  references.
- Snapshot unit tests prove exported objects are cloned away from mutable test
  references.
- Snapshot unit tests reject broken page/object z-order invariants.
- Production browser smoke still passes.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/presentation test layers remain free of direct `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-11:

```text
npm run test
  11 test files passed, 45 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-mjcYtvXP.js               216.33 kB, gzip 67.12 kB
  dist/assets/browser-renderer-CRTCoH_w.js    430.20 kB, gzip 128.53 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-mjcYtvXP.js
  pdf-engine: browser-renderer-CRTCoH_w.js

rg "pdfjs-dist|pdf-lib" src/domain src/app src/presentation tests/domain tests/app tests/presentation
  no direct PDF engine imports found in those layers

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/production-open.spec.ts --project=chromium
  1 Chromium production browser test passed

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/local-edit.spec.ts --project=chromium
  2 preserved-spike Chromium browser tests passed on /spike.html
```

The production export path is still intentionally disabled. The editor now has
the immutable snapshot boundary that a future exporter will use.

The default bundled Playwright browser executables still fail to launch in this
local Windows environment with `spawn UNKNOWN` before reaching the application.
The Chromium evidence above uses installed system Chrome through the configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override.

Project-owner approval was recorded on 2026-08-12. All Phase 19 completion
conditions are satisfied.
