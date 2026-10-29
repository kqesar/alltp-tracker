// The key model (solveWithKeys): golden cases on real dungeons, its laws as
// properties, and the facts about the world its soundness rests on
// (README.md, "The key model").
import {
  evaluate,
  foldSettings,
  loadRules,
  parse,
  rank,
  type State,
  solve,
  type Tri,
  walk,
} from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DERIVED, derivedFacts } from "./derived";
import { DUNGEONS, dungeonRegions } from "./dungeons";
import { type Filler, filler } from "./fill";
import { fromUpstream, ITEMS } from "./items";
import { everythingBut, readsOf, solveWithKeys, untrackedItems } from "./keys";
import { medallionFacts } from "./medallions";
import { compile, regionModules } from "./pack";
import { RULES } from "./rules";
import {
  type AlttprSettings,
  noLogicSettings,
  OPEN,
  STANDARD,
  settingsFromUpstream,
} from "./settings";

const KEYSANITY = settingsFromUpstream("open", { dungeonItems: "full" });
const fillers = new Map<AlttprSettings, Filler>();
function fillerOf(settings: AlttprSettings): Filler {
  let found = fillers.get(settings);
  if (found === undefined) {
    found = filler(compile(settings), settings);
    fillers.set(settings, found);
  }
  return found;
}

/** A tracker's state: the items, Zelda rescued, the pads unknown. */
function tracked(items: State, settings: AlttprSettings = OPEN): State {
  const all = { rescueZelda: 1, ...items };
  return {
    ...all,
    ...medallionFacts({ mire: "unknown", turtleRock: "unknown" }),
    ...derivedFacts(all, settings),
  };
}

const model = (items: State, settings: AlttprSettings = OPEN) =>
  solveWithKeys(fillerOf(settings), tracked(items, settings));

/** The dungeon's item locations as the model reads them, by short name. */
function dungeonView(items: State, id: string): Record<string, Tri> {
  const keyed = model(items);
  const d = DUNGEONS.find((x) => x.id === id);
  if (d === undefined) throw new RangeError(id);
  return Object.fromEntries(
    dungeonRegions(d, OPEN).flatMap((r) =>
      r.locations.map((l) => [l.id.slice(id.length + 1), keyed.location(l.id)]),
    ),
  );
}

