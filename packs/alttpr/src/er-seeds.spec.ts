// The entrance randomizer's world held to real seeds: test/er-seeds/ keeps
// the spoilers of seeds alttpr.com generated (`record-er-seeds`, the README's
// "Entrance randomizer seeds"). A spoiler's playthrough is the randomizer's own
// proof that its spheres are reachable in order, so with every entrance of
// the seed noted and the items of the earlier spheres held, every location
// of a sphere must be `yes` (the contract: upstream reaches it, so must we).
// Where the randomizer kept the keys in their dungeons, the player does not
// track them and its playthrough does not list them: the key model reads
// them (er-keys.ts), and a location it doubts must be one a placement its
// fill may make would lock (`KEY_DOUBTS`). Noting more of a seed's doors
// never takes a `yes` away: what a door not noted hides may only add.
import { itemValue, type State } from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  bossesKnown,
  type ErSeed,
  erSeed,
  erSeedHashes,
  holding,
  knowing,
  seedNotes,
  seedWorld,
  shopsSelling,
} from "../test/er-seeds";
import { erLocationId, targetNamed } from "./entrances";
import er from "./entrances/er.json" with { type: "json" };
import { solveErWithKeys } from "./er-keys";
import type { ErWorld } from "./er-world";

/** The seed's world, entrances all noted (seedWorld). */
const worldOf = (spoiler: ErSeed["spoiler"]) => seedWorld(spoiler);

/** The playthrough's spheres in order, a location to its item in each. */
const spheresOf = (spoiler: ErSeed["spoiler"]) =>
  Object.entries(spoiler.playthrough)
    .filter(
      (entry): entry is [string, Record<string, string>] =>
        typeof entry[1] === "object",
    )
    .sort(([a], [b]) => Number(a) - Number(b));

/** A region's id in the entrance randomizer's world, by its name. */
const regionNamed = (name: string): string => {
  const found = er.regions.find((r) => r.name === name);
  if (found === undefined) throw new RangeError(`No region "${name}"`);
  return found.id;
};

/** A world name's `:1` suffix is the world's number; the pack has one. */
const plain = (name: string) => name.replace(/:1$/, "");

/**
 * The locations of a seed's playthrough the pack does not say `yes` to, each
 * with its sphere and the answer. Throws a RangeError, naming what, for a
 * seed whose settings or entrances the pack does not model.
 */
function misses(hash: string): string[] {
  const { spoiler } = erSeed(hash);
  const world = worldOf(spoiler);
  const knowledge = {
    ...knowing(spoiler.Special),
    ...bossesKnown(spoiler.Bosses),
  };
  // A retro seed's shops: the player marks the key shop (shopKey) or an
  // arrow shop (shopArrow) once in it, which the spoiler says which are
  const keyShops = shopsSelling(spoiler.Shops, "Small Key (Universal)");
  const arrowShops = shopsSelling(spoiler.Shops, "Single Arrow");
  const marked: Record<string, number> = {};
  const held: string[] = [];
  const missed: string[] = [];
  for (const [number, sphere] of spheresOf(spoiler)) {
    // The key model: with keysanity, the solver's answer
    let solution = solveErWithKeys(world, {
      ...holding(held),
      ...knowledge,
      ...marked,
    });
    const inside = (shops: readonly string[]) =>
      shops.some(
        (shop) => solution.solution.region(regionNamed(shop)) === "yes",
      );
    if (marked.shopKey === undefined && inside(keyShops)) marked.shopKey = 1;
    if (marked.shopArrow === undefined && inside(arrowShops))
      marked.shopArrow = 1;
    solution = solveErWithKeys(world, {
      ...holding(held),
      ...knowledge,
      ...marked,
    });
    for (const location of Object.keys(sphere)) {
      const answer = solution.location(erLocationId(plain(location)));
      if (answer !== "yes")
        missed.push(`sphere ${number}: ${location} ${answer}`);
    }
    held.push(...Object.values(sphere).map(plain));
  }
  return missed;
}

