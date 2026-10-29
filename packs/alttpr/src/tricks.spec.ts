// The tricks world: each trick's item reads as upstream's flag, all of them
// at 0 as the real world, and nothing a trick holds moves a fact the real
// world states (where items sit, Palace of Darkness's keys).
import {
  type CompiledWorld,
  compileWorld,
  type Expr,
  loadRules,
  parse,
  rank,
  type Solution,
  type State,
  solve,
} from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DERIVED_FACTS, derivedFacts } from "./derived";
import { filler } from "./fill";
import { ITEMS } from "./items";
import { solveWithKeys, untrackedItems } from "./keys";
import { MEDALLION_FACTS } from "./medallions";
import { compile, regionModules, STATE_NAMES } from "./pack";
import {
  type AlttprSettings,
  OPEN,
  STANDARD,
  settingsFromUpstream,
} from "./settings";
import { EMPTY_INPUT, type TrackerInput, toState } from "./tracker";
import {
  compileTricks,
  TRICK_IDS,
  TRICK_ITEMS,
  TRICK_RULES,
  TRICKS,
  type TrickId,
  trickFiller,
  trickModules,
  trickRequirement,
  trickState,
  tricksInLogic,
} from "./tricks";
import { buildWorld, type RegionModule } from "./world";

const INVERTED = settingsFromUpstream("inverted", {
  goal: "ganon",
  itemPlacement: "advanced",
});
const OWG = settingsFromUpstream("standard", { logic: "OverworldGlitches" });
const WORLDS = [
  ["Open", OPEN],
  ["Standard", STANDARD],
  ["Inverted", INVERTED],
  ["Standard, Overworld Glitches", OWG],
] as const;

/** Each trick's glitch flag, and the item that stands for it. */
const FLAGS = new Map<string, string>(
  TRICK_IDS.filter((id) => TRICKS[id].setting !== "requireLamp").map((id) => [
    TRICKS[id].setting,
    TRICKS[id].item,
  ]),
);

/** The settings that turn upstream's own switch on for each trick. */
function withTricks(
  settings: AlttprSettings,
  tricks: readonly TrickId[],
): AlttprSettings {
  const on: Record<string, boolean | number> = {};
  for (const id of tricks) {
    on[TRICKS[id].setting] = id === "darkRooms" ? 0 : true;
  }
  return { ...settings, ...on };
}

const real = new Map<string, CompiledWorld>();
/** The real world compiled with those tricks' switches on, once per set. */
function realWith(name: string, settings: AlttprSettings, tricks: TrickId[]) {
  const key = `${name}:${[...tricks].sort().join(",")}`;
  let found = real.get(key);
  if (found === undefined) {
    found = compile(withTricks(settings, tricks));
    real.set(key, found);
  }
  return found;
}

/** Every requirement of a list of modules. */
const requirements = (modules: readonly RegionModule[]): string[] =>
  modules.flatMap((m) =>
    m.regions.flatMap((r) => [
      ...r.entrances.map((e) => e.req),
      ...r.locations.flatMap((l) =>
        l.visible?.req === undefined ? [l.req] : [l.req, l.visible.req],
      ),
    ]),
  );

/**
 * Where a requirement still reads a trick's setting: a glitch flag of the
 * five, or a requireLamp threshold not offered `trickDarkRooms` beside it.
 */
function leftovers(req: string): string[] {
  const found: string[] = [];
  const visit = (e: Expr, parent?: Expr) => {
    // A trick's flag stands beside its item: a logic may turn it on
    const item = e.type === "setting" ? FLAGS.get(e.name) : undefined;
    if (
      item !== undefined &&
      !(
        parent?.type === "or" &&
        parent.args.some((a) => a.type === "item" && a.name === item)
      )
    ) {
      found.push(item);
    }
    if (
      (e.type === "item" || e.type === "count") &&
      typeof e.min === "object" &&
      e.min.setting === "requireLamp" &&
      !(
        parent?.type === "or" &&
        parent.args.some(
          (a) => a.type === "item" && a.name === TRICKS.darkRooms.item,
        )
      )
    ) {
      found.push("requireLamp");
    }
    if (e.type === "maybe") visit(e.expr, e);
    if (e.type === "and" || e.type === "or") {
      for (const a of e.args) visit(a, e);
    }
  };
  visit(parse(req));
  return found;
}