describe("the key model on real dungeons", () => {
  const HERA = { flute: 1, magicMirror: 1, sword: 1 };

  it("trusts a dungeon whose key spots are all as reachable as with everything", () => {
    expect(dungeonView({ ...HERA, lamp: 1 }, "tower-of-hera")).toEqual({
      "basement-cage": "yes",
      "big-chest": "yes",
      "big-key-chest": "yes",
      boss: "yes",
      "compass-chest": "yes",
      "map-chest": "yes",
      prize: "yes",
    });
  });

  it("doubts what the big key opens while it may sit behind the torches", () => {
    // Without fire, the Big Key Chest is out, and the big key may be in it
    expect(dungeonView(HERA, "tower-of-hera")).toEqual({
      "basement-cage": "yes",
      "big-chest": "maybe",
      "big-key-chest": "no",
      boss: "maybe",
      "compass-chest": "maybe",
      "map-chest": "yes",
      prize: "maybe",
    });
  });

  it("doubts Desert Palace's key door until the boots reach the torch", () => {
    const desert = { bookOfMudora: 1, glove: 1, lamp: 1, sword: 1 };
    expect(dungeonView(desert, "desert-palace")).toMatchObject({
      "big-chest": "maybe",
      "big-key-chest": "maybe",
      "compass-chest": "maybe",
      "map-chest": "yes",
      torch: "no",
    });
    expect(
      Object.values(
        dungeonView({ ...desert, pegasusBoots: 1 }, "desert-palace"),
      ),
    ).toEqual(Array(7).fill("yes"));
    expect(model({ ...desert, pegasusBoots: 1 }).safe("desert-palace")).toBe(
      true,
    );
  });

  it("holds Swamp Palace's key, which only its entrance can hold", () => {
    const swamp = {
      flippers: 1,
      glove: 1,
      hammer: 1,
      magicMirror: 1,
      moonPearl: 1,
      sword: 1,
    };
    const keyed = model(swamp);
    // The key is surely in hand; the big key may be past the hookshot
    expect(keyed.state.keyD2).toBe(1);
    expect(keyed.safe("swamp-palace")).toBe(false);
    expect(dungeonView(swamp, "swamp-palace")).toMatchObject({
      "big-chest": "maybe",
      "big-key-chest": "yes",
      "compass-chest": "yes",
      entrance: "yes",
      "flooded-room/left": "no",
    });
  });

  it("doubts Palace of Darkness without the bow its key spots want", () => {
    const pod = { glove: 1, hammer: 1, lamp: 1, moonPearl: 1, sword: 1 };
    expect(model(pod).safe("palace-of-darkness")).toBe(false);
    expect(dungeonView(pod, "palace-of-darkness")).toMatchObject({
      "big-key-chest": "maybe",
      "compass-chest": "maybe",
      "shooter-room": "yes",
      "the-arena/ledge": "no",
    });
    const armed = model({ ...pod, bow: 1 });
    expect(armed.safe("palace-of-darkness")).toBe(true);
    expect(armed.location("palace-of-darkness/boss")).toBe("yes");
  });

  it("reads Mimic Cave with Turtle Rock's keys, its door being inside", () => {
    // All three medallions: the pad opens though the player does not know
    // which it wants
    const tr = {
      bombos: 1,
      caneOfSomaria: 1,
      ether: 1,
      fireRod: 1,
      flute: 1,
      glove: 2,
      hammer: 1,
      hookshot: 1,
      magicMirror: 1,
      moonPearl: 1,
      quake: 1,
      sword: 1,
    };
    // Two keys open the way to its door; they may sit on the dark eye
    // bridge, which wants the lamp
    const unsafe = model(tr);
    expect(unsafe.safe("turtle-rock")).toBe(false);
    expect(unsafe.location("mimic-cave")).toBe("maybe");
    const safe = model({ ...tr, lamp: 1 });
    expect(safe.safe("turtle-rock")).toBe(true);
    expect(safe.location("mimic-cave")).toBe("yes");
    expect(safe.dungeons("mimic-cave")).toEqual(["turtle-rock"]);
    expect(safe.dungeons("kings-tomb")).toEqual([]);
  });

  it("vouches for no key under No Logic until every place it may sit is reached", () => {
    // The randomizer placed it anywhere in its dungeon (World.php:93)
    const noLogic = noLogicSettings(OPEN);
    const HERA = { flute: 1, lamp: 1, magicMirror: 1, sword: 1 };
    const keyed = model(HERA, noLogic);
    expect(keyed.safe("tower-of-hera")).toBe(false);
    expect(keyed.location("tower-of-hera/map-chest")).toBe("yes");
    expect(model(HERA).location("tower-of-hera/big-chest")).toBe("yes");
    // The big key may sit in the Big Chest it opens
    expect(keyed.location("tower-of-hera/big-chest")).toBe("maybe");
  });

  it("calls a dungeon with nothing untracked safe", () => {
    const keyed = solveWithKeys(fillerOf(KEYSANITY), tracked({}, KEYSANITY));
    expect(keyed.safe("palace-of-darkness")).toBe(true);
    expect(keyed.dungeons("palace-of-darkness/boss")).toEqual([]);
  });

  it("never vouches for the retro world's generic keys, but a key for sale opens all", () => {
    const RETRO = settingsFromUpstream("retro");
    // Everything a player may hold, an arrow bought, but the keys
    const late = {
      bigKeyD1: 1,
      bow: 2,
      flute: 2,
      glove: 2,
      hammer: 1,
      hookshot: 1,
      lamp: 1,
      magicMirror: 1,
      moonPearl: 1,
      shopArrow: 1,
      sword: 2,
    };
    const without = model(late, RETRO);
    // A key found may open another dungeon's door: maybe, never yes
    expect(without.location("palace-of-darkness/boss")).toBe("maybe");
    expect(without.safe("palace-of-darkness")).toBe(false);
    expect(
      untrackedItems(fillerOf(RETRO)).every(
        (u) => u.generic === u.item.startsWith("key"),
      ),
    ).toBe(true);
    // Keys for sale: every door opens (ItemCollection.php:269-272)
    const shop = model({ ...late, shopKey: 1 }, RETRO);
    expect(shop.location("palace-of-darkness/boss")).toBe("yes");
  });

  it("is the solver's answer where every key is tracked", () => {
    const items = { glove: 1, hammer: 1, keyD1: 2, lamp: 1, moonPearl: 1 };
    const state = tracked(items, KEYSANITY);
    const keyed = solveWithKeys(fillerOf(KEYSANITY), state);
    expect(keyed.locations()).toEqual(
      solve(fillerOf(KEYSANITY).world, state).locations(),
    );
    expect(untrackedItems(fillerOf(KEYSANITY))).toEqual([]);
  });
});

