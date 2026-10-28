// Basic placement's safety margin: a place out of logic only because Link
// lacks the hearts, sword or bottles basic placement waits for shows as
// doable outside the margin, not as out of logic; the logic itself, the go
// mode's tri and every other run read as before.
import { describe, expect, it } from "vitest";
import { heartsValue, type ItemState } from "@/games/alttpr/data/items";
import type { RunSettings } from "@/games/alttpr/data/presets";
import {
  analyzeRun,
  goModeMarginOf,
  goModeStatusOf,
  groupMissing,
} from "@/games/alttpr/logic/missing";
import { waysText } from "@/games/alttpr/logic/needs";
import {
  bossStateOf,
  dungeonStateOf,
  locationStateOf,
  type MarkerInputs,
  marginOf,
  marginShown,
  marginSolutionOf,
  solutionOf,
} from "@/games/alttpr/logic/solution";
import END_GAME from "../../../../e2e/fixtures/end-game.json";

/**
 * The browser tests' end of a run (every item, sword 4, 4 bottles, the Red
 * Mail), basic placement, with these hearts on screen and cells.
 */
const run = (
  hearts: number,
  items: Partial<ItemState> = {},
  settings: Partial<RunSettings> = {},
): MarkerInputs => {
  const { state } = END_GAME;
  return {
    checked: {},
    items: {
      ...state.items,
      hearts: heartsValue(hearts),
      ...items,
    } as ItemState,
    medallions: state.medallions,
    settings: {
      ...(state.settings as RunSettings),
      itemPlacement: "basic",
      ...settings,
    },
    smallKeys: state.smallKeys,
  };
};

/** Misery Mire's and Turtle Rock's bosses alive. */
const ALIVE = { boss8: 0, boss9: 0 } as const;
const BIG_CHEST = "misery-mire/big-chest";

describe("a place out of logic by basic placement's margin alone", () => {
  it("shows Misery Mire and Turtle Rock as doable outside it with 11 hearts", () => {
    const eleven = run(11, ALIVE);
    expect(solutionOf(eleven).tris[BIG_CHEST]).toBe("no");
    for (const id of ["misery-mire", "turtle-rock"] as const) {
      expect(dungeonStateOf(id, eleven)).toBe("margin");
      expect(bossStateOf(id, eleven)).toBe("margin");
    }
    expect(locationStateOf(BIG_CHEST, eleven)).toBe("margin");
  });

  it("shows them in logic with the 15 hearts basic placement waits for", () => {
    const fifteen = run(15, ALIVE);
    expect(dungeonStateOf("misery-mire", fifteen)).toBe("available");
    expect(locationStateOf(BIG_CHEST, fifteen)).toBe("available");
  });

  it("leaves an advanced placement run as it was", () => {
    const advanced = run(11, ALIVE, { itemPlacement: "advanced" });
    expect(marginShown(advanced)).toBe(false);
    expect(marginSolutionOf(advanced)).toBeUndefined();
    expect(marginOf(solutionOf(advanced))).toBeUndefined();
    expect(dungeonStateOf("misery-mire", advanced)).toBe("available");
  });

  it("leaves a placement not known yet at maybe", () => {
    const mystery = run(11, ALIVE, { hidden: ["itemPlacement"] });
    expect(marginShown(mystery)).toBe(false);
    expect(marginSolutionOf(mystery)).toBeUndefined();
    expect(dungeonStateOf("misery-mire", mystery)).toBe("possible");
  });

  it("leaves a crossed run, which has no margin world, as it was", () => {
    const crossed = run(11, ALIVE, {
      dungeonItems: "full",
      entranceShuffle: "crossed",
    });
    expect(marginShown(crossed)).toBe(false);
    expect(marginSolutionOf(crossed)).toBeUndefined();
  });

  it("keeps the dark rooms out of logic: the lamp is no part of the margin", () => {
    // 9 hearts: one short of Palace of Darkness's 10, and no light
    const dark = run(9, { firerod: false, lantern: false });
    expect(locationStateOf("palace-of-darkness/shooter-room", dark)).toBe(
      "margin",
    );
    expect(locationStateOf("palace-of-darkness/dark-maze/top", dark)).toBe(
      "unavailable",
    );
  });

  it("is solved once per solution, never by a click", () => {
    const eleven = run(11, ALIVE);
    const first = marginSolutionOf(eleven);
    expect(first).toBeDefined();
    expect(
      marginSolutionOf({ ...eleven, checked: { [BIG_CHEST]: true } }),
    ).toBe(first);
  });

  it("says what the seed waits for, and the hearts Link has", () => {
    const eleven = run(11, ALIVE);
    const analysis = analyzeRun(solutionOf(eleven), eleven.settings);
    const missing = analysis.missing.get(BIG_CHEST);
    expect(missing?.tri).toBe("no");
    expect(missing?.margin).toEqual({ hearts: 11 });
    expect(missing && waysText(missing.inLogic)).toBe("15 hearts");
    // A check out of logic for something else says no margin
    const dark = run(9, { firerod: false, lantern: false });
    const darkAnalysis = analyzeRun(solutionOf(dark), dark.settings);
    expect(
      darkAnalysis.missing.get("palace-of-darkness/dark-maze/top")?.margin,
    ).toBeUndefined();
    // Grouped apart from the checks out of logic
    const groups = groupMissing(
      [
        { id: "palace-of-darkness/shooter-room", label: "Shooter Room" },
        { id: "palace-of-darkness/dark-maze/top", label: "Dark Maze" },
      ],
      darkAnalysis,
    );
    expect(groups.map(({ missing }) => missing.margin)).toEqual([
      { hearts: 9 },
      undefined,
    ]);
  });
});

describe("the go mode outside basic placement's margin", () => {
  it("is reached but for the margin with 11 hearts", () => {
    const eleven = run(11);
    expect(goModeStatusOf(eleven)?.tri).toBe("no");
    expect(goModeMarginOf(eleven)).toBe(true);
    const left = analyzeRun(solutionOf(eleven), eleven.settings).goMode;
    expect(left?.kind === "items" && waysText(left.ways)).toBe("15 hearts");
  });

  it("is in logic with 15 hearts, and not without the margin's say", () => {
    const fifteen = run(15);
    expect(goModeStatusOf(fifteen)?.tri).toBe("yes");
    expect(goModeMarginOf(fifteen)).toBe(false);
  });

  it("is not yet in an advanced run, or one short of more than the margin", () => {
    expect(goModeMarginOf(run(11, {}, { itemPlacement: "advanced" }))).toBe(
      false,
    );
    // Basic placement's silver arrows for Ganon are no part of the margin
    const noSilvers = run(11, { bow: 2 });
    expect(goModeStatusOf(noSilvers)?.tri).toBe("no");
    expect(goModeMarginOf(noSilvers)).toBe(false);
  });
});
