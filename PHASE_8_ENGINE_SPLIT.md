# Phase 8 PDF Engine Loading Split

Status: Approved
Phase: 8 - PDF engine loading split
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Keep the production app lightweight at startup by loading the PDF.js inspection
adapter only when a PDF operation needs it.

This phase preserves the approved app/domain/ports/infrastructure/presentation
boundaries and keeps the disposable spike available at `/spike.html`.

## 2. Scope

Phase 8 establishes:

- a lazy `PdfRenderer` wrapper in `src/infrastructure/pdfjs/lazy-renderer.ts`;
- production startup through `createLazyPdfRenderer()` instead of direct
  `createPdfJsRenderer()`;
- tests proving the PDF renderer loader is not called until a PDF operation;
- source tests proving the production entry has no eager PDF.js adapter import;
- a post-build verifier that checks the production entry and lazy PDF engine are
  separate chunks;
- continued production browser verification for local open and privacy canaries.

## 3. Non-Scope

Phase 8 does not change the production feature surface. Page rendering, editing,
export, recovery, thumbnails, command history, and page organization remain for
later phases.

## 4. Verification Gate

Phase 8 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build emits a separate lazy `browser-renderer` chunk.
- The startup `index` chunk does not contain eager PDF.js markers.
- The lazy PDF engine chunk contains the PDF.js worker marker.
- The production browser open workflow still passes with privacy canaries.
- App/domain/ports/presentation/shared remain free of `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  5 test files passed, 17 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-ByS0Zeug.js             196.26 kB, gzip 62.06 kB
  dist/assets/browser-renderer-BjJ3N1Ky.js  428.97 kB, gzip 128.38 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-ByS0Zeug.js
  pdf-engine: browser-renderer-BjJ3N1Ky.js

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/production-open.spec.ts --project=chromium
  1 Chromium production browser test passed
```

The default bundled Playwright browser executables still fail to launch in this
local Windows environment with `spawn UNKNOWN` before reaching the application.
The Chromium evidence above uses installed system Chrome through the configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override.

Project-owner approval was recorded on 2026-08-01. All Phase 8 completion
conditions are satisfied.
