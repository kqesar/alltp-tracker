// DR's key logic seeds (test/suite/*key_logic*.yaml, imported by
// import-dr.mjs into test/dr-upstream/suite/), held against the pack's
// port of DR's key rules (src/door-world/keys.ts over key-analysis/).
// Each seed's Verification says whether DR's fill may place an item at a
// location (Fill.py:711-740): it may not where, with every other item held
// and the seed's placements found where reached, the location stays out of
// reach. So an item the fill may not place is never `yes` here
// (`false ⇒ not yes`), but where the fill only forbids the item: a big key
// in its dungeon's bk_restricted locations (forbid_item, Rules.py:2362-2364),
// which the port's analysis names too. Where it may place, the pack's
// answer is counted, not held: the fill's state holds what was not placed
// yet, the player's keys are what the player records.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Settings } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { type DrWorld, drKeyLogic, drWorld } from "../src/door-world/index";
import { solveFacts } from "../src/facts";
import { collect, POOL, settingsOf } from "./dr-state";
import { PACK_DIR } from "./manifest";

interface Seed {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly placements: Readonly<Record<string, string>>;
  readonly verifications: readonly {
    readonly item: string;
    readonly locations: Readonly<Record<string, boolean>>;
  }[];
}

const read = (name: string): Seed =>
  JSON.parse(
    readFileSync(join(PACK_DIR, "test/dr-upstream/suite", name), "utf8"),
  ) as Seed;

/** A seed's settings as the world's (CustomSettings.py:136-146). */
function settingsFor(seed: Seed): Settings {
  const s = seed.settings;
  const keysanity = s.keysanity === true;
  return {
    ...settingsOf("open"),
    ...(keysanity ? { wildBigKeys: true, wildKeys: true } : {}),
    ...(s.key_logic_algorithm === "strict" ? { strictKeyLogic: true } : {}),
    ...(typeof s.crystals_needed_for_gt === "number"
      ? { crystalsTower: s.crystals_needed_for_gt }
      : {}),
  };
}

/**
 * Where `location` stands with every item but `item` and the placed ones
 * held, each placed item found once its location is surely reached.
 */
function verify(
  world: DrWorld,
  seed: Seed,
  item: string,
  location: string,
): string {
  const pool = [...POOL];
  for (const name of [item, ...Object.values(seed.placements)]) {
    const at = pool.indexOf(name);
    if (at >= 0) pool.splice(at, 1);
  }
  const found = new Set<string>();
  const id = (name: string) => world.locationIds.get(name) ?? name;
  for (;;) {
    const held = [
      ...pool,
      ...[...found].map((spot) => seed.placements[spot] ?? ""),
    ];
    const solution = solveFacts(world, collect(held));
    const more = Object.keys(seed.placements).filter(
      (spot) => !found.has(spot) && solution.location(id(spot)) === "yes",
    );
    if (more.length === 0) return solution.location(id(location));
    for (const spot of more) found.add(spot);
  }
}

/** Each seed held, with the pack's answer to its placeable spots. */
const SEEDS: readonly (readonly [string, number, number, number])[] = [
  // file, the spots it may not place at, those of them the pack reaches
  // where the fill forbids the big key, the spots it may place at the pack
  // says yes to
  ["partial_key_logic.json", 3, 0, 4],
  ["partial_key_logic_2.json", 5, 0, 2],
  ["partial_key_logic_3.json", 34, 1, 67],
  ["strict_key_logic.json", 5, 0, 2],
  // `dangerous`, which the pack reads as partial: more doubt, no more yes
  ["default_key_logic.json", 3, 0, 2],
];

describe("DR's key logic seeds", () => {
  for (const [file, refused, forbids, placeable] of SEEDS)
    it(`never says yes where the fill may not place (${file})`, () => {
      const seed = read(file);
      const settings = settingsFor(seed);
      const world = drWorld(settings);
      // The big key's forbidden spots (bk_restricted), by item
      const forbidden = new Set(
        [...drKeyLogic(settings).values()].flatMap((logic) =>
          [...logic.bkRestricted].map(
            (loc) => `Big Key (${logic.dungeon}) at ${loc.name}`,
          ),
        ),
      );
      const failures: string[] = [];
      let no = 0;
      let restricted = 0;
      let yes = 0;
      for (const { item, locations } of seed.verifications)
        for (const [location, may] of Object.entries(locations)) {
          const got = verify(world, seed, item, location);
          if (!may) {
            no++;
            if (got !== "yes") continue;
            if (forbidden.has(`${item} at ${location}`)) restricted++;
            else failures.push(`${item} at ${location}: yes`);
          } else if (got === "yes") yes++;
        }
      expect(failures).toEqual([]);
      expect([no, restricted, yes]).toEqual([refused, forbids, placeable]);
    });
});
