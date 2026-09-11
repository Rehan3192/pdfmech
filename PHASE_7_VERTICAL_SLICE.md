# Phase 7 Production Vertical Slice

Status: Approved
Phase: 7 - Production open workflow
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Build the first real production workflow: open a local PDF through the approved
app/domain/ports/infrastructure/presentation structure and show document/page
state without uploading document data.

## 2. Scope

Phase 7 establishes:

- React as the production presentation runtime;
- `/` as the production app route;
- `/spike.html` as the preserved disposable spike route;
- a browser ID service;
- a PDF.js inspection adapter behind the `PdfRenderer` port;
- an app-layer `openLocalDocument` use case that creates domain document state;
- production UI for local file opening, page count, size, and page geometry;
- tests for app-layer domain bootstrapping and browser-local privacy canaries;
- production HTML metadata for the default route.

## 3. Non-Scope

Phase 7 does not yet implement page rendering, editing, export, recovery,
thumbnail rendering, command history, or page organization in the production
app. The preserved spike still demonstrates those risky behaviors until they
are rebuilt through production boundaries.

## 4. Verification Gate

Phase 7 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production browser test opens `representative.pdf` at `/`.
- Existing spike browser tests target `/spike.html`.
- Network inspection shows no filename canary and no request bodies during the
  production open workflow.
- The production app imports PDF.js only through infrastructure.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  4 test files passed, 15 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/index.html 0.49 kB gzip 0.30 kB

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/production-open.spec.ts --project=chromium
  1 Chromium production browser test passed

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/local-edit.spec.ts --project=chromium
  2 preserved-spike Chromium browser tests passed on /spike.html
```

The default bundled Playwright browser executables failed to launch in this
local Windows environment with `spawn UNKNOWN` before reaching the application.
The Chromium evidence above used installed system Chrome through the
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override added to `playwright.config.ts`.

The Vite large-chunk warning remains expected while PDF.js is bundled into the
first vertical slice. Phase 8 should split the PDF engine path before the editor
surface grows.

Project-owner approval was recorded on 2026-08-01. All Phase 7 completion
conditions are satisfied.
