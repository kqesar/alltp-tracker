// The key model on the entrance randomizer's world (er-keys.ts): what it
// reads of the randomizer's dungeons, golden cases, its laws as properties,
// and its soundness against placements the randomizer's fill may make
// (README.md, "Its key model").
import { rank, type State, type Tri } from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fill, PREPLACED, sweep } from "../test/er-fill";
import { erSeed, seedNotes, seedWorld } from "../test/er-seeds";
import { DUNGEONS, dungeonLocations, dungeonPool } from "./dungeons";
import { erLocationId } from "./entrances";
import ruleTables from "./entrances/rules.json" with { type: "json" };
import {
  erDungeons,
  erUntracked,
  solveErWithKeys,
  withErUntracked,
} from "./er-keys";
import {
  type ErWorld,
  erWorld,
  solveFactsState,
  vanillaConnections,
} from "./er-world";
import { ITEMS } from "./items";
import { everything } from "./keys";
import { OPEN, STANDARD, settingsFromUpstream } from "./settings";

const RETRO = settingsFromUpstream("retro");
const KEYSANITY = settingsFromUpstream("open", { dungeonItems: "full" });
const BEATABLE = settingsFromUpstream("open", { accessibility: "none" });

const worlds = new Map<object, ErWorld>();
/** The world of the randomizer's tests, every door where it is. */
const vanilla = (settings = OPEN): ErWorld => {
  let found = worlds.get(settings);
  if (found === undefined) {
    found = erWorld(settings, vanillaConnections());
    worlds.set(settings, found);
  }
  return found;
};

/** The ids of the items the key model places: every dungeon's keys. */
const KEYS = ITEMS.map(({ id }) => id).filter((id) => /^(key|bigKey)/.test(id));

/** Everything held but the dungeons' keys, and `less` dropped. */
const allBut = (settings = OPEN, ...less: string[]): State => ({
  ...everything(settings),
  ...Object.fromEntries([...KEYS, ...less].map((id) => [id, 0])),
});

/** A location's answer in the key model and without it. */
const answers = (world: ErWorld, state: State, name: string) => {
  const id = erLocationId(name);
  return {
    keyed: solveErWithKeys(world, state).location(id),
    solver: solveFactsState(world, state).solution.location(id),
  };
};

