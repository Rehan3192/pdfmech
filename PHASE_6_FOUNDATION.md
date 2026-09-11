# Phase 6 Production Foundation

Status: Approved
Phase: 6 - Production foundation
Date: 2026-08-01
Approved by: Project owner
Approval date: 2026-08-01

## 1. Goal

Create the first long-term production scaffold without promoting the disposable
technical spike into production code.

This phase starts the real application structure approved in
`ARCHITECTURE.md`, while keeping the spike, fixtures, evidence, and reports
available for comparison and regression testing.

## 2. Foundation Scope

Phase 6 establishes:

- pure domain primitives, document types, errors, and canonical geometry helpers;
- application-layer session and open-document bootstrap contracts;
- PDF, asset, recovery, and ID ports;
- infrastructure adapter boundary folders for PDF.js, pdf-lib, workers, and
  local persistence;
- presentation-shell state for the future editor interface;
- automated architecture tests that keep PDF engine imports out of production
  app, domain, ports, presentation, and shared code;
- focused domain tests for the approved page-rotation formulas.

## 3. Non-Scope

Phase 6 does not yet implement:

- the production React editor UI;
- PDF.js production rendering adapters;
- pdf-lib production export adapters;
- IndexedDB recovery;
- command history;
- page organization workflows;
- final launch-corpus coverage.

Those belong to later implementation phases.

## 4. Scaffold Layout

```text
src/
  app/
  domain/
  ports/
  infrastructure/
    pdfjs/
    pdflib/
    persistence/
    workers/
  presentation/
  shared/
```

The existing root-level spike files remain in place for Phase 4 and Phase 5
reproducibility. Production code should be added inside the approved folders.

## 5. Verification Gate

Phase 6 is ready for approval when:

- TypeScript compilation passes.
- Unit tests pass.
- The production scaffold folders exist.
- Boundary tests prove app/domain/ports/presentation/shared do not import
  `pdfjs-dist` or `pdf-lib`.
- Domain tests cover the approved canonical page-rotation formulas.
- The README identifies the difference between spike and production foundation.

## 6. Verification Results

Recorded on 2026-08-01:

```text
npm run test   3 test files passed, 14 tests passed
npm run build  TypeScript compilation passed, Vite production build passed
```

The Vite large-chunk warning remains inherited from the disposable PDF.js spike
bundle and is not introduced by the production foundation scaffold.

Project-owner approval was recorded on 2026-08-01. All Phase 6 completion
conditions are satisfied.
