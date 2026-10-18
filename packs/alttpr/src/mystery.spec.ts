// A Mystery run: settings the player has not discovered yet are UNKNOWN in
// the config, every setting derived from one is unknown to the engine, and
// the solved world is sound: whatever it says yes or no to stays so for
// every value the hidden settings may have.
import { type State, solve } from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { goModeOf } from "./goals";
import { compile } from "./pack";
import { settingsFromUpstream, UNKNOWN, type UpstreamConfig } from "./settings";
import { EMPTY_INPUT, type TrackerInput, toState } from "./tracker";

/** What a Mystery run hides, and the site's defaults for the rest. */
const HIDDEN = {
  accessibility: UNKNOWN,
  "crystals.ganon": UNKNOWN,
  "crystals.tower": UNKNOWN,
  dungeonItems: "standard",
  goal: UNKNOWN,
  "item.functionality": UNKNOWN,
  "item.pool": UNKNOWN,
  itemPlacement: UNKNOWN,
  logic: "NoGlitches",
  "mode.weapons": UNKNOWN,
} as const satisfies UpstreamConfig;

describe("a Mystery run's settings", () => {
  it("are unknown where they come from a hidden value", () => {
    const settings = settingsFromUpstream("open", HIDDEN);
    expect(settings).toMatchObject({
      advancedPlacement: UNKNOWN,
      basicPlacement: UNKNOWN,
      catchableFairies: UNKNOWN,
      crystalsGanon: { between: [0, 7] },
      crystalsTower: { between: [0, 7] },
      dungeonsGoal: UNKNOWN,
      forceSkullWoodsKey: UNKNOWN,
      fullBottleMagic: UNKNOWN,
      ganonGoal: UNKNOWN,
      locationsAccessibility: UNKNOWN,
      mirrorShieldInPool: UNKNOWN,
      requireBetterBow: UNKNOWN,
      swordless: UNKNOWN,
    });
    // What the run states stays known
    expect(settings).toMatchObject({ wildKeys: false, wildMaps: false });
  });

  it("derive what they settle as soon as one input does", () => {
    // Swordless asks for the silvers whatever the placement
    expect(
      settingsFromUpstream("open", { ...HIDDEN, "mode.weapons": "swordless" })
        .requireBetterBow,
    ).toBe(true);
    // Basic placement with swords: still unknown until the placement is
    expect(
      settingsFromUpstream("open", { ...HIDDEN, "mode.weapons": "randomized" })
        .requireBetterBow,
    ).toEqual(UNKNOWN);
    // Hard functionality catches no fairy, whatever else
    expect(
      settingsFromUpstream("open", { ...HIDDEN, "item.functionality": "hard" })
        .catchableFairies,
    ).toBe(false);
  });

  it("have no go mode while the goal is hidden", () => {
    expect(goModeOf(settingsFromUpstream("open", HIDDEN))).toBeUndefined();
  });

  it("let Ganon's Tower in for sure with 7 crystals, maybe with fewer", () => {
    // Advanced placement asks no hearts of the tower's door (GanonsTower.php)
    const world = compile(OPEN_END);
    const crystals = (n: number): State => {
      const state: Record<string, number | boolean | undefined> = {
        ...toState(END, OPEN_END),
      };
      for (let i = 1; i <= 7; i++) state[`crystal${i}`] = i <= n ? 1 : 0;
      return state;
    };
    const torch = (n: number) =>
      solve(world, crystals(n)).location("ganons-tower/bobs-torch");
    expect(torch(7)).toBe("yes");
    expect(torch(3)).toBe("maybe");
    expect(torch(0)).toBe("maybe");
  });
});

/** Everything a player can hold at the end of a run. */
const END: TrackerInput = {
  ...EMPTY_INPUT,
  items: {
    armor: 2,
    bombos: 1,
    bookOfMudora: 1,
    boomerang: 1,
    bottle: 4,
    bow: 1,
    bugCatchingNet: 1,
    caneOfByrna: 1,
    caneOfSomaria: 1,
    cape: 1,
    ether: 1,
    fireRod: 1,
    flippers: 1,
    flute: 1,
    glove: 2,
    hammer: 1,
    hookshot: 1,
    iceRod: 1,
    lamp: 1,
    magicMirror: 1,
    moonPearl: 1,
    mushroom: 1,
    pegasusBoots: 1,
    powder: 1,
    quake: 1,
    redBoomerang: 1,
    shield: 3,
    shovel: 1,
    silverArrowUpgrade: 1,
    sword: 4,
  },
};
/** A Mystery run whose goal and placement the player has found. */
const OPEN_END = settingsFromUpstream("open", {
  ...HIDDEN,
  goal: "ganon",
  itemPlacement: "advanced",
});

/** One value for each hidden setting: what the run turns out to be. */
const completion: fc.Arbitrary<UpstreamConfig> = fc.record({
  accessibility: fc.constantFrom("items", "locations", "none"),
  "crystals.ganon": fc.integer({ max: 7, min: 0 }),
  "crystals.tower": fc.integer({ max: 7, min: 0 }),
  dungeonItems: fc.constant("standard"),
  goal: fc.constantFrom(
    "completionist",
    "dungeons",
    "fast_ganon",
    "ganon",
    "pedestal",
  ),
  "item.functionality": fc.constantFrom(
    "expert",
    "hard",
    "normal",
    "superexpert",
  ),
  "item.pool": fc.constantFrom("expert", "hard", "normal", "superexpert"),
  itemPlacement: fc.constantFrom("advanced", "basic"),
  logic: fc.constant("NoGlitches"),
  "mode.weapons": fc.constantFrom(
    "assured",
    "randomized",
    "swordless",
    "vanilla",
  ),
});

/** Some of what a player holds: from nothing to the end of a run. */
const holding: fc.Arbitrary<State> = fc
  .subarray(Object.entries(END.items))
  .map((items) =>
    toState({ ...EMPTY_INPUT, items: Object.fromEntries(items) }, OPEN_END),
  );

describe("a Mystery run's world", () => {
  it.each(["open", "standard", "inverted"] as const)(
    "in %s, is no surer of anything than the run it turns out to be",
    (mode) => {
      const hidden = compile(settingsFromUpstream(mode, HIDDEN));
      fc.assert(
        fc.property(completion, holding, (config, state) => {
          const guess = solve(hidden, state);
          const run = solve(compile(settingsFromUpstream(mode, config)), state);
          for (const [id, level] of Object.entries(guess.locations())) {
            if (level !== "maybe")
              expect([id, run.location(id)]).toEqual([id, level]);
          }
        }),
        { numRuns: 40 },
      );
    },
  );
});
