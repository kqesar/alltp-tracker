import { describe, expect, it } from "vitest";
import { bindSeed, type Evidence, type Fact } from "./bind";

const agree: Fact = { file: "NoGlitches", name: "logic", run: "NoGlitches" };
const differ: Fact = { file: "Hard", name: "logic", run: "NoGlitches" };

function bind(run: string | null, file: string | null, ...facts: Fact[]) {
  const evidence: Evidence = { facts, seed: { file, run } };
  return bindSeed(evidence);
}

describe("bindSeed", () => {
  it("verifies equal seeds and counts the facts that agreed", () => {
    expect(bind("9MQ9gO1wMD", "9MQ9gO1wMD", agree)).toEqual({
      facts: 1,
      verdict: "verified",
    });
  });

  it("refuses two seeds, naming both, run first", () => {
    expect(bind("aaa", "bbb")).toEqual({
      refusal: { detail: "aaa / bbb", error: "seed-differs", ok: false },
      verdict: "refused",
    });
  });

  it("puts the seed before the settings", () => {
    expect(bind("aaa", "bbb", differ)).toMatchObject({
      refusal: { error: "seed-differs" },
      verdict: "refused",
    });
  });

  it("refuses a fact both sides state with two values, naming it", () => {
    expect(bind(null, null, agree, differ)).toEqual({
      refusal: {
        detail: "logic: NoGlitches / Hard",
        error: "settings-differ",
        ok: false,
      },
      verdict: "refused",
    });
  });

  it("refuses even when the seeds are equal", () => {
    expect(bind("s", "s", differ)).toMatchObject({
      refusal: { error: "settings-differ" },
      verdict: "refused",
    });
  });

  it("compares numbers and booleans strictly", () => {
    expect(
      bind(null, null, { file: "7", name: "crystals", run: 7 }),
    ).toMatchObject({
      refusal: { detail: "crystals: 7 / 7", error: "settings-differ" },
    });
    expect(
      bind(null, null, { file: true, name: "keys", run: false }),
    ).toMatchObject({
      verdict: "refused",
    });
    expect(bind(null, null, { file: 0, name: "n", run: 0 })).toEqual({
      facts: 1,
      verdict: "not-verified",
    });
  });

  describe("not verified when nothing proves or contradicts", () => {
    it.each([
      ["no seed on either side", null, null],
      ["no seed in the run (a manual run)", null, "9MQ9gO1wMD"],
      ["no seed in the file (Map Rando, a renamed file)", "9MQ9gO1wMD", null],
    ])("%s", (_name, run, file) => {
      expect(bind(run, file, agree)).toEqual({
        facts: 1,
        verdict: "not-verified",
      });
    });

    it("a side that does not state a fact contradicts nothing", () => {
      expect(
        bind(
          null,
          null,
          { file: "x", name: "a", run: null },
          { file: null, name: "b", run: "y" },
        ),
      ).toEqual({ facts: 0, verdict: "not-verified" });
    });

    it("no evidence at all", () => {
      expect(bind(null, null)).toEqual({ facts: 0, verdict: "not-verified" });
    });
  });

  it("clips a long value in the refusal's detail", () => {
    const got = bind(null, null, {
      file: "b".repeat(500),
      name: "n",
      run: "a",
    });
    expect(got.verdict).toBe("refused");
    if (got.verdict === "refused") {
      expect(got.refusal.detail?.length).toBeLessThanOrEqual(80);
    }
  });
});
