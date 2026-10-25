// vt's own spoiler: what alttpr.com writes for a seed it randomized itself
// (entrances in their place). World::getSpoiler (app/World.php:932-1040 at
// 219fcafd) writes a name as `name:world`, a location's and an item's alike
// (Location.php:289-292, Item.php:332-335), and an item as the class
// `UPSTREAM_ITEMS` keys on: `ProgressiveSword:1`.
//
// The playthrough is a list of spheres, each holding the locations it opens by
// region: `{ "1": { "Light World": { "Hobo:1": "IceRod:1" } }, … }`, then two
// counts (`longest_item_chain`, `regions_visited`).

import * as z from "zod/mini";
import { UPSTREAM_ITEMS } from "../items";
import { locationId } from "../location";
import ITEM_NAMES from "./item-names.json";
import type { Shape } from "./read";

const WORLD = /^(.+):(\d+)$/;

/** The name without its world, or null for another world's or none. */
const ofWorld = (written: string): string | null => {
  const match = WORLD.exec(written);
  return match?.[2] === "1" && match[1] !== undefined ? match[1] : null;
};

const PLAYTHROUGH = z.record(
  z.string(),
  z.union([z.number(), z.record(z.string(), z.record(z.string(), z.string()))]),
);

const SHOP_ITEM = z.object({ item: z.string(), price: z.number() });

/** The English name of a vt item class, as resources/lang/en/item.php has it. */
export const englishName = (itemClass: string): string =>
  (ITEM_NAMES.names as Record<string, string | undefined>)[itemClass] ??
  itemClass;

export const VT: Shape = {
  describeItem: (written) => {
    const itemClass = ofWorld(written);
    return itemClass === null ? written : englishName(itemClass);
  },
  format: "vt",
  id: locationId,
  item: (written) => {
    const itemClass = ofWorld(written);
    if (itemClass === null) return { kind: "world" };
    return UPSTREAM_ITEMS.has(itemClass)
      ? { class: itemClass, kind: "item", name: englishName(itemClass) }
      : { kind: "unknown" };
  },
  name: ofWorld,
  playthrough: (value) => {
    const parsed = PLAYTHROUGH.safeParse(value);
    if (!parsed.success) return null;
    const entries: [number, string][] = [];
    for (const [key, spheres] of Object.entries(parsed.data)) {
      // `longest_item_chain` and `regions_visited`
      if (typeof spheres === "number") continue;
      const sphere = Number(key);
      if (!Number.isInteger(sphere) || sphere < 1) return null;
      for (const locations of Object.values(spheres)) {
        for (const written of Object.keys(locations)) {
          entries.push([sphere, written]);
        }
      }
    }
    return entries;
  },
  shopItem: (value) => {
    const parsed = SHOP_ITEM.safeParse(value);
    if (!parsed.success) return null;
    const itemClass = ofWorld(parsed.data.item);
    return {
      name: itemClass === null ? parsed.data.item : englishName(itemClass),
      price: parsed.data.price,
    };
  },
  special: (special) => {
    const byName = new Map(
      Object.entries(special).map(([key, item]) => [ofWorld(key) ?? key, item]),
    );
    const medallion = (key: string) =>
      ofWorld(byName.get(key) ?? "")?.toLowerCase() ?? null;
    return {
      medallions: {
        mire: medallion("Misery Mire Medallion"),
        turtleRock: medallion("Turtle Rock Medallion"),
      },
      // The bottles and the two medallions are locations of the pack
      placements: Object.entries(special),
    };
  },
};
