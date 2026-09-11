# PDF Corpus and Limitation Report

Status: Approved  
Phase: 5 — Representative corpus and limitation testing  
Test date: 2026-07-30
Approved by: Project owner  
Approval date: 2026-08-01

## 1. Goal

Determine whether the browser-local PDF stack is safe and predictable enough to
justify building the production application. This phase expands the disposable
spike beyond a happy-path document and records unsupported cases explicitly.

## 2. Test system

- PDF.js 6.2.108 for parsing, inspection, rendering, and fresh-parser validation
- `pdf-lib` 1.17.1 as the conditional experimental exporter
- QPDF 12.3.2 for independent structural checks
- Playwright 1.62.0 using Chromium, Firefox, and WebKit
- Vitest 4.1.10 for affine-geometry unit tests
- Windows 10.0.26200, Intel i7-8650U, 8 logical CPUs, approximately 17 GB RAM

The official QPDF Windows archive was verified before use with SHA-256:
`8941870a604e7c87ed24566b038d46c24ce76616254d2383c578f60c0677f202`.

## 3. Corpus

Thirteen fixtures were classified by the automated QPDF corpus validator:

| Fixture | Purpose | Expected result |
|---|---|---|
| `representative.pdf` | Portrait, landscape, 90° rotation, offset crop box | Valid |
| `features.pdf` | Metadata, AcroForm fields, attachment | Valid |
| `coordinate-gray.pdf` | Pixel-measured export placement | Valid |
| `linearized.pdf` | Linearized input behavior | Valid |
| `encrypted-aes256.pdf` | AES-256 password protection | Valid but unsupported |
| `page-boundary-501.pdf` | Page-count ceiling | Valid but unsupported |
| `oversized-page.pdf` | Canvas/resource ceiling | Valid but unsupported |
| `performance-25p-20m.pdf` | Medium performance case | Valid |
| `performance-100p-50m.pdf` | Large performance case | Valid |
| `signed-node-signpdf.pdf` | Digitally signed document | Valid but blocked |
| `xfa-pdfjs.pdf` | XFA form document | Valid with QPDF warnings; blocked |
| `malformed.pdf` | Damaged-input handling | Intentionally invalid |
| `over-100mb.pdf` | Pre-parse file-size sentinel | Intentionally invalid |

Purpose-built fixtures use fixed timestamps and reproduce byte-for-byte, except
the encrypted derivative, whose cryptographic randomness changes its bytes.
External signed and XFA fixture source, license, commit, and digest are recorded
in `tests/fixtures/PROVENANCE.md`.

## 4. Automated results

The final sequential verification produced:

```text
Geometry:          7 passed
Corpus/QPDF:       13 classified as expected
                  11 structurally valid
                  10 clean, 1 valid with warnings
                  2 intentionally invalid
Browser matrix:    23 passed, 4 intentionally skipped
Production build:  passed
```

The four skips are the Firefox and WebKit copies of two tests deliberately run
once in Chromium: the resource-allocation boundary test and measured performance
test. Every cross-browser functional test passed in all three engines.

Machine-readable evidence is stored in:

- `tests/evidence/corpus-validation.json`
- `tests/evidence/performance-latest.json`

## 5. Preservation and export findings

| Behavior | Result |
|---|---|
| Page count, intrinsic rotation, and crop box | Preserved |
| Title, author, and subject metadata | Preserved in tested fixture |
| AcroForm text, checkbox, and dropdown fields | Preserved in tested fixture |
| Embedded attachment and filename | Preserved and verified through QPDF |
| Added text and visual whiteout | Exported and freshly rendered |
| Placement on 0° and 90° pages | Within 1 PDF point in all three engines |
| QPDF structure after supported exports | Valid |
| Linearized input | Valid output, but linearization is lost |
| Original local input | Unchanged |

This is preservation evidence for the named features, not a claim that arbitrary
PDF internals survive every rewrite.

## 6. Safety and privacy findings

- Files larger than 100 MB are rejected before their bytes are parsed.
- Documents over 500 pages are rejected.
- Pages over 14,400 points in either dimension or 50,000,000 square points are
  rejected before canvas rendering.
