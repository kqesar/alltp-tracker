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

  it("shows them in logic with the 12 hearts basic placement waits for", () => {
    const twelve = run(12, ALIVE);
    expect(dungeonStateOf("misery-mire", twelve)).toBe("available");
    expect(locationStateOf(BIG_CHEST, twelve)).toBe("available");
  });

  it("counts the 3 hearts Link starts with, as upstream's hasHealth does", () => {
    // Randomizer.php:46-56 gives every world three heart containers, which
    // hasHealth sums (ItemCollection.php:546-553): hasHealth(12) is 12
    // hearts on screen, hasHealth(7) 7
    const late = [
      "ice-palace/compass-chest",
      "misery-mire/big-chest",
      "turtle-rock/compass-chest",
      "ganons-tower/bobs-torch",
    ];
    const early = [
      "palace-of-darkness/shooter-room",
      "swamp-palace/entrance",
      "skull-woods/compass-chest",
      "thieves-town/ambush-chest",
    ];
    const at = (hearts: number) => {
      const tris = solutionOf(run(hearts)).tris;
      return Object.fromEntries(
        [...late, ...early].map((id) => [id, tris[id]]),
      );
    };
    const all = (ids: string[], tri: string) =>
      Object.fromEntries(ids.map((id) => [id, tri]));
    expect(at(12)).toEqual({ ...all(late, "yes"), ...all(early, "yes") });
    expect(at(11)).toEqual({ ...all(late, "no"), ...all(early, "yes") });
    expect(at(7)).toEqual({ ...all(late, "no"), ...all(early, "yes") });
    expect(at(6)).toEqual({ ...all(late, "no"), ...all(early, "no") });
    for (const id of ["ice-palace", "ganons-tower"] as const) {
      expect(dungeonStateOf(id, run(11))).toBe("margin");
    }
    expect(locationStateOf("palace-of-darkness/shooter-room", run(6))).toBe(
      "margin",
    );
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
    // 6 hearts: one short of Palace of Darkness's 7, and no light
    const dark = run(6, { firerod: false, lantern: false });
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
    expect(missing?.margin).toEqual({ gates: ["miseryMire"], hearts: 11 });
    expect(missing && waysText(missing.inLogic)).toBe("12 hearts");
    // A check out of logic for something else says no margin
    const dark = run(6, { firerod: false, lantern: false });
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
      { gates: ["palaceOfDarkness"], hearts: 6 },
      undefined,
    ]);
  });

  it("shows Turtle Rock's laser bridge without protection, and names it", () => {
    const bare = run(15, { boss9: 0, byrna: false, cape: false, shield: 2 });
    const BRIDGE = "turtle-rock/eye-bridge/top-right";
    expect(solutionOf(bare).tris[BRIDGE]).toBe("no");
    expect(locationStateOf(BRIDGE, bare)).toBe("margin");
    const missing = analyzeRun(solutionOf(bare), bare.settings).missing.get(
      BRIDGE,
    );
    expect(missing?.margin).toEqual({ gates: ["laserBridge"] });
    expect(missing && waysText(missing.inLogic)).toBe(
      "Cane of Byrna, or Magic Cape, or Mirror Shield",
    );
  });

  it("shows a boss Basic wants a better weapon for, and names it", () => {
    // The Fighter's Sword, no magic: Ice Palace's way in and Kholdstare
    // both wait for the Master Sword
    const fighter = run(15, { boss7: 0, bottle: 0, magic: 0, sword: 1 });
    expect(bossStateOf("ice-palace", fighter)).toBe("margin");
    const analysis = analyzeRun(solutionOf(fighter), fighter.settings);
    expect(analysis.missing.get("ice-palace/boss")?.margin?.gates).toEqual([
      "icePalace",
      "kholdstare",
    ]);
    // Swamp Palace lets the Fighter's Sword in; Arrghus alone waits for
    // the Master Sword
    const swamp = run(15, { boss4: 0, sword: 1 });
    expect(dungeonStateOf("swamp-palace", swamp)).not.toBe("margin");
    expect(bossStateOf("swamp-palace", swamp)).toBe("margin");
    expect(
      analyzeRun(solutionOf(swamp), swamp.settings).missing.get(
        "swamp-palace/boss",
      )?.margin?.gates,
    ).toEqual(["arrghus"]);
    expect(bossStateOf("swamp-palace", run(15, { boss4: 0, sword: 2 }))).toBe(
      "available",
    );
  });
});

describe("the go mode outside basic placement's margin", () => {
  it("is reached but for the margin with 11 hearts", () => {
    const eleven = run(11);
    expect(goModeStatusOf(eleven)?.tri).toBe("no");
    expect(goModeMarginOf(eleven)).toBe(true);
    const left = analyzeRun(solutionOf(eleven), eleven.settings).goMode;
    expect(left?.kind === "items" && waysText(left.ways)).toBe("12 hearts");
  });

  it("is in logic with 12 hearts, and not without the margin's say", () => {
    const twelve = run(12);
    expect(goModeStatusOf(twelve)?.tri).toBe("yes");
    expect(goModeMarginOf(twelve)).toBe(false);
  });

  it("is not yet in an advanced run, or one short of more than the margin", () => {
    expect(goModeMarginOf(run(11, {}, { itemPlacement: "advanced" }))).toBe(
      false,
    );
    // The Moon Pearl is no part of any margin
    const noPearl = run(11, { moonpearl: false });
    expect(goModeStatusOf(noPearl)?.tri).toBe("no");
    expect(goModeMarginOf(noPearl)).toBe(false);
  });

  it("is reached but for Ganon's margin without silvers or the Tempered Sword", () => {
    // Basic placement asks them of Ganon; the advanced placement does not
    for (const items of [{ bow: 2 }, { sword: 2 }]) {
      const short = run(15, items);
      expect(goModeStatusOf(short)?.tri).toBe("no");
      expect(goModeMarginOf(short)).toBe(true);
    }
    // A swordless run wants the silvers whatever the placement
    const swordless = run(15, { bow: 2, sword: 0 }, { swordless: true });
    expect(goModeStatusOf(swordless)?.tri).toBe("no");
    expect(goModeMarginOf(swordless)).toBe(false);
  });
});