/** Every item but the untracked dungeon keys, with its range. */
const TRACKED = ITEMS.filter((item) => !/^(key|bigKey)/.test(item.id));

const stateOf = (counts: readonly number[]): State =>
  Object.fromEntries(
    TRACKED.map(({ id, max }, i) => [id, Math.min(max, counts[i] ?? 0)]),
  );

/** Pairs of states, the second holding one to three items more. */
const bumps = fc.array(
  fc.tuple(fc.nat(TRACKED.length - 1), fc.integer({ max: 4, min: 1 })),
  { maxLength: 3, minLength: 1 },
);
const each = <T>(arb: fc.Arbitrary<T>) =>
  fc.array(arb, { maxLength: TRACKED.length, minLength: TRACKED.length });
const odds = fc.double({ max: 1, min: 0, noNaN: true });

/**
 * From below: each item held with a probability drawn per state, so every
 * stage of a run turns up; then a few raised.
 */
const fromBelow = fc
  .record({ bumps, held: each(fc.tuple(fc.nat(24), odds)), stage: odds })
  .map(({ bumps, held, stage }) => {
    const less = held.map(([n, p]) => (p < stage ? n : 0));
    const more = [...less];
    for (const [i, by] of bumps) more[i] = (more[i] ?? 0) + by;
    return [stateOf(less), stateOf(more)] as const;
  });

/**
 * From above: everything but a few items, one to three of which come back.
 * Here a dungeon turns safe with the one item its key spots lacked.
 */
const fromAbove = fc
  .record({
    back: fc.array(fc.nat(), { maxLength: 3, minLength: 1 }),
    dropped: each(odds),
    rate: fc.double({ max: 0.08, min: 0, noNaN: true }),
  })
  .map(({ back, dropped, rate }) => {
    const full = TRACKED.map(({ max }) => max);
    const gone = full.flatMap((_, i) => ((dropped[i] ?? 1) < rate ? [i] : []));
    const less = full.map((max, i) => (gone.includes(i) ? 0 : max));
    const more = [...less];
    for (const pick of back) {
      const i = gone[pick % Math.max(1, gone.length)];
      if (i !== undefined) more[i] = full[i] ?? 0;
    }
    return [stateOf(less), stateOf(more)] as const;
  });

const grown = fc.oneof(fromBelow, fromAbove);

