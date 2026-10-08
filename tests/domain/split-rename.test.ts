import { describe, expect, it } from "vitest";

import {
  createFixedSizeGroups,
  createInitialAssignments,
  filenamesFromColumn,
  normalizePdfFilename,
  parseFilenameTable,
  suggestFilenameColumn,
  validateSplitRenamePlan,
} from "../../src/domain/split-rename";

describe("split and rename safety", () => {
  it("creates 40 complete groups for a 120-page document", () => {
    const groups = createFixedSizeGroups(120, 3);
    expect(groups).toHaveLength(40);
    expect(groups[0]).toEqual({ label: "1-3", pageIndexes: [0, 1, 2] });
    expect(groups.at(-1)).toEqual({ label: "118-120", pageIndexes: [117, 118, 119] });
    const names = Array.from({ length: 40 }, (_, index) => `Employee ${index + 1}`);
    expect(validateSplitRenamePlan({ groups, assignments: createInitialAssignments(groups, names), importedNameCount: names.length, ignoredRowIndexes: new Set(), pageCount: 120 }).canExport).toBe(true);
  });

  it("keeps a short final group visible instead of discarding it", () => {
    expect(createFixedSizeGroups(8, 3).at(-1)).toEqual({ label: "7-8", pageIndexes: [6, 7] });
  });

  it("reads quoted CSV columns and plain-text filename lists", () => {
    const csv = parseFilenameTable('Employee ID,Full name\n1,"Ali, Khan"\n2,Sara', "names.csv", true);
    expect(csv.columns).toEqual(["Employee ID", "Full name"]);
    expect(filenamesFromColumn(csv, 1)).toEqual(["Ali, Khan", "Sara"]);
    expect(suggestFilenameColumn(csv)).toBe(1);
    expect(filenamesFromColumn(parseFilenameTable("Ali\nSara\n", "names.txt", false), 0)).toEqual(["Ali", "Sara"]);
  });

  it("normalizes unsafe names and reserved Windows filenames", () => {
    expect(normalizePdfFilename('  Ali: October/2026.pdf ').filename).toBe("Ali- October-2026.pdf");
    expect(normalizePdfFilename("CON").filename).toBe("CON-document.pdf");
  });

  it("blocks a missing mapping without shifting later rows", () => {
    const groups = createFixedSizeGroups(8, 2);
    const assignments = createInitialAssignments(groups, ["A", "B", "C"]);
    const validation = validateSplitRenamePlan({ groups, assignments, importedNameCount: 3, ignoredRowIndexes: new Set(), pageCount: 8 });
    expect(validation.canExport).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "missing-name" && issue.groupIndex === 3)).toBe(true);
  });

  it("blocks filename collisions after safe normalization", () => {
    const groups = createFixedSizeGroups(4, 2);
    const assignments = createInitialAssignments(groups, ["Ali:2026", "ali/2026"]);
    const validation = validateSplitRenamePlan({ groups, assignments, importedNameCount: 2, ignoredRowIndexes: new Set(), pageCount: 4 });
    expect(validation.canExport).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "duplicate-name")).toBe(true);
  });

  it("requires extra imported rows to be assigned or explicitly ignored", () => {
    const groups = createFixedSizeGroups(4, 2);
    const assignments = createInitialAssignments(groups, ["A", "B", "C"]);
    expect(validateSplitRenamePlan({ groups, assignments, importedNameCount: 3, ignoredRowIndexes: new Set(), pageCount: 4 }).issues.some((issue) => issue.code === "unused-name")).toBe(true);
    expect(validateSplitRenamePlan({ groups, assignments, importedNameCount: 3, ignoredRowIndexes: new Set([2]), pageCount: 4 }).canExport).toBe(true);
  });

  it("rejects overlapping groups and omitted source pages", () => {
    const groups = [
      { label: "1-2", pageIndexes: [0, 1] },
      { label: "2-3", pageIndexes: [1, 2] },
    ];
    const validation = validateSplitRenamePlan({ groups, assignments: createInitialAssignments(groups, ["A", "B"]), importedNameCount: 2, ignoredRowIndexes: new Set(), pageCount: 4 });
    expect(validation.canExport).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["overlapping-pages", "missing-pages"]));
  });
});
