// What each check is missing and why one is only possible, worked out from
// the pack's blockers and explanations over real runs.
import {
  type DungeonId,
  LEGACY_DUNGEONS,
  type TrickId,
} from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import {
  items as freshItems,
  type ItemState,
  itemsMax,
} from "@/games/alttpr/data/items";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import { DEFAULT_TRICKS, type TrickPrefs } from "@/games/alttpr/data/tricks";
import {
  analyzeRun,
  compactSpots,
  dungeonMissing,
  goModeLeftOf,
  goModeStatusOf,
  groupMissing,
  type Missing,
} from "@/games/alttpr/logic/missing";
import { type Ways, waysText } from "@/games/alttpr/logic/needs";
import {
  bossStateOf,
  type Inputs,
  locationLabel,
  locationStateOf,
  markerById,
  setCrossedSolver,
  solutionOf,
  trickSolutionOf,
} from "@/games/alttpr/logic/solution";
import END_GAME from "../../../../e2e/fixtures/end-game.json";

/** A run of a preset with these cells set. */
const inputsOf = (
  items: Partial<ItemState>,
  {
    preset = "open",
    settings = getPreset(preset).settings,
    smallKeys = Array(10).fill(0),
  }: { preset?: string; settings?: RunSettings; smallKeys?: number[] } = {},
): Inputs => ({
  items: { ...freshItems, ...items } as ItemState,
  medallions: Array(10).fill(0),
  settings,
  smallKeys,
});

const analysisOf = (inputs: Inputs) =>
  analyzeRun(solutionOf(inputs), inputs.settings);

const NONE: Ways = { sets: [], truncated: true };

/** A location's missing ways, as text, and what else says it. */
const words = (missing: Missing | undefined) =>
  missing && {
    doubts: missing.doubts,
    inLogic: waysText(missing.inLogic),
    possible: missing.possible && waysText(missing.possible),
    tri: missing.tri,
  };

const FRESH = inputsOf({});

/** Up to the Dark World's Death Mountain, without the Mire's medallion. */
const MIRE = inputsOf({
  bombos: true,
  firerod: true,
  flute: true,
  glove: 2,
  hookshot: true,
  lantern: true,
  moonpearl: true,
  sword: 1,
});

/** Agahnim beaten, the hammer and a bow: the Dark World's south. */
const MIDGAME = inputsOf({
  agahnim: 1,
  boots: true,
  bow: 2,
  glove: 1,
  hammer: true,
  lantern: true,
  moonpearl: true,
  sword: 2,
});

describe("a retro run", () => {
  it("shoots once an arrow shop is found, and opens every door once a key shop is", () => {
    // Agahnim beaten, the hammer, a bow without silvers, the lamp
    const retro = (items: Partial<ItemState>) =>
      solutionOf(inputsOf({ ...MIDGAME.items, ...items }, { preset: "retro" }));
    const tri = (items: Partial<ItemState>, id: string) =>
      retro(items).tris[id];

    expect(retro({}).modelled).toBe(true);
    // The rupee bow shoots nothing until an arrow is bought
    expect(tri({}, "eastern-palace/boss")).toBe("no");
    expect(tri({ shoparrow: true }, "eastern-palace/boss")).not.toBe("no");
    // A generic key may open another dungeon's door: maybe, until keys sell
    expect(tri({ shoparrow: true }, "palace-of-darkness/compass-chest")).toBe(
      "maybe",
    );
    expect(
      tri(
        { shoparrow: true, shopkey: true },
        "palace-of-darkness/compass-chest",
      ),
    ).toBe("yes");
  });
});

/**
 * Every item held but the weapons that would make magic redundant, medallions
 * and keys all there: what is left to decide is the magic.
 */