- Malformed files fail without enabling export.
- Password-protected PDFs are rejected with a specific message; no password UI
  or indefinite callback wait occurs.
- Digitally signed PDFs are blocked before editing because any rewrite may
  invalidate the signature.
- XFA documents are blocked with a specific explanation.
- Private filename and edit-text canaries did not appear in observed request
  URLs, headers, or bodies. No workflow request carried a body.
- CSP keeps scripts and workers same-origin and disables plugins/embedded
  objects. The spike requires `style-src 'unsafe-inline'` because page and
  overlay geometry is applied dynamically as CSS. Inline scripts remain
  forbidden. Production should replace this CSS exception if a practical,
  browser-compatible styling design is found.

## 7. Performance evidence

Measured in Chromium on the test system:

| Fixture | Open | Export plus validation |
|---|---:|---:|
| 25 pages / 20,996,028 bytes | 883 ms | 1,479 ms |
| 100 pages / 52,514,735 bytes | 888 ms | 1,167 ms |

Chromium reported approximately 60.3 MB used and 64 MB total for the main
JavaScript realm after each workflow. These are repeatable engineering
measurements, not universal product guarantees. Playwright elapsed time includes
automation overhead, and the heap API excludes PDF worker, native decoder,
canvas, GPU, and some browser-process allocations.

## 8. Known limitations and production gates

1. QPDF detects structural problems but cannot prove semantic preservation.
2. Signature cryptographic validity is not verified; signed documents are
   conservatively detected and blocked.
3. XFA and encrypted PDFs are unsupported in the current product boundary.
4. Form fields are preserved, but the spike does not yet provide form-editing UI.
5. Bookmarks, links, layers, multimedia, JavaScript actions, PDF/A, PDF/UA,
   accessibility trees, and every compression/font variant are not comprehensively
   covered.
6. Physical Safari, mobile devices, low-memory hardware, and assistive
   technologies remain untested.
7. Worker/native/canvas peak memory needs production instrumentation or a
   controlled external profiler.
8. The main bundle remains large and needs lazy loading/code splitting.
9. `pdf-lib` remains a maintenance and capability risk. It must stay behind an
   exporter adapter and cannot be treated as permanently selected.
10. The 100 MB and 500-page limits are hard safety ceilings, not recommended
    smooth-performance targets.

## 9. Recommendation

**Conditional go to the production scaffold and core vertical slice.**

The evidence is strong enough to build the real application architecture. It is
not strong enough to promise a universal PDF editor. The first release must:

- describe itself as a local, privacy-first editor for supported PDFs;
- reject unsupported encrypted, signed, and XFA inputs before editing;
- preserve the exporter behind an adapter and keep the corpus as a release gate;
- validate every generated file with a fresh parser, with QPDF in CI;
- retain explicit size, page, and page-dimension limits;
- avoid analytics, logging, service workers, or third-party requests that could
  receive document data;
- disclose that whiteout is visual covering, not secure redaction.

## 10. Decisions requested

Approval of Phase 5 records these decisions:

1. Accept the 13-fixture corpus and automated evidence as the current baseline.
2. Proceed to a fresh production scaffold; do not promote the disposable spike
   wholesale.
3. Keep PDF.js 6.2.108 as the initial renderer/parser candidate.
4. Keep `pdf-lib` 1.17.1 only as a replaceable, conditional exporter.
5. Treat signed, encrypted, and XFA PDFs as explicit unsupported cases.
6. Carry every limitation in Section 8 into the production backlog and release
   gates.
7. Require the corpus, privacy canary, browser matrix, and structural validation
   to remain green as production features are added.

## 11. Completion gate

Phase 5 is complete when:

- the corpus and provenance are recorded;
- structural classifications match expectations;
- supported feature preservation passes;
- unsafe and unsupported inputs fail safely;
- coordinate accuracy passes across the browser matrix;
- privacy and CSP behavior are tested;
- measured performance and memory caveats are recorded;
- limitations and the conditional recommendation are approved by the project
  owner.

All technical conditions pass. Project-owner approval was recorded on
2026-08-01.