describe("the key model's laws", () => {
  for (const [name, settings] of [
    ["Open", OPEN],
    ["Standard", STANDARD],
  ] as const) {
    it(`never lowers a location when an item is added (${name})`, () => {
      const f = fillerOf(settings);
      fc.assert(
        fc.property(grown, ([less, more]) => {
          const before = solveWithKeys(f, tracked(less, settings)).locations();
          const after = solveWithKeys(f, tracked(more, settings)).locations();
          for (const [id, tri] of Object.entries(before)) {
            if (rank(after[id] as Tri) < rank(tri)) return false;
          }
          return true;
        }),
        { numRuns: 150, seed: 31 },
      );
    });

    it(`never lowers a location when the one missing item comes back (${name})`, () => {
      // Near the top, one item turns a dungeon safe: every item, in turn
      const f = fillerOf(settings);
      const top = Object.fromEntries(TRACKED.map(({ id, max }) => [id, max]));
      const after = solveWithKeys(f, tracked(top, settings)).locations();
      const lowered: string[] = [];
      for (const { id } of TRACKED) {
        const before = solveWithKeys(
          f,
          tracked({ ...top, [id]: 0 }, settings),
        ).locations();
        for (const [l, tri] of Object.entries(before)) {
          if (rank(after[l] as Tri) < rank(tri)) lowered.push(`${id}: ${l}`);
        }
      }
      expect(lowered).toEqual([]);
    });

    it(`stays between the solver without keys and with them all (${name})`, () => {
      const f = fillerOf(settings);
      const untracked = untrackedItems(f);
      fc.assert(
        fc.property(grown, ([state]) => {
          const s = tracked(state, settings);
          const keyed = solveWithKeys(f, s).locations();
          const none = solve(f.world, s);
          const all = solve(f.world, {
            ...s,
            ...Object.fromEntries(untracked.map((u) => [u.item, u.count])),
          });
          return Object.entries(keyed).every(
            ([id, tri]) =>
              rank(tri) >= rank(none.location(id)) &&
              rank(tri) <= rank(all.location(id)),
          );
        }),
        { numRuns: 150, seed: 7 },
      );
    });
  }

  it("turns up every answer, so the laws above are not vacuous", () => {
    const seen = new Set<string>();
    const f = fillerOf(OPEN);
    fc.assert(
      fc.property(grown, ([state]) => {
        const keyed = solveWithKeys(f, tracked(state));
        const all = solve(f.world, {
          ...tracked(state),
          ...Object.fromEntries(
            untrackedItems(f).map((u) => [u.item, u.count]),
          ),
        });
        for (const d of DUNGEONS) {
          for (const r of dungeonRegions(d, OPEN)) {
            for (const l of r.locations) {
              const none = solve(f.world, tracked(state)).location(l.id);
              const got = keyed.location(l.id);
              // A yes the solver alone does not give: the model's own work
              if (got === "yes" && none !== "yes") seen.add("raised");
              if (got === "maybe" && all.location(l.id) === "yes") {
                seen.add("doubted");
              }
            }
          }
        }
        return true;
      }),
      { numRuns: 60, seed: 3 },
    );
    expect([...seen].sort()).toEqual(["doubted", "raised"]);
  });
});

describe("readsOf", () => {
  const closed = (region: string) => region === "nowhere";
  it.each([
    ["keyD1 >= 2 & hammer", ["keyD1", "hammer"]],
    ["@canLiftRocks", ["glove"]],
    ["count(crystal) >= 7", ["crystal"]],
    ["maybe & keyD5", ["keyD5"]],
    ["false", null],
    // NoGlitches switches the glitch off, and every branch behind it
    ["setting(canBootsClip) & pegasusBoots", null],
    ["!setting(canBootsClip) & pegasusBoots", ["pegasusBoots"]],
    ["hookshot | reach(nowhere) & keyD5", ["hookshot"]],
    ["reach(nowhere) & keyD5", null],
    ["?(reach(nowhere) & keyD5)", []],
  ] as const)("%s reads %j", (req, names) => {
    expect(readsOf(req, OPEN, closed)).toEqual(names);
  });

  it("names a helper it does not know", () => {
    expect(() => readsOf("@nowhere", OPEN)).toThrow(/No helper @nowhere/);
  });
});

/**
 * The state names a requirement reads under the settings, its helpers
 * included: what the soundness argument asks about rules.
 */
function reads(req: string, settings: AlttprSettings): Set<string> {
  const found = new Set<string>();
  const seen = new Set<string>();
  const visit = (text: string) =>
    walk(foldSettings(parse(text), settings, "reads"), (node) => {
      if (node.type === "item") found.add(node.name);
      if (node.type === "count") for (const n of node.names) found.add(n);
      if (node.type === "helper" && !seen.has(node.name)) {
        seen.add(node.name);
        visit(RULES.helpers?.[node.name] ?? "false");
      }
    });
  visit(req);
  return found;
}

const isKey = (name: string) => /^(key|bigKey)[A-Z]/.test(name);

