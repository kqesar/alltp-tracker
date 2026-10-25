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

  it("works out what the go mode misses for the run's goal", () => {
    const midgame = analysisOf(MIDGAME).goMode;
    expect(midgame && waysText(midgame)).toBe(
      "Titan's Mitt + Hookshot + 7 crystals",
    );
    // Too far from the start to say within three things
    expect(analysisOf(FRESH).goMode).toEqual({ sets: [], truncated: false });
    for (const preset of ["all-dungeons", "triforce-hunt"]) {
      expect(analysisOf(inputsOf({}, { preset })).goMode, preset).toBe(
        undefined,
      );
    }
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
