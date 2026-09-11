# Phase 12 Production Edit Object State

Status: Approved
Phase: 12 - Production edit object state
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Turn draft overlay placements into real domain edit objects with controlled
create, select, and delete behavior.

This phase moves text overlays from disposable UI state into `EditorDocument`
state. Objects are still local interface/domain state only; PDF bytes are not
modified and export remains out of scope.

## 2. Scope

Phase 12 establishes:

- pure domain `addTextObject()` and `deleteObject()` commands;
- immutable document updates with revision increments;
- page z-order updates through `objectOrderByPage`;
- object IDs from the approved browser ID service;
- production click-to-create text objects on the selected page;
- selected-object UI state;
- a delete control for the selected object;
- overlay rendering from `EditorDocument.objects` instead of draft UI arrays;
- browser coverage for create, select, delete, zoom scaling, and privacy
  canaries;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 12 does not implement dragging, resizing, text editing, undo/redo,
persistence, export, object history, or PDF byte modification. Selection remains
ephemeral UI state.

## 4. Verification Gate

Phase 12 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Domain tests prove text-object create/delete update immutable document state,
  revision, and z-order.
- Production browser test opens `representative.pdf`, creates a text object,
  selects it, deletes it, and verifies the overlay is removed.
- Production browser privacy canaries still pass.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/ports/presentation/shared remain free of direct `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  10 test files passed, 28 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-Bwz_PL5t.js               203.63 kB, gzip 64.39 kB
  dist/assets/browser-renderer-COCuBEWO.js    430.20 kB, gzip 128.53 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-Bwz_PL5t.js
  pdf-engine: browser-renderer-COCuBEWO.js

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

Project-owner approval was recorded on 2026-08-01. All Phase 12 completion
conditions are satisfied.
