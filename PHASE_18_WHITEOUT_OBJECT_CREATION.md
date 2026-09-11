# Phase 18 Production Whiteout Object Creation

Status: Approved
Phase: 18 - Production whiteout object creation
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-09

## 1. Goal

Add production whiteout rectangles for visual replacement without representing
them as secure redaction, without touching PDF bytes, and without weakening the
local-only privacy boundary.

This phase adds a Text/Whiteout creation tool selector. Whiteout clicks create
real domain edit objects in canonical page coordinates and render them as opaque
white rectangles in the production overlay.

## 2. Scope

Phase 18 establishes:

- pure `addWhiteoutObject()` domain command;
- immutable whiteout creation with fresh object IDs, document revision, and
  `updatedAt` changes;
- default opaque whiteout color;
- canonical default whiteout frame creation with page-bound clamping;
- production Text/Whiteout creation-tool selector;
- click-to-create whiteout rectangles on the selected page;
- distinct `production-overlay-whiteout` rendering without visible text labels;
- whiteout selection, move, resize, and delete behavior through the existing
  object manipulation path;
- text-only content and appearance controls disabled for selected whiteout
  objects;
- browser coverage proving whiteout placement at 150% zoom stores canonical
  coordinates;
- preserved text create/edit/style/duplicate/move/resize/delete behavior;
- preserved production privacy canaries;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 18 does not implement secure redaction, content removal, whiteout color
editing, opacity controls, export, undo/redo, persistence, multi-select, or PDF
byte modification. Whiteout is a visual overlay object only.

## 4. Verification Gate

Phase 18 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Coordinate tests prove default whiteout frames are created in canonical page
  coordinates and clamped inside page bounds.
- Domain tests prove whiteout creation updates immutable document state,
  revision, `updatedAt`, object registry, and page z-order.
- Production browser test opens `representative.pdf`, preserves text-object
  edit/style/duplicate/move/resize/delete behavior, switches to the Whiteout
  tool, creates a whiteout at 150% zoom, verifies rendering and canonical
  placement, moves it, resizes it, and deletes it while the text object remains.
- Production browser privacy canaries still pass.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/presentation test layers remain free of direct `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  10 test files passed, 42 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-mjcYtvXP.js               216.33 kB, gzip 67.12 kB
  dist/assets/browser-renderer-CRTCoH_w.js    430.20 kB, gzip 128.53 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-mjcYtvXP.js
  pdf-engine: browser-renderer-CRTCoH_w.js

rg "pdfjs-dist|pdf-lib" src/domain src/app src/presentation tests/domain tests/app tests/presentation
  no direct PDF engine imports found in those layers

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/production-open.spec.ts --project=chromium
  1 Chromium production browser test passed

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/local-edit.spec.ts --project=chromium
  2 preserved-spike Chromium browser tests passed on /spike.html
```

The production browser test now verifies that clicking the Whiteout tool at
`300 x 330 px` while zoomed to `150%` creates a whiteout object at
`200.0, 220.0 pt`, renders it as an opaque white rectangle, then moves it to
`240.0, 240.0 pt`, resizes it to `220.0 x 56.0 pt`, and deletes it while the
text object remains.

During browser verification, the selected resize handle is scrolled into view
before mouse-coordinate resizing. This keeps the test tied to real pointer
behavior even when the page panel has scrolled.

The default bundled Playwright browser executables still fail to launch in this
local Windows environment with `spawn UNKNOWN` before reaching the application.
The Chromium evidence above uses installed system Chrome through the configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override.

Project-owner approval was recorded on 2026-08-09. All Phase 18 completion
conditions are satisfied.
