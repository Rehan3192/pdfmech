# Phase 14 Production Object Resizing

Status: Approved
Phase: 14 - Production object resizing
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Add controlled resizing for selected production edit objects without storing
zoom-scaled dimensions or touching PDF bytes.

This phase adds a selected-object resize handle. Pointer movement previews the
new frame in the UI, then pointer release commits one immutable domain state
transition.

## 2. Scope

Phase 14 establishes:

- pure `resizeObject()` domain command;
- immutable object frame updates with document revision and `updatedAt`
  changes;
- unchanged object page and z-order during resizing;
- zoom-independent resize math in `overlay-coordinate-layer`;
- minimum resize dimensions for usable object handles;
- page-bound clamping so resized objects stay inside the selected page;
- selected-object resize handle in the production overlay;
- live resize preview before committing to `EditorDocument`;
- one committed document revision per completed resize gesture;
- browser coverage proving resizing at 150% zoom stores canonical dimensions;
- continued production privacy canary checks;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 14 does not implement multi-corner resizing, proportional resizing,
rotation-aware handles, keyboard resizing, text editing, duplicate, undo/redo,
persistence, export, or PDF byte modification. The object being resized is
still the text object introduced in Phase 12.

## 4. Verification Gate

Phase 14 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Domain tests prove object resizing updates immutable document state,
  revision, and `updatedAt` without changing z-order.
- Coordinate tests prove viewport resize deltas are converted back into
  canonical PDF points and clamped inside the page.
- Production browser test opens `representative.pdf`, creates a text object,
  zooms to 150%, moves it, resizes it, verifies the canonical destination and
  dimensions, then deletes it.
- Production browser privacy canaries still pass.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/presentation test layers remain free of direct `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  10 test files passed, 34 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-CtocJi3S.js               207.84 kB, gzip 65.23 kB
  dist/assets/browser-renderer-DiPSA6dt.js    430.20 kB, gzip 128.53 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-CtocJi3S.js
  pdf-engine: browser-renderer-DiPSA6dt.js

rg "pdfjs-dist|pdf-lib" src/domain src/app src/presentation tests/domain tests/app tests/presentation
  no direct PDF engine imports found in those layers

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/production-open.spec.ts --project=chromium
  1 Chromium production browser test passed

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/local-edit.spec.ts --project=chromium
  2 preserved-spike Chromium browser tests passed on /spike.html
```

The production browser test now verifies that a text object moved to
`160.0, 160.0 pt` and resized by `60 x 30 px` at `150%` zoom commits to
`220.0 x 48.0 pt`, proving resize dimensions are stored in canonical PDF
points instead of zoom-scaled CSS pixels.

The default bundled Playwright browser executables still fail to launch in this
local Windows environment with `spawn UNKNOWN` before reaching the application.
The Chromium evidence above uses installed system Chrome through the configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override.

Project-owner approval was recorded on 2026-08-01. All Phase 14 completion
conditions are satisfied.
