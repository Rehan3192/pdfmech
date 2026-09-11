import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const assetsDir = join(process.cwd(), "dist", "assets");
const assets = await readdir(assetsDir);
const jsAssets = assets.filter((asset) => asset.endsWith(".js"));
const entryAssets = jsAssets.filter((asset) => asset.startsWith("index-"));
const pdfRendererAssets = jsAssets.filter((asset) =>
  asset.startsWith("browser-renderer-"),
);
const pdfExporterAssets = jsAssets.filter((asset) =>
  asset.startsWith("browser-exporter-"),
);
const pdfValidatorAssets = jsAssets.filter((asset) =>
  asset.startsWith("generated-pdf-validator-"),
);
const sharedPdfAssets = jsAssets.filter((asset) => asset.startsWith("pdf-"));

if (entryAssets.length !== 1) {
  throw new Error(`Expected one production entry chunk, found ${entryAssets.length}.`);
}

if (pdfRendererAssets.length !== 1) {
  throw new Error(`Expected one lazy PDF renderer chunk, found ${pdfRendererAssets.length}.`);
}

if (pdfExporterAssets.length !== 1) {
  throw new Error(`Expected one lazy PDF exporter chunk, found ${pdfExporterAssets.length}.`);
}

if (pdfValidatorAssets.length !== 1) {
  throw new Error(`Expected one lazy PDF validator chunk, found ${pdfValidatorAssets.length}.`);
}

if (sharedPdfAssets.length !== 1) {
  throw new Error(`Expected one shared lazy PDF.js chunk, found ${sharedPdfAssets.length}.`);
}

const entryText = await readFile(join(assetsDir, entryAssets[0]), "utf8");
if (
  entryText.includes("pdfjs-dist") ||
  entryText.includes("StandardFonts")
) {
  throw new Error("Production entry chunk contains eager PDF engine markers.");
}

const pdfValidatorText = await readFile(
  join(assetsDir, pdfValidatorAssets[0]),
  "utf8",
);
if (!pdfValidatorText.includes("pdf.worker")) {
  throw new Error("Lazy PDF validator chunk does not contain the PDF.js worker marker.");
}

const pdfExporterText = await readFile(join(assetsDir, pdfExporterAssets[0]), "utf8");
if (!pdfExporterText.includes("StandardFonts")) {
  throw new Error("Lazy PDF exporter chunk does not contain the pdf-lib marker.");
}

console.log("Phase 8 build split verified");
console.log(`entry: ${entryAssets[0]}`);
console.log(`pdf-renderer: ${pdfRendererAssets[0]}`);
console.log(`pdf-exporter: ${pdfExporterAssets[0]}`);
console.log(`pdf-validator: ${pdfValidatorAssets[0]}`);
console.log(`shared-pdfjs: ${sharedPdfAssets[0]}`);
