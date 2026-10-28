// Boss shuffle: a dungeon's boss may be any its slot takes, so the board
// never reads a shuffled run as its vanilla bosses. The pack's slots
// (packs/alttpr/src/bosses.ts) say yes only when every boss the slot may
// hold is beaten, maybe when some is; these specs hold the board to them.
import { describe, expect, it } from "vitest";
import type { ItemState } from "@/games/alttpr/data/items";
import type { RunSettings } from "@/games/alttpr/data/presets";
import { goModeStatusOf } from "@/games/alttpr/logic/missing";
import {
  bossStateOf,
  type MarkerInputs,
  solutionOf,
} from "@/games/alttpr/logic/solution";
import END_GAME from "../../../../e2e/fixtures/end-game.json";

/** The browser tests' end of a run, with these cells and settings. */
const run = (
  items: Partial<ItemState>,
  settings: Partial<RunSettings> = {},
): MarkerInputs => {
  const { state } = END_GAME;
  return {
    checked: {},
    items: { ...state.items, ...items } as ItemState,
    medallions: state.medallions,
    settings: { ...(state.settings as RunSettings), ...settings },
    smallKeys: state.smallKeys,
  };
};

/** Misery Mire's and Turtle Rock's bosses alive, Link without a hookshot. */
const NO_HOOKSHOT = { boss8: 1, boss9: 1, hookshot: false } as const;

describe("a run with shuffled bosses", () => {
  it("reads a boss maybe while one its dungeon may hold is not beaten", () => {
    // Arrghus asks for the hookshot: Vitreous and Trinexx do not
    const vanilla = run(NO_HOOKSHOT);
    expect(bossStateOf("misery-mire", vanilla)).toBe("available");
    expect(bossStateOf("turtle-rock", vanilla)).toBe("available");
    for (const bossShuffle of ["simple", "full", "random"] as const) {
      const shuffled = run(NO_HOOKSHOT, { bossShuffle });
      expect(bossStateOf("misery-mire", shuffled), bossShuffle).toBe(
        "possible",
      );
      expect(bossStateOf("turtle-rock", shuffled), bossShuffle).toBe(
        "possible",
      );
      expect(solutionOf(shuffled).tris["misery-mire/boss"]).toBe("maybe");
    }
  });

  it("reads them in logic once every boss is beaten", () => {
    const shuffled = run({ boss8: 1, boss9: 1 }, { bossShuffle: "full" });
    expect(bossStateOf("misery-mire", shuffled)).toBe("available");
    expect(bossStateOf("turtle-rock", shuffled)).toBe("available");
  });

  it("reads none as shuffled when the run says none", () => {
    const none = run(NO_HOOKSHOT, { bossShuffle: "none" });
    expect(bossStateOf("misery-mire", none)).toBe("available");
  });

  it("keeps the go mode at maybe while Ganon's Tower's bosses may not fall", () => {
    // Trinexx asks for the ice rod: Armos, Lanmolas and Moldorm do not
    const noIceRod = { icerod: false } as const;
    expect(goModeStatusOf(run(noIceRod))?.tri).toBe("yes");
    expect(goModeStatusOf(run(noIceRod, { bossShuffle: "full" }))?.tri).toBe(
      "maybe",
    );
  });

  it("reads them maybe at most while a Mystery run hides the shuffle", () => {
    const hidden = run(NO_HOOKSHOT, { hidden: ["bossShuffle"] });
    expect(bossStateOf("misery-mire", hidden)).toBe("possible");
    expect(bossStateOf("misery-mire", run({ boss8: 1 }, hidden.settings))).toBe(
      "available",
    );
  });
});