describe("what the key model reads of the randomizer's dungeons", () => {
  it("counts each dungeon's keys as the pack's items, the Pinball Room's among them", () => {
    for (const d of erDungeons(false)) {
      const max = (id: string) => ITEMS.find((item) => item.id === id)?.max;
      // everything() holds them all, at the counts the randomizer places
      expect(max(`key${d.code}`) ?? 0, d.id).toBe(d.smallKeys);
      expect(max(`bigKey${d.code}`) ?? 0, d.id).toBe(d.bigKey ? 1 : 0);
    }
    expect([...PREPLACED]).toEqual([["skull-woods/pinball-room", "keyD3"]]);
    const skull = erUntracked(vanilla()).filter(
      (u) => u.dungeon === "skull-woods",
    );
    expect(skull.map((u) => [u.item, u.count])).toEqual([
      ["keyD3", 3],
      ["bigKeyD3", 1],
    ]);
    expect(skull[0]?.locations).toContain("skull-woods/pinball-room");
    expect(skull[1]?.locations).not.toContain("skull-woods/pinball-room");
  });

  it("keeps in each dungeon what vt's counters take out of it", () => {
    // The app counts a dungeon's items over vt's world (dungeonItemCount):
    // the randomizer's spots lie among vt's, and it keeps as many keys,
    // maps and compasses in them
    const { byName } = ruleTables.dungeons;
    for (const d of erDungeons(false)) {
      const vt = DUNGEONS.find((x) => x.id === d.id);
      if (vt === undefined) throw new RangeError(d.id);
      const locations = dungeonLocations(vt, OPEN);
      for (const spot of d.spots) expect(locations, d.id).toContain(spot);
      const pool = dungeonPool(vt);
      const items = Object.values(byName).find((x) => x.code === d.code)
        ?.items as readonly string[];
      expect(
        [
          d.smallKeys,
          d.bigKey ? 1 : 0,
          items.filter((i) => i.startsWith("Map")).length,
          items.filter((i) => i.startsWith("Compass")).length,
        ],
        d.id,
      ).toEqual([pool.smallKeys, pool.bigKey, pool.map, pool.compass]);
    }
  });

  it("finds no item rule on a dungeon's spot", () => {
    const spots = new Set(erDungeons(false).flatMap((d) => d.spots));
    const rules = ruleTables.fill.itemRules.map((r) =>
      erLocationId(r.location),
    );
    expect(rules.length).toBeGreaterThan(0);
    for (const spot of rules) expect(spots.has(spot), spot).toBe(false);
  });

  it("lets a key lock itself in where an always-allow says so", () => {
    const spots = (item: string) =>
      erUntracked(vanilla()).find((u) => u.item === item)?.locations;
    // Rules.py:288, behind the door it opens; refused elsewhere (Rules.py:
    // 266, 292)
    expect(spots("keyP3")).toContain("tower-of-hera/big-key-chest");
    expect(spots("bigKeyP3")).not.toContain("tower-of-hera/big-chest");
    expect(spots("bigKeyP1")).not.toContain("eastern-palace/big-chest");
    // Accessibility 'locations' refuses it there (Rules.py:393)
    const locations = erWorld(
      settingsFromUpstream("open", { accessibility: "locations" }),
      vanillaConnections(),
    );
    expect(
      erUntracked(locations).find((u) => u.item === "keyD1")?.locations,
    ).not.toContain("palace-of-darkness/big-key-chest");
    expect(spots("keyD1")).toContain("palace-of-darkness/big-key-chest");
  });

  it("lists where each item may go without itself (Fill.py:174-182)", () => {
    const spots = (world: ErWorld, item: string) =>
      erUntracked(world).find((u) => u.item === item)?.locations;
    // Swamp Palace's one key opens its first door (Rules.py:297): the
    // chest before it
    expect(spots(vanilla(), "keyD2")).toEqual(["swamp-palace/entrance"]);
    // Turtle Rock's big key opens the way on (Rules.py:371)
    expect(spots(vanilla(), "bigKeyD7")).toEqual([
      "turtle-rock/compass-chest",
      "turtle-rock/roller-room/left",
      "turtle-rock/roller-room/right",
      "turtle-rock/chain-chomps",
      "turtle-rock/big-key-chest",
    ]);
    // The sixth key of Palace of Darkness: not behind the doors six open
    // (Rules.py:385, 401)
    const darkness = spots(vanilla(), "keyD1");
    expect(darkness).toHaveLength(10);
    for (const spot of ["dark-maze/top", "big-chest", "boss"])
      expect(darkness).not.toContain(`palace-of-darkness/${spot}`);
    // Standard's escape key: not past the sewers' door (Rules.py:259)
    expect(spots(vanilla(STANDARD), "keyH2")).toEqual([
      "hyrule-castle/boomerang-chest",
      "hyrule-castle/map-chest",
      "hyrule-castle/zeldas-cell",
      "sewers/dark-cross",
    ]);
  });

  it("leaves the retro world's small keys out, its big keys in", () => {
    const items = erUntracked(vanilla(RETRO)).map((u) => u.item);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.startsWith("bigKey"))).toBe(true);
  });

  it("is the solver's answer where the seed is keysanity", () => {
    const world = vanilla(KEYSANITY);
    expect(erUntracked(world)).toEqual([]);
    const state = allBut(KEYSANITY, "lamp");
    expect(solveErWithKeys(world, state).locations()).toEqual(
      solveFactsState(world, state).solution.locations(),
    );
  });
});

