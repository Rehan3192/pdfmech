import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const qpdf = process.env.QPDF_BIN;
if (!qpdf) {
  throw new Error("QPDF_BIN must point to the verified QPDF executable.");
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDirectory, "..");
const fixtureRoot = join(projectRoot, "tests", "fixtures");
const evidenceRoot = join(projectRoot, "tests", "evidence");

async function findPdfs(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findPdfs(path)));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".pdf") {
      results.push(path);
    }
  }
  return results;
}

const files = (await findPdfs(fixtureRoot)).sort();
const results = [];
for (const path of files) {
  const bytes = await readFile(path);
  const relativePath = path.slice(fixtureRoot.length + 1).replaceAll("\\", "/");
  const qpdfArguments = relativePath.endsWith("encrypted-aes256.pdf")
    ? ["--password=userpass", "--check", path]
    : ["--check", path];
  const check = spawnSync(qpdf, qpdfArguments, {
    encoding: "utf8",
    timeout: 120_000,
  });
  const expectedInvalid = ["malformed.pdf", "over-100mb.pdf"].includes(
    basename(path),
  );
  const passed = check.status === 0 || check.status === 3;
  if (passed === expectedInvalid) {
    throw new Error(
      `Unexpected QPDF result for ${relativePath}: status ${check.status}\n${check.stderr}\n${check.stdout}`,
    );
  }
  results.push({
    path: relativePath,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    expected: expectedInvalid ? "invalid" : "valid",
    qpdfStatus: check.status,
    qpdfPassed: passed,
    qpdfClean: check.status === 0,
    qpdfSummary: `${check.stdout}\n${check.stderr}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8),
  });
}

const qpdfVersion = spawnSync(qpdf, ["--version"], {
  encoding: "utf8",
}).stdout.trim();
const evidence = {
  schemaVersion: 1,
  qpdfVersion,
  fixtureCount: results.length,
  validFixtures: results.filter((result) => result.qpdfPassed).length,
  cleanFixtures: results.filter((result) => result.qpdfClean).length,
  fixturesWithWarnings: results.filter(
    (result) => result.qpdfPassed && !result.qpdfClean,
  ).length,
  expectedInvalidFixtures: results.filter(
    (result) => result.expected === "invalid",
  ).length,
  fixtures: results,
};

await mkdir(evidenceRoot, { recursive: true });
await writeFile(
  join(evidenceRoot, "corpus-validation.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(JSON.stringify(evidence, null, 2));
