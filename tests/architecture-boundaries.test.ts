import { promises as fs } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve("src");
const productionDirectories = [
  "app",
  "domain",
  "ports",
  "presentation",
  "shared",
];

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(fullPath);
      }

      return entry.isFile() && /\.(ts|tsx)$/.test(fullPath) ? [fullPath] : [];
    }),
  );

  return files.flat();
}

async function readProductionFiles(): Promise<
  readonly { readonly file: string; readonly text: string }[]
> {
  const files = (
    await Promise.all(
      productionDirectories.map((directory) =>
        listTypeScriptFiles(path.join(sourceRoot, directory)),
      ),
    )
  ).flat();
  files.push(path.join(sourceRoot, "production-main.tsx"));

  return Promise.all(
    files.map(async (file) => ({
      file,
      text: await fs.readFile(file, "utf8"),
    })),
  );
}

describe("production architecture boundaries", () => {
  it("creates the approved production folders beside the disposable spike", async () => {
    await expect(fs.access(path.join(sourceRoot, "app"))).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(sourceRoot, "domain")),
    ).resolves.toBeUndefined();
    await expect(fs.access(path.join(sourceRoot, "ports"))).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(sourceRoot, "infrastructure")),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(sourceRoot, "presentation")),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(sourceRoot, "shared")),
    ).resolves.toBeUndefined();
  });

  it("keeps PDF engine imports out of app, domain, ports, presentation, and shared code", async () => {
    const productionFiles = await readProductionFiles();
    const offenders = productionFiles
      .filter(({ text }) => /pdfjs-dist|pdf-lib/.test(text))
      .map(({ file }) => path.relative(sourceRoot, file));

    expect(offenders).toEqual([]);
  });

  it("keeps the domain independent of app, ports, presentation, and infrastructure", async () => {
    const domainFiles = await listTypeScriptFiles(path.join(sourceRoot, "domain"));
    const offenders = (
      await Promise.all(
        domainFiles.map(async (file) => ({
          file,
          text: await fs.readFile(file, "utf8"),
        })),
      )
    )
      .filter(({ text }) =>
        /from\s+["']\.\.\/(?:app|ports|presentation|infrastructure)\//.test(
          text,
        ),
      )
      .map(({ file }) => path.relative(sourceRoot, file));

    expect(offenders).toEqual([]);
  });
});
