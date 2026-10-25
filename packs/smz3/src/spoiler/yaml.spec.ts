import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readYaml } from "./yaml";

describe("readYaml", () => {
  it("reads maps, sequences and strings, and nothing else", () => {
    expect(
      readYaml("- a\n- B:\n    Yes: 1\n    null: ~\n    7: 2020-01-01\n"),
    ).toEqual({
      ok: true,
      value: ["a", { B: { "7": "2020-01-01", null: "~", Yes: "1" } }],
    });
  });

  it("refuses an alias, which is how a small file becomes a huge value", () => {
    const bomb = "a: &a [x, x]\nb: &b [*a, *a]\nc: &c [*b, *b]\nd: [*c, *c]\n";
    expect(readYaml(bomb)).toEqual({
      detail: "invalid YAML: aliases exceeded maxAliases (0)",
      error: "not-a-spoiler",
      ok: false,
    });
    expect(readYaml("- &a x\n- *a\n")).toMatchObject({
      error: "not-a-spoiler",
      ok: false,
    });
  });

  it("builds nothing from a tag", () => {
    for (const text of [
      "- !!js/function 'function(){}'\n",
      "- !!python/object/apply:os.system [ls]\n",
      "- !!binary aGk=\n",
    ]) {
      expect(readYaml(text)).toMatchObject({
        detail: expect.stringContaining("unknown"),
        error: "not-a-spoiler",
        ok: false,
      });
    }
  });

  it("refuses a duplicate key and a malformed document", () => {
    expect(readYaml("a: 1\na: 2\n")).toEqual({
      detail: "invalid YAML: duplicated mapping key",
      error: "not-a-spoiler",
      ok: false,
    });
    expect(readYaml("a: [1, 2\n")).toMatchObject({
      error: "not-a-spoiler",
      ok: false,
    });
  });

  it("keeps __proto__ as a key of the data", () => {
    const result = readYaml("__proto__:\n  polluted: yes\n");
    expect(result.ok).toBe(true);
    const value = result.ok ? (result.value as object) : {};
    expect(Object.hasOwn(value, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("never throws, whatever the text", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (text) => {
        expect(typeof readYaml(text).ok).toBe("boolean");
      }),
      { numRuns: 300 },
    );
  });
});