const unarmed = (
  preset: string,
  items: Partial<ItemState>,
): ReturnType<typeof inputsOf> => ({
  ...inputsOf(
    {
      ...Object.fromEntries(
        Object.entries(freshItems)
          .filter(([id]) => !/^(boss|chest|magic$)/.test(id))
          .map(([id, fresh]) => [
            id,
            typeof fresh === "boolean" ? true : itemsMax[id],
          ]),
      ),
      boomerang: 0,
      bottle: 0,
      bow: 0,
      hammer: false,
      net: false,
      sword: 0,
      ...items,
    },
    { preset, smallKeys: Array(10).fill(9) },
  ),
  medallions: Array(10).fill(1),
});

describe("half magic", () => {
  it("lets a rod or a cane do what no sword, bow, hammer or bottle does", () => {
    // Mothula, in a swordless run, falls to the Fire Rod with magic to spare
    const mothula = (items: Partial<ItemState>) =>
      solutionOf(unarmed("swordless", items)).tris["skull-woods/boss"];

    expect(mothula({})).toBe("no");
    expect(mothula({ magic: 1 })).toBe("yes");
  });

  it("tells a quarter magic from a half, which wants a bottle for what a quarter does alone", () => {
    // Trinexx wants four bars of magic for a Fighter's Sword
    const trinexx = (items: Partial<ItemState>) =>
      solutionOf(unarmed("inverted", { sword: 1, ...items })).tris[
        "turtle-rock/boss"
      ];

    expect(trinexx({})).toBe("no");
    expect(trinexx({ magic: 1 })).toBe("no");
    expect(trinexx({ magic: 2 })).toBe("yes");
    expect(trinexx({ bottle: 1, magic: 1 })).toBe("yes");
  });
});

