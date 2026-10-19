// What each check is missing and why one is only possible, worked out from
// the pack's blockers and explanations over real runs.
import { describe, expect, it } from "vitest";
import { items as freshItems, type ItemState } from "@/games/alttpr/data/items";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import {
  analyzeRun,
  goModeStatusOf,
  type Missing,
} from "@/games/alttpr/logic/missing";
import { type Ways, waysText } from "@/games/alttpr/logic/needs";
import {
  type Inputs,
  setCrossedSolver,
  solutionOf,
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
    // Keys stay in their dungeons outside keysanity; magic, bombs and
    // hearts have no cell
    expect(
      named.filter((key) =>
        /^(key[A-Z]|bigKey|magic>|tenBombs|heart)/.test(key),
      ),
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
