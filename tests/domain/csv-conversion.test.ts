import { describe, expect, it } from "vitest";

import {
  detectCsvDelimiter,
  parseCsv,
  stringifyCsv,
} from "../../src/domain/csv-conversion";

describe("CSV conversion", () => {
  it("parses quoted commas, escaped quotes, and quoted line breaks", () => {
    const parsed = parseCsv(
      'name,notes\r\n"Rehan, Muhammad","Said ""hello""\nand continued"\r\n',
    );

    expect(parsed.delimiter).toBe(",");
    expect(parsed.rows).toEqual([
      ["name", "notes"],
      ["Rehan, Muhammad", 'Said "hello"\nand continued'],
    ]);
  });

  it("detects semicolon and tab-delimited tables", () => {
    expect(detectCsvDelimiter("name;amount\nAcme;42")).toBe(";");
    expect(detectCsvDelimiter("name\tamount\nAcme\t42")).toBe("\t");
  });

  it("removes a UTF-8 BOM and pads shorter rows", () => {
    const parsed = parseCsv("\ufeffa,b,c\n1,2\n");

    expect(parsed.columnCount).toBe(3);
    expect(parsed.rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", ""],
    ]);
  });

  it("serializes commas, quotes, and line breaks safely", () => {
    expect(
      stringifyCsv([
        ["plain", "with,comma", 'with "quote"', "two\nlines"],
      ]),
    ).toBe('plain,"with,comma","with ""quote""","two\nlines"');
  });
});
