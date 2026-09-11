# Phase 13 Production Object Movement

Status: Approved
Phase: 13 - Production object movement
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Add controlled movement for selected production edit objects without storing
zoom-scaled coordinates or touching PDF bytes.

This phase turns selected text objects into draggable overlay objects. Dragging
uses live UI preview during pointer movement, then commits one immutable domain
state transition on pointer-up.

## 2. Scope

Phase 13 establishes:

- pure `moveObject()` domain command;
- immutable object frame updates with document revision and `updatedAt`
  changes;
- unchanged page z-order during movement;
- positive finite-frame validation shared by create and move paths;
- zoom-independent movement math in `overlay-coordinate-layer`;
- clamped movement so objects stay inside the selected page bounds;
- production pointer drag for selected text objects;
- live drag preview before committing to `EditorDocument`;
- one committed document revision per completed drag;
- browser coverage proving movement at 150% zoom stores canonical coordinates;
- continued production privacy canary checks;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 13 does not implement resizing, text editing, keyboard nudging,
multi-select, snap guides, undo/redo, persistence, export, or PDF byte
modification. The object being moved is still the text object introduced in
Phase 12.

## 4. Verification Gate

Phase 13 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Domain tests prove object movement updates immutable document state,
  revision, and `updatedAt` without changing z-order.
- Coordinate tests prove viewport drag deltas are converted back into
  canonical PDF points and clamped inside the page.
- Production browser test opens `representative.pdf`, creates a text object,
  zooms to 150%, drags it, verifies the canonical destination, then deletes it.
- Production browser privacy canaries still pass.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/presentation test layers remain free of direct `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  10 test files passed, 31 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-DngTgD_S.js               205.65 kB, gzip 64.96 kB
  dist/assets/browser-renderer-ffK4xVmN.js    430.20 kB, gzip 128.53 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-DngTgD_S.js
  pdf-engine: browser-renderer-ffK4xVmN.js

rg "pdfjs-dist|pdf-lib" src/domain src/app src/presentation tests/domain tests/app tests/presentation
  no direct PDF engine imports found in those layers

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/production-open.spec.ts --project=chromium
  1 Chromium production browser test passed

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/local-edit.spec.ts --project=chromium
  2 preserved-spike Chromium browser tests passed on /spike.html
```

The production browser test now verifies that a text object created at
`120.0, 140.0 pt` and dragged by `60 x 30 px` at `150%` zoom commits to
`160.0, 160.0 pt`, proving movement is stored in canonical PDF coordinates
instead of zoom-scaled CSS coordinates.

The default bundled Playwright browser executables still fail to launch in this
local Windows environment with `spawn UNKNOWN` before reaching the application.
The Chromium evidence above uses installed system Chrome through the configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override.

Project-owner approval was recorded on 2026-08-01. All Phase 13 completion
conditions are satisfied.
