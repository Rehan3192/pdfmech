# PDF.js Adapter Boundary

This folder is reserved for the production PDF.js renderer and validator
adapters.

Rules:

- PDF.js imports terminate in this infrastructure boundary.
- Adapter results cross into the app only through `src/ports/pdf.ts`.
- Parser errors must be translated into stable, private editor error codes.
- No document filenames, text, form values, signatures, or bytes may be logged.