describe("analyzeRun", () => {
  it("lists what a check out of logic is missing, and nothing in logic", () => {
    const { missing } = analysisOf(FRESH);
    expect(words(missing.get("library"))).toEqual({
      doubts: [],
      inLogic: "Pegasus Boots",
      possible: undefined,
      tri: "no",
    });
    expect(waysText(missing.get("kings-tomb")?.inLogic ?? NONE)).toBe(
      "Titan's Mitt + Pegasus Boots",
    );
    expect(waysText(missing.get("pyramid")?.inLogic ?? NONE)).toBe(
      "Agahnim, or Zora's Flippers + Titan's Mitt + Moon Pearl, or Power Glove + Hammer + Moon Pearl",
    );
    // In logic from the start: nothing to say
    expect(missing.has("links-house")).toBe(false);
    for (const [id, { tri }] of missing) expect(tri, id).not.toBe("yes");
    expect(missing.size).toBeGreaterThan(150);
  });

  it("asks only for what the cells can mark", () => {
    const { missing } = analysisOf(FRESH);
    const named = [...missing.values()].flatMap((m) =>
      m.inLogic.sets.flat().map((need) => need.key),
    );
    // Keys stay in their dungeons outside keysanity; bombs and hearts have
    // no cell
    expect(
      named.filter((key) => /^(key[A-Z]|bigKey|tenBombs|heart)/.test(key)),
    ).toEqual([]);
    expect(named).toContain("pegasusBoots>=1");
  });

  it("says more than three things stand between with an empty list", () => {
    const tablet = analysisOf(FRESH).missing.get("bombos-tablet");
    expect(tablet?.inLogic).toEqual({ sets: [], truncated: false });
  });

  it("gives what makes a check possible when it is less than what puts it in logic", () => {
    const lobby = analysisOf(MIDGAME).missing.get("misery-mire/main-lobby");
    expect(words(lobby)).toMatchObject({
      inLogic: "",
      possible:
        "Bombos Medallion + Flute + Titan's Mitt, or Ether Medallion + Flute + Titan's Mitt, or Flute + Titan's Mitt + Quake Medallion",
      tri: "no",
    });
  });

  it("says a pad's medallion not noted is why its dungeon is only possible", () => {
    const lobby = analysisOf(MIRE).missing.get("misery-mire/main-lobby");
    expect(words(lobby)).toEqual({
      doubts: [{ dungeon: "Misery Mire", kind: "medallion" }],
      inLogic: "Ether Medallion + Quake Medallion",
      possible: undefined,
      tri: "maybe",
    });
  });

  it("names where a key may hide when the rules want nothing more", () => {
    const chest = analysisOf(MIDGAME).missing.get("skull-woods/big-chest");
    expect(chest?.tri).toBe("maybe");
    // With every key, the big chest is in logic: nothing to collect
    expect(chest?.inLogic.sets).toEqual([[]]);
    expect(chest?.doubts).toContainEqual({
      dungeon: "Skull Woods",
      key: "big key",
      kind: "keys",
      spots: expect.arrayContaining(["Big Chest", "Bridge Room"]),
    });
    for (const doubt of chest?.doubts ?? []) expect(doubt.kind).toBe("keys");
  });

  it("says a placement the rules ask about, with the keys the player counts", () => {
    const keysanity = inputsOf(
      {
        agahnim: 1,
        bow: 2,
        flippers: true,
        glove: 2,
        hammer: true,
        lantern: true,
        moonpearl: true,
        sword: 2,
      },
      { preset: "keysanity", smallKeys: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    );
    const chest = analysisOf(keysanity).missing.get(
      "palace-of-darkness/big-key-chest",
    );
    expect(words(chest)).toEqual({
      doubts: [{ kind: "placement" }],
      inLogic: "6 Palace of Darkness small keys",
      possible: undefined,
      tri: "maybe",
    });
  });

  it("has no go mode to work out for a goal without one", () => {
    for (const preset of ["all-dungeons", "triforce-hunt"]) {
      expect(analysisOf(inputsOf({}, { preset })).goMode, preset).toBe(
        undefined,
      );
    }
  });
});

describe("what the go mode is missing, crystals aside", () => {
  /** The browser tests' end of a run, with these cells and settings. */
  const endGame = (
    items: Partial<ItemState>,
    settings: Partial<RunSettings> = {},
  ): Inputs => {
    const { state } = END_GAME;
    return {
      items: { ...state.items, ...items } as ItemState,
      medallions: state.medallions,
      settings: { ...(state.settings as RunSettings), ...settings },
      smallKeys: state.smallKeys,
    };
  };

  /** The go mode's ways as text, or the kind of what is left. */
  const left = (inputs: Inputs) => {
    const found = analysisOf(inputs).goMode;
    return found?.kind === "items" ? waysText(found.ways) : found?.kind;
  };

  it("lists the items left, never the crystals", () => {
    // Was "Titan's Mitt + Hookshot + 7 crystals": the crystals are the board's
    expect(goModeStatusOf(MIDGAME)?.tri).toBe("no");
    expect(left(MIDGAME)).toBe("Titan's Mitt + Hookshot");
    // A third item and the crystals still fit: they no longer take its place
    expect(
      left(
        endGame({
          boss7: 0,
          boss8: 0,
          boss9: 0,
          glove: 1,
          moonpearl: false,
          sword: 1,
        }),
      ),
    ).toBe("Titan's Mitt + Moon Pearl + Master Sword");
  });

  it("gives every way, the fewest items first", () => {
    const far = endGame(
      { agahnim: 0, glove: 0, hammer: false, moonpearl: false },
      { goal: "fast-ganon" },
    );
    expect(left(far)).toBe(
      "Agahnim + Moon Pearl, or Titan's Mitt + Moon Pearl, or Power Glove + Hammer + Moon Pearl",
    );
    expect(left(endGame({ firerod: false, lantern: false }))).toBe(
      "Fire Rod, or Lantern",
    );
  });

  it("says when only crystals are left", () => {
    const crystals = endGame({ boss7: 0, boss8: 0, boss9: 0 });
    expect(goModeStatusOf(crystals)?.tri).toBe("no");
    expect(analysisOf(crystals).goMode).toEqual({ kind: "crystals" });
  });

  it("has nothing left once in go mode", () => {
    const end = endGame({});
    expect(goModeStatusOf(end)?.tri).toBe("yes");
    expect(analysisOf(end).goMode).toEqual({ kind: "nothing" });
  });

  it("says more than three items away with an empty list", () => {
    expect(analysisOf(FRESH).goMode).toEqual({
      kind: "items",
      ways: { sets: [], truncated: false },
    });
  });

  it("asks a Mystery run with its hearts not set for hearts on screen", () => {
    // The item placement hidden may be basic, whose dungeons want hearts
    const mystery = endGame(
      { hearts: 0, sword: 1 },
      { hidden: ["swordless", "itemPlacement", "crystalsGanon"] },
    );
    expect(goModeStatusOf(mystery)?.tri).toBe("maybe");
    expect(left(mystery)).toBe("15 hearts + Tempered Sword");
  });

  it("follows the pedestal goal's pendants", () => {
    expect(
      left(endGame({ boss0: 0, boss1: 0, boss2: 0 }, { goal: "pedestal" })),
    ).toBe("Pendant of Courage + Pendant of Power + Pendant of Wisdom");
  });

  describe("goModeLeftOf", () => {
    const ways = (...sets: string[][]): Ways => ({
      sets: sets.map((set) => set.map((label) => ({ key: label, label }))),
      truncated: false,
    });
    const never = () => {
      throw new Error("not asked");
    };

    it("tells crystals from nothing left when nothing is to get with them", () => {
      expect(goModeLeftOf(ways([]), () => ways(["7 crystals"]), never)).toEqual(
        { kind: "crystals" },
      );
      expect(goModeLeftOf(ways([]), () => ways([]), never)).toEqual({
        kind: "nothing",
      });
    });

    it("says no item settles it when everything held would not", () => {
      expect(goModeLeftOf(ways(), never, () => false)).toEqual({
        kind: "unknown",
      });
      expect(goModeLeftOf(ways(), never, () => true)).toEqual({
        kind: "items",
        ways: ways(),
      });
    });

    it("puts the fewest items first", () => {
      expect(goModeLeftOf(ways(["a", "b"], ["c"]), never, never)).toEqual({
        kind: "items",
        ways: ways(["c"], ["a", "b"]),
      });
    });
  });
});

describe("goModeStatusOf", () => {
  const withGoal = (goal: RunSettings["goal"]) =>
    inputsOf({}, { settings: { ...getPreset("open").settings, goal } });

  it("says where the run stands, once per solution", () => {
    const status = goModeStatusOf(FRESH);
    expect(status?.tri).toBe("no");
    expect(status?.steps.map((step) => step.location)).toEqual([
      "agahnim-2",
      "ganon",
    ]);
    // A new object for the same run is the same solution: the same answer
    expect(goModeStatusOf({ ...FRESH })).toBe(status);
  });

  it("has none for all dungeons and the triforce hunt", () => {
    expect(goModeStatusOf(withGoal("all-dungeons"))).toBe(undefined);
    expect(goModeStatusOf(withGoal("triforce-hunt"))).toBe(undefined);
  });

  it("has none, nor any analysis, under logic the pack does not model", () => {
    const crosskeys = inputsOf({}, { preset: "crosskeys" });
    const solution = solutionOf(crosskeys);

    expect(solution.modelled).toBe(false);
    // Every check is maybe, the Open logic's yes and no alike
    expect(new Set(Object.values(solution.tris))).toEqual(new Set(["maybe"]));
    expect(new Set(Object.values(solution.visibles))).toEqual(
      new Set(["maybe"]),
    );
    expect(goModeStatusOf(crosskeys)).toBe(undefined);
    expect(analysisOf(crosskeys)).toEqual({ missing: new Map(), solution });
    expect(solutionOf(FRESH).modelled).toBe(true);
  });

  it("follows the pedestal and fast Ganon goals", () => {
    const steps = (goal: RunSettings["goal"]) =>
      goModeStatusOf(withGoal(goal))?.steps.map((step) => step.location);
    expect(steps("pedestal")).toEqual(["master-sword-pedestal"]);
    expect(steps("fast-ganon")).toEqual(["ganon"]);
  });
});

describe("a run with shuffled entrances", () => {
  it("says what a check behind a noted door misses, in items", async () => {
    const { solver } = await import("@/games/alttpr/logic/crossed");
    setCrossedSolver(solver);
    const inputs: Inputs = {
      ...inputsOf({}, { preset: "crosskeys" }),
      // Blind's Hideout behind the Big Bomb Shop's door, in the Dark World
      entrances: { "big-bomb-shop": "blinds-hideout" },
    };
    const { missing } = analysisOf(inputs);
    // Behind a door not noted, everything held would not bring it
    expect(missing.get("blacksmith")?.inLogic).toEqual({
      door: true,
      sets: [],
      truncated: false,
    });
    expect(words(missing.get("blinds-hideout/top"))).toMatchInlineSnapshot(`
      {
        "doubts": [],
        "inLogic": "Titan's Mitt + Moon Pearl, or Agahnim + Hammer + Moon Pearl, or Power Glove + Hammer + Moon Pearl",
        "possible": undefined,
        "tri": "no",
      }
    `);
  });
});

describe("compactSpots", () => {
  it("folds the checks of a shared room into the room with a count", () => {
    expect(
      compactSpots([
        "Big Chest",
        "Dark Basement - Left",
        "Compass Chest",
        "Dark Basement - Right",
        "Dark Maze - Top",
        "Dark Maze - Bottom",
        "Boss",
      ]),
    ).toEqual([
      { count: 1, name: "Big Chest" },
      { count: 2, name: "Dark Basement" },
      { count: 1, name: "Compass Chest" },
      { count: 2, name: "Dark Maze" },
      { count: 1, name: "Boss" },
    ]);
  });

  it("keeps the full name of a room with one check left", () => {
    expect(compactSpots(["Dark Basement - Left", "Boss"])).toEqual([
      { count: 1, name: "Dark Basement - Left" },
      { count: 1, name: "Boss" },
    ]);
    expect(compactSpots([])).toEqual([]);
  });
});

describe("what a dungeon's checks are missing, grouped", () => {
  const POD = "palace-of-darkness";

  /** Palace of Darkness in reach, without the Lantern or the Fire Rod. */
  const DARK = inputsOf({
    agahnim: 1,
    boots: true,
    bow: 2,
    flute: true,
    glove: 2,
    hammer: true,
    moonpearl: true,
    sword: 2,
  });

  /** A marker's checks as the tooltip lists them. */
  const checksOf = (inputs: Inputs, id: string) => {
    const marker = markerById(id);
    if (marker === undefined) throw new RangeError(id);
    return marker.locations.map((location) => ({
      id: location,
      label: locationLabel(marker, location),
      state: locationStateOf(location, { ...inputs, checked: {} }),
    }));
  };

  const groupsOf = (inputs: Inputs, id: DungeonId) =>
    dungeonMissing(
      checksOf(inputs, id),
      id,
      bossStateOf(id, inputs),
      analysisOf(inputs),
    );

  /** Every spot named, a room shared by two as "Name x2". */
  const named = (groups: ReturnType<typeof groupsOf>) =>
    groups.flatMap(({ spots }) =>
      spots.map(({ count, name }) => (count > 1 ? `${name} x${count}` : name)),
    );

  it("names what Palace of Darkness lacks without the Lantern, once per thing", () => {
    expect(
      groupsOf(DARK, POD).map(({ missing, spots }) => ({
        spots: named([{ key: "", missing, spots }]),
        tri: missing.tri,
        ways: waysText(missing.inLogic),
      })),
    ).toEqual([
      // Out of logic first: the Lantern lights the maze and opens the big chest
      {
        spots: ["Big Chest", "Dark Maze x2", "Boss"],
        tri: "no",
        ways: "Lantern",
      },
      // The basement is lit by the Fire Rod too
      {
        spots: ["Dark Basement x2"],
        tri: "no",
        ways: "Fire Rod, or Lantern",
      },
      // The rest wait on keys the tracker cannot place
      {
        spots: ["Big Key Chest", "Compass Chest", "Harmless Hellway"],
        tri: "maybe",
        ways: "",
      },
    ]);
  });

  it("says every check once, and none of those in logic", () => {
    const spots = named(groupsOf(DARK, POD));
    // Of the 14 checks, five are in logic
    expect(spots).toHaveLength(7);
    expect(spots).not.toContain("Shooter Room");
    expect(new Set(spots).size).toBe(spots.length);
  });

  it("does not depend on the order the checks come in", () => {
    const analysis = analysisOf(DARK);
    const checks = checksOf(DARK, POD);
    const keys = (given: readonly { id: string; label: string }[]) =>
      groupMissing(given, analysis)
        .map(({ key }) => key)
        .sort();
    expect(keys([...checks].reverse())).toEqual(keys(checks));
  });

  it("gives Castle Tower, whose rooms hold no boss, its prize's rule as Boss", () => {
    const inputs = inputsOf({ moonpearl: true });
    expect(named(groupsOf(inputs, "castle-tower"))).toContain("Boss");
  });

  it("leaves out a boss beaten", () => {
    const beaten = inputsOf({
      ...DARK.items,
      [`boss${LEGACY_DUNGEONS.indexOf(POD)}`]: 2,
    });
    const spots = named(groupsOf(beaten, POD));
    expect(spots).not.toContain("Boss");
    // The rest is still to say
    expect(spots).toContain("Big Chest");
  });
});

describe("the tricks that open a check", () => {
  const ALL: TrickPrefs = { ...DEFAULT_TRICKS, enabled: true };
  const known = (...techniques: TrickId[]): TrickPrefs => ({
    enabled: true,
    techniques,
  });
  /** The run's analysis with the tricks the player knows. */
  const withTricks = (inputs: Inputs, tricks: TrickPrefs) => {
    const run = { ...inputs, tricks };
    return analyzeRun(solutionOf(run), run.settings, trickSolutionOf(run));
  };

  it("says which known trick opens a check, and keeps what else would", () => {
    const analysis = withTricks(FRESH, known("fakeFlipper", "darkRooms"));

    const hobo = analysis.missing.get("hobo");
    expect(hobo?.tricks).toEqual([["fakeFlipper"]]);
    expect(waysText(hobo?.inLogic as Ways)).toBe("Zora's Flippers");
    expect(analysis.missing.get("sewers/secret-room/left")?.tricks).toEqual([
      ["darkRooms"],
    ]);
    // What no trick known opens says nothing of them
    expect(analysis.missing.get("kings-tomb")?.tricks).toBeUndefined();
    expect(analysis.tricks).toEqual(["fakeFlipper", "darkRooms"]);
  });

  it("names the tricks a check wants together, never one the player does not know", () => {
    // The ledge needs the fake flipper and the water walk, and the boots
    const run = inputsOf({ boots: true, glove: 1 });
    expect(withTricks(run, ALL).missing.get("zoras-ledge")?.tricks).toEqual([
      ["fakeFlipper", "waterWalk"],
    ]);
    expect(
      withTricks(run, known("fakeFlipper")).missing.get("zoras-ledge")?.tricks,
    ).toBeUndefined();
  });

  it("says nothing without tricks, and leaves every other answer as it was", () => {
    const plain = analysisOf(FRESH);
    expect(plain.tricks).toBeUndefined();
    const analysis = withTricks(FRESH, ALL);
    expect([...analysis.missing.keys()]).toEqual([...plain.missing.keys()]);
    for (const [id, missing] of analysis.missing) {
      const { tricks: _, ...rest } = missing;
      expect(rest, id).toEqual(plain.missing.get(id));
    }
  });

  it("groups a dungeon's checks by the trick that opens them", () => {
    // Palace of Darkness in reach, without the Lantern or the Fire Rod
    const run = inputsOf({
      agahnim: 1,
      boots: true,
      bow: 2,
      flute: true,
      glove: 2,
      hammer: true,
      moonpearl: true,
      sword: 2,
    });
    const marker = markerById("palace-of-darkness");
    const checks = marker.locations.map((id) => ({
      id,
      label: locationLabel(marker, id),
      state: locationStateOf(id, { ...run, checked: {} }),
    }));
    const groups = (tricks: TrickPrefs) =>
      dungeonMissing(
        checks,
        "palace-of-darkness",
        bossStateOf("palace-of-darkness", run),
        withTricks(run, tricks),
      ).map(({ missing, spots }) => ({
        spots: spots.map(({ count, name }) =>
          count > 1 ? `${name} x${count}` : name,
        ),
        tricks: missing.tricks,
      }));

    expect(groups(known("darkRooms"))).toEqual([
      {
        spots: ["Big Chest", "Dark Maze x2", "Boss"],
        tricks: [["darkRooms"]],
      },
      { spots: ["Dark Basement x2"], tricks: [["darkRooms"]] },
      // Maybe for its keys, so no trick to name
      {
        spots: ["Big Key Chest", "Compass Chest", "Harmless Hellway"],
        tricks: undefined,
      },
    ]);
    // Another trick opens none of them: the lines are as without tricks
    expect(
      groups(known("superBunny")).every(({ tricks }) => tricks === undefined),
    ).toBe(true);
  });

  it("is a different analysis from the same run's without them", () => {
    const solution = solutionOf(FRESH);
    const trick = trickSolutionOf({ ...FRESH, tricks: ALL });
    expect(analyzeRun(solution, FRESH.settings, trick).tricks).toBe(
      trick?.techniques,
    );
    expect(analyzeRun(solution, FRESH.settings).tricks).toBeUndefined();
  });
});

describe("the hearts, under the basic placement", () => {
  /** Open, basic placement: Agahnim beaten, a sword, a bottle, the pearl. */
  const basic = (hearts: number) =>
    inputsOf(
      { agahnim: 1, bottle: 1, hearts, moonpearl: true, sword: 1 },
      {
        settings: { ...getPreset("open").settings, itemPlacement: "basic" },
      },
    );
  const SHOOTER_ROOM = "palace-of-darkness/shooter-room";

  it("say a dungeon is maybe while the hearts are not set, and why", () => {
    const run = basic(0);
    expect(solutionOf(run).tris[SHOOTER_ROOM]).toBe("maybe");
    expect(words(analysisOf(run).missing.get(SHOOTER_ROOM))).toEqual({
      doubts: [{ basic: true, hearts: 10, kind: "hearts" }],
      inLogic: "10 hearts",
      possible: undefined,
      tri: "maybe",
    });
  });

  it("propose the hearts a dungeon lacks once they are set", () => {
    // 9 hearts on screen: 6 found, one short of upstream's hasHealth(7)
    const run = basic(7);
    expect(solutionOf(run).tris[SHOOTER_ROOM]).toBe("no");
    expect(words(analysisOf(run).missing.get(SHOOTER_ROOM))).toMatchObject({
      doubts: [],
      inLogic: "10 hearts",
      tri: "no",
    });
    // 10 hearts: in logic
    expect(solutionOf(basic(8)).tris[SHOOTER_ROOM]).toBe("yes");
  });
});

describe("the escape's Ten Bombs, which no cell draws", () => {
  /** Standard, nothing found: the escape's checks want a weapon. */
  const standard = (tenbombs: number) =>
    inputsOf({ tenbombs }, { preset: "standard" });
  const SECRET_ROOM = "sewers/secret-room/left";

  it("make the escape maybe while not known, never out of logic", () => {
    const run = standard(0);
    expect(solutionOf(run).tris[SECRET_ROOM]).toBe("maybe");
    expect(analysisOf(run).missing.get(SECRET_ROOM)?.doubts).toContainEqual({
      kind: "bombs",
    });
  });

  it("read as the game says once autotracking knows them", () => {
    // None found: out of logic, as upstream reads it
    expect(solutionOf(standard(1)).tris[SECRET_ROOM]).toBe("no");
    // Found: in logic, the key model holding the sewers' key
    expect(solutionOf(standard(2)).tris[SECRET_ROOM]).not.toBe("no");
  });
});