/**
 * The locations of a seed's playthrough the key model holds at `maybe`
 * though the randomizer reached them, the keys it kept in their dungeons
 * untracked: each is one a placement its fill may make would lock, the
 * playthrough's own placement aside. With the reason, which the misses must
 * match exactly: a model that vouched for one would be unsound, one that
 * doubted more would turn up here.
 */
const KEY_DOUBTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "6GKBQZ3pye": {
    "sphere 7: Thieves' Town - Prize maybe":
      "a Thieves' Town key may sit in the big chest, which the hammer opens; no hammer yet",
    "sphere 8: Palace of Darkness - Dark Maze - Top maybe":
      "a Palace of Darkness key may sit behind a key door the spheres' items do not open yet (Rules.py:395)",
    "sphere 10: Ganons Tower - Firesnake Room maybe":
      "the room asks for three keys, or two with the big key or this key placed where the fill may not have (Rules.py:424); a key may still wait behind a door the spheres' items do not open",
  },
  DvW0egkQyd: {
    "sphere 3: Desert Palace - Prize maybe":
      "Desert Palace's key may sit at the Torch, behind the Pegasus Boots (Rules.py:269); no boots yet",
    "sphere 5: Misery Mire - Prize maybe":
      "a Misery Mire key may sit in the Spike Chest, which asks for 4 hearts, the Cane of Byrna or the Cape (Rules.py:347)",
  },
  dMEp8enPG1: {
    "sphere 3: Ice Palace - Prize maybe":
      "Ice Palace's second key may sit with Kholdstare, whose door one key opens with the Cane of Somaria (Rules.py:336); no Somaria yet",
    "sphere 5: Agahnim 2 maybe":
      "a Ganon's Tower key may sit at Bob's Torch, behind the Pegasus Boots (Rules.py:409); no boots yet",
  },
  qMleRm5avd: {
    "sphere 3: Palace of Darkness - Compass Chest maybe":
      "a Palace of Darkness key may sit behind a key door the spheres' items do not open yet (Rules.py:395)",
  },
};

/**
 * The seeds the pack cannot hold yet, and why. Each is asserted to still be
 * pending, so the step that models its mode must remove it from here (its
 * test turns red the day it no longer is) and no seed is ever skipped
 * silently. A seed is pending when its playthrough fails or the pack refuses
 * its settings or entrances; `pinned` says so otherwise.
 */
const PENDING: Readonly<
  Record<string, { reason: string; pinned?: () => boolean }>
> = {
  kveDj7bgMm: {
    reason:
      "insanity decouples a door from its exit (Entrances lists them apart); a mode that stays unmodelled",
  },
};

const SEEDS = erSeedHashes();

describe("the recordings", () => {
  it("hold every mode of the study, and the pending ones are recorded", () => {
    expect(SEEDS).toHaveLength(10);
    for (const hash of Object.keys(PENDING)) expect(SEEDS).toContain(hash);
  });
});

describe("a recorded seed's playthrough, entrances all noted", () => {
  for (const hash of SEEDS) {
    const { meta } = erSeed(hash).spoiler;
    const label = `${hash}: ${meta.mode}, ${meta.shuffle}, ${meta.dungeon_items} dungeon items, boss shuffle ${meta["enemizer.boss_shuffle"]}`;
    const pending = PENDING[hash];
    if (pending === undefined || pending.pinned !== undefined) {
      it(`${label}: every location of a sphere is yes, or doubted for a key`, () => {
        // Sorted: the table's keys are kept in Biome's order, not the spheres'
        expect(misses(hash).sort()).toEqual(
          Object.keys(KEY_DOUBTS[hash] ?? {}).sort(),
        );
      });
    }
    if (pending !== undefined) {
      it(`${label}: is still pending (${pending.reason})`, () => {
        let stillPending: boolean;
        if (pending.pinned !== undefined) stillPending = pending.pinned();
        else {
          try {
            stillPending = misses(hash).length > 0;
          } catch (error) {
            if (!(error instanceof RangeError)) throw error;
            stillPending = true;
          }
        }
        expect(stillPending, "no longer pending: remove it from PENDING").toBe(
          true,
        );
      });
    }
  }
});

/** The seeds the pack models: all but the pending ones. */
const MODELLED = SEEDS.filter((hash) => PENDING[hash] === undefined);

