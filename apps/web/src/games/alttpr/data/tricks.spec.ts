import { TRICK_IDS } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRICKS,
  MINOR_GLITCHES_GUIDE,
  restoreTricks,
  TRICK_WORDS,
  withTrick,
} from "@/games/alttpr/data/tricks";

describe("the tricks in words", () => {
  it("name, sum up and teach every trick the pack has", () => {
    expect(Object.keys(TRICK_WORDS).sort()).toEqual([...TRICK_IDS].sort());
    for (const id of TRICK_IDS) {
      const { guides, name, summary } = TRICK_WORDS[id];
      expect(name, id).not.toBe("");
      expect(summary, id).toMatch(/\.$/);
      expect(guides.length, id).toBeGreaterThan(0);
    }
  });

  it("links https pages only, each once, and a video's chapter by its second", () => {
    const urls = [
      MINOR_GLITCHES_GUIDE,
      ...TRICK_IDS.flatMap((id) => TRICK_WORDS[id].guides),
    ].map((guide) => guide.url);
    for (const url of urls) {
      const parsed = new URL(url);
      expect(parsed.protocol, url).toBe("https:");
      if (parsed.hostname === "www.youtube.com") {
        expect(parsed.searchParams.get("v"), url).toMatch(/^[\w-]{11}$/);
      }
    }
    expect(new Set(urls).size).toBe(urls.length);
    expect(TRICK_WORDS.fakeFlipper.guides[0]?.url).toMatch(/&t=874s$/);
  });
});

describe("restoreTricks", () => {
  it("starts off with every trick known", () => {
    expect(DEFAULT_TRICKS).toEqual({ enabled: false, techniques: TRICK_IDS });
  });

  it("keeps the known tricks, each once, in the pack's order", () => {
    expect(
      restoreTricks(
        {
          enabled: true,
          techniques: ["waterWalk", "nothing", "darkRooms", "waterWalk", 3],
        },
        DEFAULT_TRICKS,
      ),
    ).toEqual({ enabled: true, techniques: ["darkRooms", "waterWalk"] });
  });

  it.each([
    ["nothing", undefined],
    ["a string", "on"],
    ["a list", []],
    ["null", null],
  ])("falls back to the base for %s", (_, saved) => {
    expect(restoreTricks(saved, DEFAULT_TRICKS)).toBe(DEFAULT_TRICKS);
  });

  it("takes each field on its own", () => {
    expect(restoreTricks({ enabled: true }, DEFAULT_TRICKS)).toEqual({
      enabled: true,
      techniques: TRICK_IDS,
    });
    expect(
      restoreTricks({ enabled: 1, techniques: ["superBunny"] }, DEFAULT_TRICKS),
    ).toEqual({ enabled: false, techniques: ["superBunny"] });
    expect(restoreTricks({ techniques: "all" }, DEFAULT_TRICKS)).toEqual(
      DEFAULT_TRICKS,
    );
  });
});

describe("withTrick", () => {
  it("learns and forgets a trick, in the pack's order", () => {
    expect(withTrick(["waterWalk"], "darkRooms", true)).toEqual([
      "darkRooms",
      "waterWalk",
    ]);
    expect(withTrick(TRICK_IDS, "superBunny", false)).toEqual(
      TRICK_IDS.filter((id) => id !== "superBunny"),
    );
  });

  it("returns the same list when nothing changes", () => {
    const known = ["darkRooms"] as const;
    expect(withTrick(known, "darkRooms", true)).toBe(known);
    expect(withTrick(known, "waterWalk", false)).toBe(known);
  });
});
