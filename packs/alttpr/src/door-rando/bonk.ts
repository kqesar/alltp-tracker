// The Overworld Randomizer's bonk drops (owr/bonk.json, written by
// import-dr --owr, never by hand): the pack's `./bonk` entry, which only a
// run that shuffles them loads, so no other player downloads their data.
// The pack's index knows their ids alone (locations.ts: BONK_DROP_IDS).
import { locationId } from "@alltp/engine";
import { type DrLocation, NO_SCREEN } from "./locations";
import bonkData from "./owr/bonk.json" with { type: "json" };

/**
 * The bonk drops (owr:Regions.py bonk_prize_table), a run's locations while
 * it shuffles them (`drLocationsOf`'s `bonks`). A drop's flag is the bit of
 * its screen's byte the fork's own client reads (owr:MultiClient.py:
 * 978-987); the Cold Fairy's statue, in a cave, has none, so it is never
 * read.
 */
export const BONK_DROPS: readonly DrLocation[] = bonkData.drops.map(
  (drop): DrLocation => ({
    bonk: {
      aga: drop.aga,
      ...(drop.map === undefined
        ? {}
        : { map: { x: drop.map.x, y: drop.map.y } }),
    },
    cave: drop.flag === undefined,
    dungeon: null,
    // The cave's statue has no flag: no memory says it was taken
    flag:
      drop.flag === undefined
        ? { mask: 0, memory: "overworld", screen: NO_SCREEN }
        : {
            mask: drop.flag.mask,
            memory: "overworld",
            screen: drop.flag.screen,
          },
    id: locationId(drop.name),
    kind: "bonk",
    name: drop.name,
    region: drop.region,
    source: drop.source,
  }),
);
