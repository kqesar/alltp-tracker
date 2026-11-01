import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { settingLine, shopLine } from "./dr";

// The expressions the two readers replace, kept as their oracle
const LINE = /^([^:]+):'?\s+(.*?)\s*$/;
const SHOP = /^(.+) \[(.+)\]$/;

/** Lines of the characters the expressions turn on, line breaks among them. */
const line = fc
  .array(fc.constantFrom("a", "B", ":", "'", " ", "\t", "[", "]", "\r", " "), {
    maxLength: 16,
  })
  .map((chars) => chars.join(""));

/** Long enough that a polynomial backtrack would take seconds. */
const LONG = 50_000;

describe("a DR text log's setting line", () => {
  it("reads what `^([^:]+):'?\\s+(.*?)\\s*$` reads", () => {
    fc.assert(
      fc.property(line, (text) => {
        const old = LINE.exec(text);
        const read = settingLine(text);
        expect(read).toEqual(
          old === null ? null : { label: old[1], value: old[2] },
        );
      }),
      { numRuns: 5000 },
    );
    expect(settingLine("Key Logic Algorithm:'  default ")).toEqual({
      label: "Key Logic Algorithm",
      value: "default",
    });
    expect(settingLine("Mode:open")).toBeNull();
  });

  it("reads a long line in linear time", () => {
    const text = `9: ${" ".repeat(LONG)}x`;
    expect(settingLine(text)).toEqual({ label: "9", value: "x" });
    expect(settingLine(`9: a${" ".repeat(LONG)}\r`)).toEqual({
      label: "9",
      value: "a",
    });
  });
});

describe("a DR text log's shop line", () => {
  it("reads what `^(.+) \\[(.+)\\]$` reads", () => {
    fc.assert(
      fc.property(line, (text) => {
        const old = SHOP.exec(text);
        expect(shopLine(text)).toEqual(
          old === null ? null : { location: old[1], type: old[2] },
        );
      }),
      { numRuns: 5000 },
    );
    expect(shopLine("Dark Lake Hylia Shop [Shop]")).toEqual({
      location: "Dark Lake Hylia Shop",
      type: "Shop",
    });
  });

  it("reads a long line in linear time", () => {
    expect(shopLine(`a [${"a [a".repeat(LONG)}`)).toBeNull();
    expect(shopLine(`a [${"a [a".repeat(LONG)}]`)).toEqual({
      location: `a [${"a [a".repeat(LONG - 1)}a`,
      type: "a",
    });
  });
});
