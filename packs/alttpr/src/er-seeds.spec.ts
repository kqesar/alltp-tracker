// The entrance randomizer's world held to real seeds: test/er-seeds/ keeps
// the spoilers of seeds alttpr.com generated (`record-er-seeds`, the README's
// "Entrance randomizer seeds"). A spoiler's playthrough is the randomizer's own
// proof that its spheres are reachable in order, so with every entrance of
// the seed noted and the items of the earlier spheres held, every location
// of a sphere must be `yes` (the contract: upstream reaches it, so must we).
import { describe, expect, it } from "vitest";
import {
  bossesKnown,
  type ErSeed,
  erSeed,
  erSeedHashes,
  holding,
  knowing,
  shopsSelling,
} from "../test/er-seeds";
import { entranceNamed, erLocationId, targetNamed } from "./entrances";
import er from "./entrances/er.json" with { type: "json" };
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
    let solution = solveFacts(world, {
      ...holding(held),
      ...knowledge,
      ...marked,
    });
    const inside = (shops: readonly string[]) =>
      shops.some((shop) => solution.region(regionNamed(shop)) === "yes");
    if (marked.shopKey === undefined && inside(keyShops)) marked.shopKey = 1;
    if (marked.shopArrow === undefined && inside(arrowShops))
      marked.shopArrow = 1;
    solution = solveFacts(world, {
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
 * The seeds the pack cannot hold yet, and why. Each is asserted to still be
 * pending, so the step that models its mode must remove it from here (its
 * test turns red the day it no longer is) and no seed is ever skipped
 * silently. A seed is pending when its playthrough fails or the pack refuses
 * its settings or entrances; `pinned` says so otherwise.
 */
const PENDING: Readonly<
  Record<string, { reason: string; pinned?: () => boolean }>
> = {
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
