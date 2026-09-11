# Phase 10 Production Navigation and Zoom

Status: Approved
Phase: 10 - Production navigation and zoom
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Make the production rendered PDF view usable with bounded zoom and page
navigation while preserving the approved PDF engine boundaries.

This phase keeps rendering behind the app-layer `renderDocumentPage()` use case
and the `PdfRenderer` port. The presentation layer controls page and zoom state
but does not import PDF.js or PDF export libraries.

## 2. Scope

Phase 10 establishes:

- approved zoom levels: 50%, 75%, 100%, 125%, 150%, and 200%;
- a tested `viewer-controls` module for zoom parsing, zoom labels, and bounded
  page index movement;
- previous and next page controls;
- selected page position display;
- page-card selection that remains synchronized with navigation buttons;
- re-rendering of the selected page at the selected zoom level;
- browser coverage proving page 2 renders and 150% zoom increases canvas size;
- continued production privacy canary checks;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 10 does not implement editing overlays, export, recovery, thumbnails in
the UI, keyboard shortcuts, fit-to-width, continuous scrolling, or page
organization. Those remain later phases.

## 4. Verification Gate

Phase 10 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Production browser test opens `representative.pdf`, renders page 1, navigates
  to page 2, and re-renders page 2 at 150% zoom.
- Production browser privacy canaries still pass.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/ports/presentation/shared remain free of `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  8 test files passed, 23 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-aF7Sd2dq.js               199.39 kB, gzip 63.00 kB
  dist/assets/browser-renderer-DsgOVUoR.js    430.47 kB, gzip 128.65 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-aF7Sd2dq.js
  pdf-engine: browser-renderer-DsgOVUoR.js

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/production-open.spec.ts --project=chromium
  1 Chromium production browser test passed

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/local-edit.spec.ts --project=chromium
  2 preserved-spike Chromium browser tests passed on /spike.html
```

The default bundled Playwright browser executables still fail to launch in this
local Windows environment with `spawn UNKNOWN` before reaching the application.
The Chromium evidence above uses installed system Chrome through the configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override.

Project-owner approval was recorded on 2026-08-01. All Phase 10 completion
conditions are satisfied.
