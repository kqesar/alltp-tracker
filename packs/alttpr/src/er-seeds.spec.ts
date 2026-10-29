// The entrance randomizer's world held to real seeds: test/er-seeds/ keeps
// the spoilers of seeds alttpr.com generated (`record-er-seeds`, the README's
// "Entrance randomizer seeds"). A spoiler's playthrough is the randomizer's own
// proof that its spheres are reachable in order, so with every entrance of
// the seed noted and the items of the earlier spheres held, every location
// of a sphere must be `yes` (the contract: upstream reaches it, so must we).
import { describe, expect, it } from "vitest";
import {
  type ErSeed,
  erSeed,
  erSeedHashes,
  holding,
  knowing,
} from "../test/er-seeds";
import { entranceNamed, erLocationId, targetNamed } from "./entrances";
import { crossedConnections, erWorld, solveFacts } from "./er-world";
import { settingsFromUpstream } from "./settings";

/** The seed's world, entrances all noted, and what its spoiler lets us know. */
function worldOf(spoiler: ErSeed["spoiler"], bossShuffle?: string) {
  const { meta } = spoiler;
  const settings = settingsFromUpstream(meta.mode, {
    dungeonItems: meta.dungeon_items,
    "enemizer.bossShuffle": bossShuffle ?? meta["enemizer.boss_shuffle"],
  });
  // Link's House and the Tavern's back door stay, its Chris Houlihan room
  // is a way out (entrances.spec.ts)
  const fixed = new Set(["Links House", "Tavern North"]);
  const noted = Object.fromEntries(
    spoiler.Entrances.filter(
      (m) => m.direction !== "exit" && !fixed.has(m.entrance),
    ).map((m) => [entranceNamed(m.entrance).id, targetNamed(m.exit).id]),
  );
  return erWorld(
    settings,
    crossedConnections(settings.standardMode ? "standard" : "open", noted),
  );
}

/** The playthrough's spheres in order, a location to its item in each. */
const spheresOf = (spoiler: ErSeed["spoiler"]) =>
  Object.entries(spoiler.playthrough)
    .filter(
      (entry): entry is [string, Record<string, string>] =>
        typeof entry[1] === "object",
    )
    .sort(([a], [b]) => Number(a) - Number(b));

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
  const knowledge = knowing(spoiler.Special);
  const held: string[] = [];
  const missed: string[] = [];
  for (const [number, sphere] of spheresOf(spoiler)) {
    const solution = solveFacts(world, { ...holding(held), ...knowledge });
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
 * Whether the entrance randomizer's world answers a boss-shuffle seed as if
 * the bosses were not shuffled, in the state half its playthrough leads to.
 * It reads no boss slot (`rules.json` holds the vanilla bosses' rules alone).
 */
function ignoresBossShuffle(hash: string): boolean {
  const { spoiler } = erSeed(hash);
  const spheres = spheresOf(spoiler);
  const state = {
    ...holding(
      spheres
        .slice(0, Math.floor(spheres.length / 2))
        .flatMap(([, sphere]) => Object.values(sphere).map(plain)),
    ),
    ...knowing(spoiler.Special),
  };
  const answers = (bossShuffle?: string) =>
    solveFacts(worldOf(spoiler, bossShuffle), state).locations();
  return JSON.stringify(answers()) === JSON.stringify(answers("none"));
}

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
  "0yAObLe6MV": {
    // The spheres hold, the ER world being blind to which boss is where:
    // that proves nothing of boss shuffle, so the blindness is pinned
    pinned: () => ignoresBossShuffle("0yAObLe6MV"),
    reason:
      "boss shuffle full: the ER world reads no boss slot (rules.json has the vanilla bosses)",
  },
  "6GKBQZ3pye": {
    reason:
      "standard dungeon items (keys in their dungeon, the ER world reads them as items) and the simple shuffle's pools",
  },
  DvW0egkQyd: {
    reason:
      "standard dungeon items (keys in their dungeon, the ER world reads them as items) and the simple shuffle's pools",
  },
  dMEp8enPG1: {
    reason:
      "standard dungeon items: every miss is a dungeon's key, big key or prize",
  },
  kveDj7bgMm: {
    reason:
      "insanity decouples a door from its exit (Entrances lists them apart); a mode that stays unmodelled",
  },
  qMleRm5avd: {
    reason:
      "standard dungeon items (every miss is a dungeon's) and the restricted shuffle's pools",
  },
  ry08p2d9y5: {
    reason:
      'Retro: the pack knows no "Take-Any #4" target, and the spoiler spells its keys as a bare "Key"',
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
      it(`${label}: every location of a sphere is yes`, () => {
        expect(misses(hash)).toEqual([]);
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
