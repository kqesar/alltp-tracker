import { describe, expect, it } from "vitest";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import { capitalized, logicWordsOf } from "@/games/alttpr/logic/words";

const OPEN = getPreset("open").settings;
const noLogic = (play?: RunSettings["playGlitches"]): RunSettings => ({
  ...OPEN,
  glitches: "no_logic",
  ...(play === undefined ? {} : { playGlitches: play }),
});

describe("logicWordsOf", () => {
  it("says in and out of logic for a seed generated for a logic", () => {
    for (const settings of [
      OPEN,
      { ...OPEN, glitches: "overworld_glitches" } as const,
      { ...OPEN, glitches: "major_glitches" } as const,
    ]) {
      const words = logicWordsOf(settings);
      expect(words.noLogic).toBe(false);
      expect(words.yes).toBe("in logic");
      expect(words.yesFull).toBe("in logic");
      expect(words.yesWith).toBe("In logic with");
      expect(words.no).toBe("out of logic");
      expect(words.noShort).toBe("Out of logic");
      expect(words.states).toEqual({
        available: "available",
        margin: "out of logic, doable outside Basic's safety margin",
        opened: "done",
        possible: "maybe available",
        seen: "visible, not reachable yet",
        trick: "out of logic, doable with a trick",
        unavailable: "out of logic",
      });
    }
  });

  it("never says in logic for a No Logic seed: reachable without glitches", () => {
    const words = logicWordsOf(noLogic());
    expect(words.noLogic).toBe(true);
    expect(words.yes).toBe("reachable");
    expect(words.yesFull).toBe("reachable without glitches");
    expect(words.yesWith).toBe("Reachable with");
    expect(words.no).toBe("not reachable without glitches");
    expect(words.noShort).toBe("Not reachable");
    expect(words.states).toEqual({
      available: "available",
      margin:
        "not reachable without glitches, doable outside Basic's safety margin",
      opened: "done",
      possible: "maybe available",
      seen: "visible, not reachable yet",
      trick: "not reachable without glitches, doable with a trick",
      unavailable: "not reachable without glitches",
    });
    expect(
      Object.values(words)
        .flatMap((value) =>
          typeof value === "object" ? Object.values(value) : [value],
        )
        .some((text) => /in logic|out of logic/i.test(String(text))),
    ).toBe(false);
  });

  it("names the glitches a No Logic seed is played with", () => {
    expect(logicWordsOf(noLogic("overworld_glitches")).yesFull).toBe(
      "reachable with Overworld Glitches",
    );
    expect(logicWordsOf(noLogic("hybrid_major_glitches")).no).toBe(
      "not reachable with Hybrid Major Glitches",
    );
    expect(logicWordsOf(noLogic("major_glitches")).states.unavailable).toBe(
      "not reachable with Major Glitches",
    );
  });

  it("gives the same object for the same words, so a selector may return it", () => {
    expect(logicWordsOf(OPEN)).toBe(logicWordsOf({ ...OPEN }));
    expect(logicWordsOf(noLogic("major_glitches"))).toBe(
      logicWordsOf(noLogic("major_glitches")),
    );
  });

  it("capitalizes a sentence's start", () => {
    expect(capitalized("not reachable")).toBe("Not reachable");
  });
});
