import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_SLICE_DEPTH } from "./limits";
import { sliceTopLevel } from "./slice";

function value<T>(result: ReturnType<typeof sliceTopLevel<string>>): T {
  if (!result.ok) throw new Error(`refused: ${result.error} ${result.detail}`);
  return result.value as T;
}

describe("sliceTopLevel", () => {
  it("keeps the wanted keys and skips the rest", () => {
    const text =
      '{"a": 1, "big": {"x": [1, 2, {"y": "}"}]}, "b": [true, null], "c": "z"}';
    expect(value(sliceTopLevel(text, ["a", "b", "missing"]))).toEqual({
      a: 1,
      b: [true, null],
    });
  });

  it("agrees with JSON.parse on random documents, any indentation, any keys", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ unit: "binary" }), fc.jsonValue()),
        fc.constantFrom(0, 1, 4, "\t"),
        fc.infiniteStream(fc.boolean()),
        (doc, indent, picks) => {
          const text = JSON.stringify(doc, null, indent);
          const parsed = JSON.parse(text) as Record<string, unknown>;
          const wanted = Object.keys(parsed).filter(() => picks.next().value);
          const expected: Record<string, unknown> = {};
          for (const key of wanted) {
            Object.defineProperty(expected, key, {
              configurable: true,
              enumerable: true,
              value: parsed[key],
              writable: true,
            });
          }
          const got = sliceTopLevel(text, wanted);
          expect(got.ok).toBe(true);
          if (got.ok) expect({ ...got.value }).toEqual({ ...expected });
        },
      ),
      { numRuns: 300 },
    );
  });

  it("is not fooled by brackets, quotes and backslashes inside strings", () => {
    const text = String.raw`{"skip": "}]\"{[ \\", "tail": "\\\\", "keep": "a\"b}", "k": 1}`;
    expect(value(sliceTopLevel(text, ["keep", "tail", "k"]))).toEqual({
      k: 1,
      keep: 'a"b}',
      tail: "\\\\",
    });
  });

  it("decodes an escaped key", () => {
    expect(
      value(sliceTopLevel('{"\\u0061b": 1, "q\\"": 2}', ["ab", 'q"'])),
    ).toEqual({
      ab: 1,
      'q"': 2,
    });
  });

  it("keeps the last of a repeated key, as JSON.parse does", () => {
    expect(value(sliceTopLevel('{"a": 1, "a": 2}', ["a"]))).toEqual({ a: 2 });
  });

  it("treats __proto__ as data", () => {
    const got = value<Record<string, unknown>>(
      sliceTopLevel('{"__proto__": {"x": 1}}', ["__proto__"]),
    );
    expect(Object.keys(got)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(got)).toBeNull();
  });

  it("reads an empty object and surrounding whitespace", () => {
    expect(value(sliceTopLevel(" \n{ }\r\n", ["a"]))).toEqual({});
  });

  it("agrees with JSON.parse on a document of several MB", () => {
    const rows = Array.from({ length: 60_000 }, (_, i) => ({
      id: i,
      name: `row "${i}" }`,
      tags: ["a", "b", { deep: [i] }],
    }));
    const text = JSON.stringify({ head: { n: 1 }, rows, tail: [1, 2] });
    expect(text.length).toBeGreaterThan(4_000_000);
    expect(value(sliceTopLevel(text, ["head", "tail"]))).toEqual({
      head: { n: 1 },
      tail: [1, 2],
    });
  });

  describe("refuses with not-a-spoiler, never throws", () => {
    const cases: [string, string][] = [
      ["empty", ""],
      ["an array", "[1, 2]"],
      ["a scalar", "42"],
      ["prose", "Archipelago Version 0.6.8"],
      ["text after the object", '{"a": 1} x'],
      ["text after an empty object", "{} x"],
      ["a key without quotes", "{a: 1}"],
      ["a key without a colon", '{"a" 1}'],
      ["a missing value", '{"a": }'],
      ["a missing comma", '{"a": 1 "b": 2}'],
      ["an unterminated key", '{"a'],
      ["an unterminated string", '{"a": "abc'],
      ["an unterminated skipped array", '{"a": [1, 2'],
      ["an unterminated escape", '{"a": "abc\\'],
      ["a kept value that is not JSON", '{"a": nope}'],
      ["a kept value that is cut", '{"a": [1, 2, }'],
      ["a bad escaped key", '{"\\u00zz": 1}'],
    ];
    it.each(cases)("%s", (_name, text) => {
      const got = sliceTopLevel(text, ["a"]);
      expect(got).toMatchObject({ error: "not-a-spoiler", ok: false });
    });

    it("every proper prefix of a valid document", () => {
      const text = JSON.stringify({
        a: [1, { b: "c}" }],
        d: "e\\",
        f: null,
        g: 12,
      });
      for (let end = 0; end < text.length; end++) {
        const got = sliceTopLevel(text.slice(0, end), ["a", "g"]);
        expect(got.ok, text.slice(0, end)).toBe(false);
      }
      expect(sliceTopLevel(text, ["g"]).ok).toBe(true);
    });

    it("nesting past the bound, skipped or kept, at 10^5 levels", () => {
      const deep = "[".repeat(100_000) + "]".repeat(100_000);
      for (const wanted of [[], ["a"]]) {
        expect(sliceTopLevel(`{"a": ${deep}}`, wanted)).toMatchObject({
          detail: "nested too deep",
          error: "not-a-spoiler",
          ok: false,
        });
      }
    });

    it("accepts nesting right at the bound", () => {
      const at =
        "[".repeat(MAX_SLICE_DEPTH - 1) + "]".repeat(MAX_SLICE_DEPTH - 1);
      expect(sliceTopLevel(`{"a": ${at}}`, ["a"]).ok).toBe(true);
    });
  });

  it("never throws on random text", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (text) => {
        expect(() => sliceTopLevel(text, ["a", "meta"])).not.toThrow();
      }),
      { numRuns: 500 },
    );
    fc.assert(
      fc.property(fc.stringMatching(/^[{}[\]":,\\ a0-9]{0,40}$/), (text) => {
        expect(() => sliceTopLevel(text, ["a"])).not.toThrow();
      }),
      { numRuns: 2000 },
    );
  });
});
