# Phase 15 Production Text Content Editing

Status: Approved
Phase: 15 - Production text content editing
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Add controlled editing for selected text-object content without leaking
user-entered text to network requests or touching PDF bytes.

This phase adds a selected-text content field. Typing updates local draft UI
state only. Pressing Apply commits one immutable domain state transition.

## 2. Scope

Phase 15 establishes:

- pure `updateTextObjectContent()` domain command;
- shared text-content validation for create and update paths;
- immutable text updates with document revision and `updatedAt` changes;
- no-op behavior when submitted text is unchanged after normalization;
- unchanged object frame, page, and z-order during text updates;
- selected text-object content control in the production toolbar;
- explicit Apply action for one committed document revision per text edit;
- status messages that do not echo user-entered document text;
- browser coverage proving edited text appears in the overlay;
- browser privacy canary coverage for user-entered text;
- preserved move, resize, delete, zoom, and production privacy behavior;
- preserved `/spike.html` smoke coverage.

## 3. Non-Scope

Phase 15 does not implement font family, font size, color, alignment,
multi-line text editing, inline canvas editing, undo/redo, persistence, export,
or PDF byte modification. It only updates the content of text objects created in
the production editor.

## 4. Verification Gate

Phase 15 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- Production build passes and keeps the PDF engine split.
- Domain tests prove text-content updates mutate immutable document state,
  revision, and `updatedAt` without changing frame or z-order.
- Domain tests prove unchanged normalized text does not create a new revision.
- Production browser test opens `representative.pdf`, creates a text object,
  edits its content, verifies the overlay text updates, zooms, moves, resizes,
  and deletes it.
- Production browser privacy canaries prove the filename and user-entered text
  do not appear in captured request evidence.
- Preserved spike browser smoke passes on `/spike.html`.
- App/domain/presentation test layers remain free of direct `pdfjs-dist` and
  `pdf-lib` imports.

## 5. Verification Results

Recorded on 2026-08-01:

```text
npm run test
  10 test files passed, 36 tests passed

npm run build
  TypeScript compilation passed, Vite production build passed
  dist/assets/index-CtVFfXrm.js               208.99 kB, gzip 65.52 kB
  dist/assets/browser-renderer-DWNPmzCx.js    430.20 kB, gzip 128.53 kB

npm run build:verify-phase8
  Phase 8 build split verified
  entry: index-CtVFfXrm.js
  pdf-engine: browser-renderer-DWNPmzCx.js

rg "pdfjs-dist|pdf-lib" src/domain src/app src/presentation tests/domain tests/app tests/presentation
  no direct PDF engine imports found in those layers

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/production-open.spec.ts --project=chromium
  1 Chromium production browser test passed

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  npx playwright test tests/e2e/local-edit.spec.ts --project=chromium
  2 preserved-spike Chromium browser tests passed on /spike.html
```

The production browser test now verifies that the selected text object can be
updated from the default `Text` content to a private canary value, that the
overlay reflects the edited content, and that captured request evidence does not
contain either `PRIVATE_FILENAME_CANARY` or `PRIVATE_TEXT_CANARY`.

The default bundled Playwright browser executables still fail to launch in this
local Windows environment with `spawn UNKNOWN` before reaching the application.
The Chromium evidence above uses installed system Chrome through the configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override.

Project-owner approval was recorded on 2026-08-01. All Phase 15 completion
conditions are satisfied.