describe("the key model on real dungeons", () => {
  it("vouches for a dungeon whose spots are all as reachable as with everything", () => {
    const state = allBut();
    for (const name of [
      "Eastern Palace - Big Chest",
      "Desert Palace - Prize",
      "Tower of Hera - Big Chest",
      "Palace of Darkness - Boss",
      "Ice Palace - Prize",
      "Agahnim 2",
    ])
      expect(answers(vanilla(), state, name), name).toEqual({
        keyed: "yes",
        solver: "no",
      });
  });

  it("doubts Desert Palace until the boots reach the torch", () => {
    const state = allBut(OPEN, "pegasusBoots");
    expect(answers(vanilla(), state, "Desert Palace - Prize").keyed).toBe(
      "maybe",
    );
    const keyed = solveErWithKeys(vanilla(), state);
    expect(keyed.dungeons(erLocationId("Desert Palace - Prize"))).toEqual([
      "desert-palace",
    ]);
    expect(keyed.safe("desert-palace")).toBe(false);
  });

  it("doubts Kholdstare without Somaria, where a key may wait for him", () => {
    // With Somaria, one key opens his door: the second may be his
    // (Rules.py:336), which the player without it cannot reach
    expect(
      answers(vanilla(), allBut(OPEN, "caneOfSomaria"), "Ice Palace - Prize")
        .keyed,
    ).toBe("maybe");
  });

  it("vouches for no dungeon when the seed only has to be beatable", () => {
    // Fill.py:186-188: a key may then sit behind its own door
    const world = vanilla(BEATABLE);
    const state = allBut(BEATABLE);
    expect(answers(world, state, "Palace of Darkness - Boss").keyed).toBe(
      "maybe",
    );
    // A key all of whose spots are reached is still in hand
    expect(answers(world, state, "Eastern Palace - Big Chest").keyed).toBe(
      "yes",
    );
  });

  it("reads the Standard world's escape by its key", () => {
    const state = allBut(STANDARD);
    expect(answers(vanilla(STANDARD), state, "Sanctuary").keyed).toBe("yes");
  });
});

/** Every item but the dungeons' keys, with its range. */
const TRACKED = ITEMS.filter((item) => !KEYS.includes(item.id));

const odds = fc.double({ max: 1, min: 0, noNaN: true });
const each = <T>(arb: fc.Arbitrary<T>) =>
  fc.array(arb, { maxLength: TRACKED.length, minLength: TRACKED.length });

/** A player's state: each item held with a probability drawn per state. */
const fromBelow = fc
  .record({ held: each(fc.tuple(fc.nat(24), odds)), stage: odds })
  .map(({ held, stage }) =>
    Object.fromEntries(
      TRACKED.map(({ id, max }, i) => {
        const [n, p] = held[i] ?? [0, 1];
        return [id, p < stage ? Math.min(max, n) : 0];
      }),
    ),
  );

/**
 * Everything but a few items: where a dungeon turns safe, or does not,
 * by the one item a spot of its keys asks.
 */
const fromAbove = fc
  .array(fc.nat(TRACKED.length - 1), { maxLength: 3, minLength: 1 })
  .map((dropped) =>
    Object.fromEntries(
      TRACKED.map(({ id, max }, i) => [id, dropped.includes(i) ? 0 : max]),
    ),
  );

const states = fc.oneof(fromBelow, fromAbove);

/** Pairs of states, the second holding one to three items more. */
const grown = fc
  .record({
    bumps: fc.array(
      fc.tuple(fc.nat(TRACKED.length - 1), fc.integer({ max: 4, min: 1 })),
      { maxLength: 3, minLength: 1 },
    ),
    state: states,
  })
  .map(({ bumps, state }) => {
    const more: Record<string, number> = { ...state };
    for (const [i, by] of bumps) {
      const item = TRACKED[i];
      if (item !== undefined)
        more[item.id] = Math.min(item.max, (more[item.id] ?? 0) + by);
    }
    return [state, more] as const;
  });

/** The worlds the properties run on: the tests' and a real seed's. */
const PROPERTY_WORLDS: readonly (readonly [string, () => ErWorld])[] = [
  ["Open, every door where it is", () => vanilla()],
  ["Standard, every door where it is", () => vanilla(STANDARD)],
  [
    "dMEp8enPG1, its doors noted",
    () => seedWorld(erSeed("dMEp8enPG1").spoiler),
  ],
  // Crossed doors lead a dungeon's way out to another's way in: the keys of
  // one may gate another's spots
  [
    "0yAObedRMV's crossed doors, its keys kept",
    () => seedWorld(erSeed("0yAObedRMV").spoiler, { dungeonItems: "standard" }),
  ],
];

