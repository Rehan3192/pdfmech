import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const outputRoot = join(projectRoot, "public", "ocr");
const coreSource = join(projectRoot, "node_modules", "tesseract.js-core");
const workerSource = join(
  projectRoot,
  "node_modules",
  "tesseract.js",
  "dist",
  "worker.min.js",
);
const languageSource = join(
  projectRoot,
  "node_modules",
  "@tesseract.js-data",
  "eng",
  "4.0.0_best_int",
  "eng.traineddata.gz",
);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(join(outputRoot, "core"), { recursive: true });
await mkdir(join(outputRoot, "lang"), { recursive: true });

for (const entry of await readdir(coreSource, { withFileTypes: true })) {
  if (
    entry.isFile() &&
    entry.name.startsWith("tesseract-core") &&
    entry.name.includes("lstm") &&
    (entry.name.endsWith(".js") || entry.name.endsWith(".wasm"))
  ) {
    await copyFile(
      join(coreSource, entry.name),
      join(outputRoot, "core", entry.name),
    );
  }
}

await copyFile(workerSource, join(outputRoot, "worker.min.js"));
await copyFile(languageSource, join(outputRoot, "lang", "eng.traineddata.gz"));

console.log("Prepared same-origin OCR worker, WebAssembly, and English language assets.");
