# Phase 9 Production Page Rendering

Status: Approved
Phase: 9 - Production page rendering
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Render real PDF pages in the production app through the approved `PdfRenderer`
port and lazy PDF.js infrastructure boundary.

This phase makes the production app visually useful without importing PDF.js
into app, domain, presentation, shared, or the production entry.

## 2. Scope

Phase 9 establishes:

- `renderDocumentPage()` as the app-layer page-rendering use case;
- retained PDF.js source state inside the infrastructure adapter after
  successful inspection;
- `disposeSource()` cleanup for retained PDF.js loading tasks;
- an app-layer `closeLocalDocument()` use case that releases retained sources;
- production `renderPage()` implementation returning an `ImageBitmap`;
- production UI that renders the selected page into a canvas;
- page-card selection that re-renders through the app-layer use case;
- browser test coverage for a visible, nonblank rendered PDF canvas;
- continued privacy canary checks during the production open/render workflow;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 9 does not implement production editing overlays, export, thumbnails in
the UI, recovery, command history, page organization, or zoom controls. Those
remain later phases.

## 4. Verification Gate

Phase 9 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Production browser test opens `representative.pdf`, renders page 1, and
  verifies nonblank canvas pixels.
- Production browser privacy canaries still pass.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/ports/presentation/shared remain free of `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  7 test files passed, 20 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-CN6jIiDj.js               198.11 kB, gzip 62.64 kB
  dist/assets/browser-renderer-BG_Poacx.js    430.47 kB, gzip 128.65 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-CN6jIiDj.js
  pdf-engine: browser-renderer-BG_Poacx.js

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

Project-owner approval was recorded on 2026-08-01. All Phase 9 completion
conditions are satisfied.