/** The world's locations, by the pack's ids: those a map shows. */
const LOCATIONS = er.regions.flatMap((r) => r.locations).map(erLocationId);

/**
 * The playthrough's states: what each sphere starts with, and what a
 * player who read the spoiler knows (its pads, its bosses).
 */
function sphereStates(spoiler: ErSeed["spoiler"]): State[] {
  const knowledge = {
    ...knowing(spoiler.Special),
    ...bossesKnown(spoiler.Bosses),
  };
  const held: string[] = [];
  return spheresOf(spoiler).map(([, sphere]) => {
    const state = { ...holding(held), ...knowledge };
    held.push(...Object.values(sphere).map(plain));
    return state;
  });
}

/** The locations `yes` in a world, in each state. */
const yesIn = (world: ErWorld, states: readonly State[]) =>
  states.map((state) => {
    const solution = solveErWithKeys(world, state);
    return new Set(LOCATIONS.filter((id) => solution.location(id) === "yes"));
  });

/** What `fewer` says `yes` to and `more` does not, state by state. */
const taken = (
  fewer: readonly ReadonlySet<string>[],
  more: readonly ReadonlySet<string>[],
): string[] =>
  fewer.flatMap((yes, i) =>
    [...yes].filter((id) => !more[i]?.has(id)).map((id) => `state ${i}: ${id}`),
  );

/**
 * Turtle Rock's ways out: where everything held enters it decides how many
 * keys its doors take (set_trock_key_rules, Rules.py:1007-1090).
 */
const TURTLE_ROCK_EXITS = new Set(
  [
    "Turtle Rock Exit (Front)",
    "Turtle Rock Isolated Ledge Exit",
    "Turtle Rock Ledge Exit (East)",
    "Turtle Rock Ledge Exit (West)",
  ].map((name) => targetNamed(name).id),
);

describe("noting more of a seed's doors", () => {
  for (const hash of MODELLED) {
    it(`never takes a yes away, each door into Turtle Rock left out or alone noted (${hash})`, () => {
      const { spoiler } = erSeed(hash);
      const notes = seedNotes(spoiler);
      // Where the player tracks its keys (keysanity), at every count its
      // doors may ask for less than (Rules.py:1019-1025)
      const states = sphereStates(spoiler).flatMap((state) =>
        spoiler.meta.dungeon_items === "full"
          ? [0, 1, 2, 3].map((keys) => ({
              ...state,
              keyD7: Math.max(keys, itemValue(state, "keyD7")),
            }))
          : [state],
      );
      const all = yesIn(seedWorld(spoiler), states);
      const doors = Object.keys(notes).filter((door) =>
        TURTLE_ROCK_EXITS.has(notes[door] ?? ""),
      );
      expect(doors).toHaveLength(4);
      const takenBy = (noted: (door: string) => boolean) =>
        taken(
          yesIn(
            seedWorld(
              spoiler,
              {},
              Object.fromEntries(
                Object.entries(notes).filter(([door]) => noted(door)),
              ),
            ),
            states,
          ),
          all,
        );
      for (const door of doors) {
        expect(takenBy((other) => other !== door)).toEqual([]);
        expect(
          takenBy((other) => other === door || !doors.includes(other)),
        ).toEqual([]);
      }
    });

    it(`never takes a yes away, its doors noted in any order (${hash})`, () => {
      const { spoiler } = erSeed(hash);
      const notes = Object.entries(seedNotes(spoiler));
      const states = sphereStates(spoiler);
      fc.assert(
        fc.property(
          fc.shuffledSubarray(notes, { minLength: notes.length }),
          (order) => {
            // A third of them noted, two thirds, all
            const yes = [1, 2, 3].map((third) =>
              yesIn(
                seedWorld(
                  spoiler,
                  {},
                  Object.fromEntries(
                    order.slice(0, Math.round((order.length * third) / 3)),
                  ),
                ),
                states,
              ),
            );
            return yes.every(
              (now, i) => i === 0 || taken(yes[i - 1] ?? [], now).length === 0,
            );
          },
        ),
        { numRuns: 2, seed: hash.charCodeAt(0) },
      );
    });
  }
});
