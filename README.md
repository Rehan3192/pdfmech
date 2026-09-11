# Local PDF Editor

Privacy-first browser-local PDF editor. The production app opens, renders,
edits, validates, and downloads PDFs in the browser without uploading the PDF to
a server.

The spike processes selected PDFs in the browser. It is experimental and is not
production code.

The production foundation starts in the approved architecture folders:

```text
src/app/
src/domain/
src/ports/
src/infrastructure/
src/presentation/
src/shared/
```

See `PHASE_6_FOUNDATION.md` for the current production-foundation gate.

## Run the production app

```text
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

## Build and preview production output

```text
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`.

## Run the preserved spike

```text
npm install
npm run fixtures
npm run dev
```

Open `http://127.0.0.1:4173/spike.html`.

## Verify

```text
npm test
npm run build
npm run build:verify-phase8
npm run test:e2e -- --project=chromium
npm run test:performance
```

The focused production smoke is:

```text
npx playwright test tests/e2e/production-open.spec.ts --project=chromium
```

See `SPIKE_REPORT.md` for evidence, limitations, and the current recommendation.
See `MVP_READINESS_REPORT.md` for the current local-MVP readiness audit.