describe("what the model's soundness rests on", () => {
  for (const settings of [OPEN, STANDARD]) {
    const modules = regionModules(settings);
    const ownCode = new Map<string, string>();
    for (const d of DUNGEONS) {
      for (const r of dungeonRegions(d, settings)) {
        for (const l of r.locations) ownCode.set(l.id, d.code);
      }
    }

    it(`opens no way in with a key, so keys never move a region (${settings.standardMode ? "Standard" : "Open"})`, () => {
      const stray: string[] = [];
      for (const region of modules.flatMap((m) => m.regions)) {
        for (const e of region.entrances) {
          for (const name of reads(e.req, settings)) {
            if (isKey(name)) stray.push(`${e.from} -> ${region.id}: ${name}`);
          }
        }
      }
      expect(stray).toEqual([]);
    });

    it(`ties each location to the dungeons whose keys its rule reads (${settings.standardMode ? "Standard" : "Open"})`, () => {
      const keyed = solveWithKeys(fillerOf(settings), tracked({}, settings));
      const elsewhere: string[] = [];
      for (const l of modules.flatMap((m) =>
        m.regions.flatMap((r) => r.locations),
      )) {
        const own = DUNGEONS.find((d) => d.code === ownCode.get(l.id))?.id;
        for (const d of keyed.dungeons(l.id)) {
          if (d !== own) elsewhere.push(`${l.id}: ${d}`);
        }
        // A location reads the keys of the dungeons it is tied to only
        for (const name of reads(l.req, settings)) {
          if (!isKey(name)) continue;
          const code = name.replace(/^(key|bigKey)/, "");
          const tied = keyed
            .dungeons(l.id)
            .some((d) => DUNGEONS.find((x) => x.id === d)?.code === code);
          // The glitched branches past a region nothing opens are left out
          if (!tied) elsewhere.push(`${l.id}: reads ${name} untied`);
        }
      }
      // Tower of Hera's way in from Misery Mire and Turtle Rock's middle
      // way, glitched, are closed: what they read does not count
      expect(elsewhere).toEqual([
        "mimic-cave: turtle-rock",
        "tower-of-hera/big-chest: reads bigKeyD6 untied",
        "tower-of-hera/boss: reads bigKeyD6 untied",
        "tower-of-hera/prize: reads bigKeyD6 untied",
        "turtle-rock/compass-chest: reads keyD7 untied",
        "turtle-rock/roller-room/left: reads keyD7 untied",
        "turtle-rock/roller-room/right: reads keyD7 untied",
      ]);
      expect(keyed.dungeons("tower-of-hera/big-chest")).toEqual([
        "tower-of-hera",
      ]);
    });

    it(`lets an always-allowed key lock in only what no other spot needs (${settings.standardMode ? "Standard" : "Open"})`, () => {
      const world = fillerOf(settings).world;
      const all = modules.flatMap((m) => m.regions.flatMap((r) => r.locations));
      const locked: string[] = [];
      for (const region of modules.flatMap((m) => m.regions)) {
        for (const l of region.locations) {
          for (const item of l.fill?.always?.items ?? []) {
            const id = fromUpstream(item)?.item;
            if (id === undefined || !isKey(id)) continue;
            // With the key placed there and everything else held, is the
            // spot open? Then the key is found, not locked in
            const without = everythingBut(item, settings);
            const holding = l.fill?.holding;
            const req =
              (holding && Object.hasOwn(holding.items, item)
                ? holding.items[item]
                : holding?.otherwise) ?? l.req;
            const solution = solve(world, without);
            const open = evaluate(parse(req), without, loadRules(RULES), {
              regions: solution.regions(),
              settings,
            });
            if (open === "yes" && solution.region(region.id) === "yes") {
              continue;
            }
            locked.push(`${l.id} <- ${item}`);
            for (const other of all) {
              if (other.id !== l.id && reads(other.req, settings).has(id)) {
                locked.push(`  but ${other.id} reads ${id}`);
              }
            }
          }
        }
      }
      expect(locked).toEqual([
        "tower-of-hera/big-key-chest <- KeyP3",
        "swamp-palace/big-chest <- BigKeyD2",
        "skull-woods/big-chest <- BigKeyD3",
      ]);
    });
  }

  it("derives no fact from a key, so raising keys keeps the facts", () => {
    for (const { unless } of Object.values(DERIVED)) {
      for (const name of reads(unless, OPEN))
        expect(isKey(name), name).toBe(false);
    }
  });
});