/** Each item and fact at a random level, most of them not held. */
const anyState: fc.Arbitrary<State> = fc.record(
  Object.fromEntries([
    ...ITEMS.map(({ id, max }) => [
      id,
      fc.nat({ max: 3 * max }).map((n) => Math.max(0, n - 2 * max)),
    ]),
    ...[...MEDALLION_FACTS, ...DERIVED_FACTS].map((f) => [
      f,
      fc.integer({ max: 1, min: 0 }),
    ]),
  ]),
);
const anyTricks = fc.subarray([...TRICK_IDS]);
const anyWorld = fc.constantFrom(...WORLDS);

const outputs = (s: Solution) => ({
  locations: s.locations(),
  regions: s.regions(),
  visibles: s.visibles(),
});

describe("the tricks world's rules", () => {
  it("read no trick's setting anywhere, in each world", () => {
    for (const [name, settings] of WORLDS) {
      const reqs = requirements(trickModules(settings));
      // The rewrite has something to do: the real world reads them
      expect(
        requirements(regionModules(settings)).flatMap(leftovers).length,
        name,
      ).toBeGreaterThan(20);
      expect(reqs.flatMap(leftovers), name).toEqual([]);
    }
    const helpers = Object.values(TRICK_RULES.helpers ?? {});
    expect(helpers.flatMap(leftovers)).toEqual([]);
  });

  it("offer the trick beside the Lamp, and keep every other setting", () => {
    expect(trickRequirement("glove & lamp >= setting(requireLamp)")).toBe(
      "glove & (lamp >= setting(requireLamp) | trickDarkRooms)",
    );
    expect(
      trickRequirement(
        "setting(canWaterWalk) & pegasusBoots | setting(canFakeFlipper) | flippers",
      ),
    ).toBe(
      "(setting(canWaterWalk) | trickWaterWalk) & pegasusBoots | setting(canFakeFlipper) | trickFakeFlipper | flippers",
    );
    expect(trickRequirement("setting(canBootsClip) & ?bigKeyP1")).toBe(
      "setting(canBootsClip) & ?bigKeyP1",
    );
  });

  it("refuse a rule that asks a trick to be off", () => {
    expect(() =>
      trickRequirement("!setting(canFakeFlipper) & hookshot"),
    ).toThrow(/canFakeFlipper/);
    expect(() =>
      trickRequirement("flippers | !setting(canSuperBunny)"),
    ).toThrow(RangeError);
    // Any other setting may be negated: it is not a trick
    expect(trickRequirement("!setting(canBootsClip) & hookshot")).toBe(
      "!setting(canBootsClip) & hookshot",
    );
  });

  it("are the real world's own where they read no trick", () => {
    const [kept] = requirements(regionModules(OPEN)).filter(
      (req) => leftovers(req).length === 0,
    );
    expect(kept).toBeDefined();
    expect(trickRequirement(kept as string)).toBe(kept);
  });
});

describe("the tricks a logic counts", () => {
  it("are none in NoGlitches, four in Overworld Glitches (logic.php:5-13)", () => {
    expect(tricksInLogic(OPEN)).toEqual([]);
    expect(tricksInLogic(OWG)).toEqual([
      "fakeFlipper",
      "waterWalk",
      "superBunny",
      "dungeonRevive",
    ]);
    expect(tricksInLogic({ ...OPEN, requireLamp: 0 })).toEqual(["darkRooms"]);
  });

  it("open their branches in the tricks world with no trick held", () => {
    // The Hobo, under the bridge with a fake flipper (South.php:131)
    // Standard's escape done
    const state = toState(
      { ...EMPTY_INPUT, beaten: { "hyrule-castle": true } },
      OWG,
    );
    expect(solve(compile(STANDARD), state).location("hobo")).toBe("no");
    expect(solve(compileTricks(OWG), state).location("hobo")).toBe("yes");
    expect(solve(compile(OWG), state).location("hobo")).toBe("yes");
  });
});