describe("the key model's laws", () => {
  for (const [name, worldOf] of PROPERTY_WORLDS) {
    it(`never lowers a location when an item is added (${name})`, () => {
      const world = worldOf();
      fc.assert(
        fc.property(grown, ([less, more]) => {
          const before = solveErWithKeys(world, less).locations();
          const after = solveErWithKeys(world, more).locations();
          return Object.entries(before).every(
            ([id, tri]) => rank(after[id] as Tri) >= rank(tri),
          );
        }),
        { numRuns: 60, seed: 31 },
      );
    });

    it(`stays between the solver without keys and with them all (${name})`, () => {
      const world = worldOf();
      fc.assert(
        fc.property(states, (state) => {
          const keyed = solveErWithKeys(world, state).locations();
          const none = solveFactsState(world, state).solution;
          const all = solveFactsState(
            world,
            withErUntracked(world, state),
          ).solution;
          return Object.entries(keyed).every(
            ([id, tri]) =>
              rank(tri) >= rank(none.location(id)) &&
              rank(tri) <= rank(all.location(id)),
          );
        }),
        { numRuns: 60, seed: 7 },
      );
    });
  }
});

/**
 * The worlds the randomizer fills, and the doors a player may have noted of
 * them: all of a test's; of a real seed's, a part, each note left out with
 * a probability drawn per run.
 */
const FILLED: readonly (readonly [
  string,
  () => ErWorld,
  ((drop: () => boolean) => ErWorld) | undefined,
])[] = [
  ["Open, every door where it is", () => vanilla(), undefined],
  ["Standard, every door where it is", () => vanilla(STANDARD), undefined],
  ...(
    [
      ["dMEp8enPG1", {}],
      ["0yAObedRMV", { dungeonItems: "standard" }],
      // Standard's escape key, in a simple shuffle
      ["6GKBQZ3pye", {}],
    ] as const
  ).map(([hash, config]) => {
    const { spoiler } = erSeed(hash);
    const notes = Object.entries(seedNotes(spoiler));
    return [
      `${hash}, some of its doors noted`,
      () => seedWorld(spoiler, config),
      (drop: () => boolean) =>
        seedWorld(
          spoiler,
          config,
          Object.fromEntries(notes.filter(() => !drop())),
        ),
    ] as const;
  }),
];

describe("the key model's soundness", () => {
  for (const [name, filledOf, notedOf] of FILLED) {
    it(`says yes only where every placement the fill may make lets the player in (${name})`, () => {
      const filled = filledOf();
      const seen = new Set<string>();
      fc.assert(
        fc.property(
          states,
          fc.array(odds, { maxLength: 40, minLength: 40 }),
          fc.boolean(),
          fc.double({ max: 0.4, min: 0, noNaN: true }),
          (state, draws, adversarial, unnoted) => {
            let next = 0;
            const odd = () => draws[next++ % draws.length] ?? 0;
            const draw = (count: number) =>
              Math.min(count - 1, Math.floor(odd() * count));
            // The player's world: the doors noted
            const world = notedOf?.(() => odd() < unnoted) ?? filled;
            // The adversary draws among the spots the player reaches least,
            // with every key and then without
            const all = solveFactsState(
              world,
              withErUntracked(world, state),
            ).solution;
            const alone = solveFactsState(world, state).solution;
            const score = (spot: string) =>
              rank(all.location(spot)) * 3 + rank(alone.location(spot));
            // The randomizer fills the seed's whole world
            const placement = fill(
              filled,
              (spots) => {
                const low = Math.min(...spots.map(score));
                const drawn = adversarial
                  ? spots.filter((spot) => score(spot) === low)
                  : spots;
                return drawn[draw(drawn.length)] as string;
              },
              // Each kind's items in any order, the randomizer's among them
              (items) => items[draw(items.length)] as string,
            );
            if (placement === undefined) return true;
            const keyed = solveErWithKeys(world, state);
            const played = sweep(world, state, placement);
            for (const id of world.compiled.locationIds) {
              const tri = keyed.location(id);
              if (tri !== "yes") continue;
              if (played.location(id) !== "yes") return false;
              if (alone.location(id) !== "yes") seen.add("raised");
            }
            return true;
          },
        ),
        { numRuns: 50, seed: 11 },
      );
      // Not vacuous: the model said yes where only its keys could
      expect([...seen]).toEqual(["raised"]);
    });
  }
});
