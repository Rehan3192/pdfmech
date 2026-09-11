# Phase 16 Production Text Appearance Editing

Status: Approved
Phase: 16 - Production text appearance editing
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Add controlled editing for selected text-object appearance without leaking
document content or style-edit data to network requests and without touching PDF
bytes.

This phase adds selected-text controls for font family, font size, color, and
horizontal alignment. Draft control changes remain UI state until Apply commits
one immutable domain state transition.

## 2. Scope

Phase 16 establishes:

- pure `updateTextObjectAppearance()` domain command;
- supported font-family validation for Helvetica, Times, and Courier;
- supported horizontal-alignment validation for left, center, and right;
- bounded font-size validation;
- RGB color channel and alpha validation;
- immutable text appearance updates with document revision and `updatedAt`
  changes;
- no-op behavior when submitted appearance matches the selected text object;
- unchanged text content, frame, page, and z-order during appearance updates;
- selected text-object appearance controls in the production toolbar;
- explicit Apply action for one committed document revision per style edit;
- overlay rendering from stored text appearance fields;
- browser coverage proving font family, size, color, and alignment render in
  the overlay;
- preserved create, text-content edit, move, resize, delete, zoom, and privacy
  behavior;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 16 does not implement bold, italic, line spacing controls, multiline text
layout, font embedding, font fallback inspection, inline canvas editing,
undo/redo, persistence, export, or PDF byte modification. It only updates and
renders the appearance fields already present on production text objects.

## 4. Verification Gate

Phase 16 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Domain tests prove text appearance updates mutate immutable document state,
  revision, and `updatedAt` without changing text, frame, or z-order.
- Production browser test opens `representative.pdf`, creates a text object,
  edits its content, updates font family, font size, color, and alignment,
  verifies computed overlay styles, zooms, moves, resizes, and deletes it.
- Production browser privacy canaries prove filename, user-entered text, and
  style color data do not appear in captured request evidence.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/presentation test layers remain free of direct `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  10 test files passed, 37 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-DzrwUFiQ.js               213.37 kB, gzip 66.56 kB
  dist/assets/browser-renderer-D1o8Dxap.js    430.20 kB, gzip 128.53 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-DzrwUFiQ.js
  pdf-engine: browser-renderer-D1o8Dxap.js

rg "pdfjs-dist|pdf-lib" src/domain src/app src/presentation tests/domain tests/app tests/presentation
  no direct PDF engine imports found in those layers

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/production-open.spec.ts --project=chromium
  1 Chromium production browser test passed

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/local-edit.spec.ts --project=chromium
  2 preserved-spike Chromium browser tests passed on /spike.html
```

The production browser test now verifies that a selected text object can be
styled as Courier, 24 pt, `#ff0033`, and center-aligned, and that the overlay's
computed style reflects those stored domain values.

The same production browser test also verifies that captured request evidence
does not contain `PRIVATE_FILENAME_CANARY`, `PRIVATE_TEXT_CANARY`, or the edited
style color marker.

The default bundled Playwright browser executables still fail to launch in this
local Windows environment with `spawn UNKNOWN` before reaching the application.
The Chromium evidence above uses installed system Chrome through the configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override.

Project-owner approval was recorded on 2026-08-01. All Phase 16 completion
conditions are satisfied.
