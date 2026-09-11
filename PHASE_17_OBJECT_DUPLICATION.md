# Phase 17 Production Object Duplication

Status: Approved
Phase: 17 - Production object duplication
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Add controlled duplication for selected production edit objects without touching
PDF bytes or leaking document content to network requests.

This phase adds a Duplicate action for the selected object. The duplicate gets a
fresh object ID, a canonical in-page offset frame, preserved content and
appearance, and deterministic z-order placement directly above the source
object.

## 2. Scope

Phase 17 establishes:

- pure `duplicateObject()` domain command;
- fresh object ID requirement with duplicate-ID rejection;
- immutable object duplication with document revision and `updatedAt` changes;
- preserved text content, frame-independent appearance fields, opacity,
  rotation, lock state, and page assignment;
- new `createdAtRevision` on the duplicated object;
- deterministic z-order insertion directly after the source object;
- canonical duplicate-frame helper with down-right offset and up-left fallback
  near page bounds;
- production Duplicate button for the selected object;
- automatic selection of the duplicated object;
- browser coverage proving duplicate offset, selected state, preserved text, and
  preserved style;
- preserved create, text-content edit, style edit, move, resize, delete, zoom,
  and privacy behavior;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 17 does not implement multi-select duplication, clipboard copy/paste,
cross-page duplication, keyboard shortcuts, undo/redo, persistence, export, or
PDF byte modification. It duplicates active production edit objects in the same
page only.

## 4. Verification Gate

Phase 17 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Coordinate tests prove duplicate frames are offset in canonical page space and
  fall back inside page bounds near bottom-right edges.
- Domain tests prove duplication creates a fresh object, preserves selected
  text content and appearance, updates revision and `updatedAt`, records the
  duplicate's `createdAtRevision`, and inserts it directly after the source in
  page z-order.
- Production browser test opens `representative.pdf`, creates a text object,
  edits text, edits appearance, duplicates it, verifies duplicate content,
  style, selected state, and offset, then zooms, moves, resizes, and deletes the
  duplicate while the original remains.
- Production browser privacy canaries still pass.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/presentation test layers remain free of direct `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  10 test files passed, 40 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-DqndgB3C.js               214.67 kB, gzip 66.84 kB
  dist/assets/browser-renderer-CfcrT3aD.js    430.20 kB, gzip 128.53 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-DqndgB3C.js
  pdf-engine: browser-renderer-CfcrT3aD.js

rg "pdfjs-dist|pdf-lib" src/domain src/app src/presentation tests/domain tests/app tests/presentation
  no direct PDF engine imports found in those layers

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/production-open.spec.ts --project=chromium
  1 Chromium production browser test passed

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/local-edit.spec.ts --project=chromium
  2 preserved-spike Chromium browser tests passed on /spike.html
```

The production browser test now verifies that a styled text object at
`120.0, 140.0 pt` duplicates to `136.0, 156.0 pt`, preserves the private edited
text and Courier / 24 pt / `#ff0033` / centered appearance, becomes selected,
and can then be moved, resized, and deleted independently while the source
object remains.

The default bundled Playwright browser executables still fail to launch in this
local Windows environment with `spawn UNKNOWN` before reaching the application.
The Chromium evidence above uses installed system Chrome through the configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override.

Project-owner approval was recorded on 2026-08-01. All Phase 17 completion
conditions are satisfied.
