# Phase 11 Production Overlay Coordinates

Status: Approved
Phase: 11 - Production overlay coordinate layer
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Place draft overlay objects above rendered PDF pages in canonical page
coordinates without modifying PDF bytes.

This phase proves the production app can translate browser pointer positions
into zoom-independent page coordinates, then render overlay objects back to the
screen at the current zoom. Export and persistent document mutations remain out
of scope.

## 2. Scope

Phase 11 establishes:

- a pure `overlay-coordinate-layer` app module;
- viewport-to-canonical coordinate conversion;
- canonical-frame-to-CSS display conversion;
- clamped draft text overlay creation;
- a positioned overlay layer above the rendered PDF canvas;
- click-to-place draft text overlays on the selected page;
- overlay display scaling when zoom changes;
- browser coverage proving overlay placement at 100% and proportional scaling
  at 150%;
- continued production privacy canary checks;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 11 does not implement real editing commands, selection handles, dragging,
text editing, undo/redo, persistence, export, redaction, or modifying PDF bytes.
Draft overlay objects are interface state only.

## 4. Verification Gate

Phase 11 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Production browser test opens `representative.pdf`, renders page 2, places a
  draft overlay in canonical coordinates, and proves its display coordinates
  scale at 150% zoom.
- Production browser privacy canaries still pass.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/ports/presentation/shared remain free of direct `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  9 test files passed, 26 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-RBUnHI7q.js               201.63 kB, gzip 63.77 kB
  dist/assets/browser-renderer-DJ68MWZT.js    430.20 kB, gzip 128.53 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-RBUnHI7q.js
  pdf-engine: browser-renderer-DJ68MWZT.js

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

Project-owner approval was recorded on 2026-08-01. All Phase 11 completion
conditions are satisfied.