describe("the tricks world", () => {
  it("reads as the real world with those tricks' switches on", () => {
    fc.assert(
      fc.property(anyWorld, anyTricks, anyState, ([name, s], tricks, state) => {
        const ours = solve(compileTricks(s), {
          ...state,
          ...trickState(tricks),
        });
        const theirs = solve(realWith(name, s, tricks), state);
        expect(outputs(ours)).toEqual(outputs(theirs));
      }),
      { numRuns: 300 },
    );
  });

  it("reads as the real world with no trick held", () => {
    fc.assert(
      fc.property(anyWorld, anyState, ([, s], state) => {
        expect(outputs(solve(compileTricks(s), state))).toEqual(
          outputs(solve(compile(s), state)),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("only opens more as a player learns more tricks", () => {
    fc.assert(
      fc.property(
        anyWorld,
        anyTricks,
        anyTricks,
        anyState,
        ([, s], some, more, state) => {
          const world = compileTricks(s);
          const fewer = outputs(
            solve(world, { ...state, ...trickState(some) }),
          );
          const after = outputs(
            solve(world, { ...state, ...trickState([...some, ...more]) }),
          );
          for (const part of ["locations", "regions", "visibles"] as const) {
            for (const [id, tri] of Object.entries(fewer[part])) {
              expect(rank(after[part][id] ?? "no"), id).toBeGreaterThanOrEqual(
                rank(tri),
              );
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("is compiled once per settings object, with the tricks' items", () => {
    expect(compileTricks(OPEN)).toBe(compileTricks(OPEN));
    expect(compileTricks({ ...OPEN })).not.toBe(compileTricks(OPEN));
    // Each trick's item is read somewhere
    expect(compileTricks(OPEN).items).toEqual(
      expect.arrayContaining([...TRICK_ITEMS]),
    );
    expect(trickModules(OPEN)).toBe(trickModules({ ...OPEN }));
    expect(trickFiller(OPEN)).toBe(trickFiller(OPEN));
  });
});

describe("what a trick opens, as upstream writes it", () => {
  const holding = (items: TrackerInput["items"], tricks: TrickId[]): Solution =>
    solve(compileTricks(OPEN), {
      ...toState({ ...EMPTY_INPUT, items }, OPEN),
      ...trickState(tricks),
    });

  it("Old Man: Death Mountain and the cave, dark without the Lamp (West.php:46, 69)", () => {
    expect(holding({ glove: 1 }, []).location("old-man")).toBe("no");
    const dark = holding({ glove: 1 }, ["darkRooms"]);
    expect(dark.region("westDeathMountain")).toBe("yes");
    expect(dark.location("old-man")).toBe("yes");
    // Another trick does not light the cave
    expect(
      holding({ glove: 1 }, ["fakeFlipper", "waterWalk"]).location("old-man"),
    ).toBe("no");
  });

  it("Hobo: under the bridge with a fake flipper, or walking the water with the Boots (South.php:131)", () => {
    expect(holding({}, []).location("hobo")).toBe("no");
    expect(holding({}, ["fakeFlipper"]).location("hobo")).toBe("yes");
    expect(holding({}, ["waterWalk"]).location("hobo")).toBe("no");
    expect(holding({ pegasusBoots: 1 }, ["waterWalk"]).location("hobo")).toBe(
      "yes",
    );
  });

  it("Zora's Ledge: water walk and a fake flipper together, with the Boots (NorthEast.php:75)", () => {
    const boots = { glove: 1, pegasusBoots: 1 };
    expect(holding(boots, ["waterWalk"]).location("zoras-ledge")).toBe("no");
    expect(holding(boots, ["fakeFlipper"]).location("zoras-ledge")).toBe("no");
    expect(
      holding(boots, ["fakeFlipper", "waterWalk"]).location("zoras-ledge"),
    ).toBe("yes");
    expect(
      holding({ glove: 1 }, ["fakeFlipper", "waterWalk"]).location(
        "zoras-ledge",
      ),
    ).toBe("no");
  });

  it("Ice Palace: entered as a bunny, revived inside (IcePalace.php:137)", () => {
    const items = { fireRod: 1, flippers: 1, glove: 2 };
    expect(holding(items, []).region("icePalace")).toBe("no");
    expect(holding(items, ["superBunny"]).region("icePalace")).toBe("no");
    expect(holding(items, ["dungeonRevive"]).region("icePalace")).toBe("yes");
    // The fake flipper stands for the flippers on the same branch
    expect(
      holding({ fireRod: 1, glove: 2 }, [
        "dungeonRevive",
        "fakeFlipper",
      ]).region("icePalace"),
    ).toBe("yes");
  });
});

describe("what the tricks leave as the real world has it", () => {
  const SETUPS = [
    ...WORLDS,
    [
      "Open, maps and compasses wild",
      settingsFromUpstream("open", { dungeonItems: "mc" }),
    ],
    ["Open, keysanity", settingsFromUpstream("open", { dungeonItems: "full" })],
    ["retro", settingsFromUpstream("retro", {})],
  ] as const;

  it("places every dungeon item where the real world would", () => {
    for (const [name, s] of SETUPS) {
      const ours = trickFiller(s);
      const theirs = filler(compile(s), s);
      expect(ours.locations, name).toEqual(theirs.locations);
      expect(untrackedItems(ours), name).toEqual(untrackedItems(theirs));
    }
  });

  it("reads Palace of Darkness's keys from the real Lamp, never a trick", () => {
    // Hammer and a bow, no Lamp: five keys still suffice, as in logic
    const items = { bow: 1, hammer: 1 };
    expect(derivedFacts(items, OPEN).podFewerKeysSuffice).toBe(1);
    // vt with the dark rooms allowed would ask a sixth (PalaceOfDarkness.php:88)
    expect(
      derivedFacts(items, withTricks(OPEN, ["darkRooms"])).podFewerKeysSuffice,
    ).toBe(0);
    fc.assert(
      fc.property(anyWorld, anyTricks, anyState, ([, s], tricks, state) => {
        expect(derivedFacts({ ...state, ...trickState(tricks) }, s)).toEqual(
          derivedFacts(state, s),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("models the keys over the filler's own modules", () => {
    for (const [name, s] of WORLDS) {
      // Today no trick's branch reads a key its location does not already
      const ours = solveWithKeys(trickFiller(s), {});
      const real = filler(compile(s), s);
      const theirs = solveWithKeys(real, {});
      expect(real.locations.some((id) => theirs.dungeons(id).length > 0)).toBe(
        true,
      );
      for (const id of real.locations) {
        expect(ours.dungeons(id), `${name}: ${id}`).toEqual(
          theirs.dungeons(id),
        );
      }
    }
    // A trick's branch that reads a dungeon's key puts its location under
    // that dungeon's keys, which the run's modules alone never would
    const modules = trickModules(OPEN).map((m) => ({
      ...m,
      regions: m.regions.map((r) => ({
        ...r,
        locations: r.locations.map((l) =>
          l.id === "hobo"
            ? { ...l, req: `${l.req} | trickSuperBunny & keyD1` }
            : l,
        ),
      })),
    }));
    const world = compileWorld(buildWorld(modules), loadRules(TRICK_RULES), {
      items: [...STATE_NAMES, ...TRICK_ITEMS],
      settings: OPEN,
    });
    const keyed = solveWithKeys(filler(world, OPEN, modules), {});
    expect(keyed.dungeons("hobo")).toEqual(["palace-of-darkness"]);
  });
});

describe("the tricks world's cost", () => {
  it("compiles, models its keys and solves within budget", () => {
    // Compiled once per run and solved on every click, as the real world:
    // the fastest of a few runs, far above what one takes (README, Tricks),
    // to catch a blow-up
    const fastest = (run: () => void) => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        run();
        best = Math.min(best, performance.now() - start);
      }
      return best;
    };
    const state = {
      ...toState({ ...EMPTY_INPUT, items: { glove: 1, hammer: 1 } }, OPEN),
      ...trickState(TRICK_IDS),
    };
    // A new settings object is a cold compile and key model
    expect(
      fastest(() => solveWithKeys(trickFiller({ ...OPEN }), state)),
    ).toBeLessThan(200);
    const warm = trickFiller(OPEN);
    solveWithKeys(warm, state);
    expect(fastest(() => solveWithKeys(warm, state).locations())).toBeLessThan(
      10,
    );
  });
});
