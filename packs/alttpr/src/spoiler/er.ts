// The entrance randomizer's spoiler: what alttpr.com writes for a seed with
// shuffled entrances, which vt hands to cassidoxa/ALttPEntranceRandomizer and
// stores the output of (EntranceRandomizer.php:159-166). Spoiler.to_json
// (BaseClasses.py:1042-1058 at 8a1ac4d4) names a location by the randomizer's
// own name, with no world, and an item in English (`Small Key (Ice Palace)`),
// which er-items.json maps to vt's class on the ROM code.
//
// Its sections are by the kind of region (`Light World`, `Caves`, a dungeon),
// the playthrough has no region level (`{ "1": { "Hobo": "Ice Rod" } }`) and
// no counts, and `Special` holds the two medallions only. Events (`Beat
// Agahnim 1`, `Get Frog`) are listed as items; they have no item of vt's.

import * as z from "zod/mini";
import { erLocationId } from "../entrances";
import { UPSTREAM_ITEMS } from "../items";
import ER_ITEMS from "./er-items.json";
import type { Shape } from "./read";

const PLAYTHROUGH = z.record(
  z.string(),
  z.union([z.number(), z.record(z.string(), z.string())]),
);

/** `Red Potion — 150`: the name, a dash, the price. */
const SHOP_ITEM = /^(.+) — (\d+)$/;

const classOf = (written: string): string | null | undefined =>
  (ER_ITEMS.items as Record<string, string | null | undefined>)[written];

export const ER: Shape = {
  describeItem: (written) => written,
  format: "er",
  id: erLocationId,
  item: (written) => {
    const itemClass = classOf(written);
    if (itemClass === null) return { kind: "event" };
    return itemClass !== undefined && UPSTREAM_ITEMS.has(itemClass)
      ? { class: itemClass, kind: "item", name: written }
      : { kind: "unknown" };
  },
  name: (written) => written,
  playthrough: (value) => {
    const parsed = PLAYTHROUGH.safeParse(value);
    if (!parsed.success) return null;
    const entries: [number, string][] = [];
    for (const [key, locations] of Object.entries(parsed.data)) {
      if (typeof locations === "number") continue;
      const sphere = Number(key);
      if (!Number.isInteger(sphere) || sphere < 1) return null;
      for (const written of Object.keys(locations)) {
        entries.push([sphere, written]);
      }
    }
    return entries;
  },
  shopItem: (value) => {
    if (typeof value !== "string") return null;
    const match = SHOP_ITEM.exec(value);
    return match?.[1] === undefined
      ? { name: value, price: null }
      : { name: match[1], price: Number(match[2]) };
  },
  special: (special) => ({
    medallions: {
      mire: special["Misery Mire"]?.toLowerCase() ?? null,
      turtleRock: special["Turtle Rock"]?.toLowerCase() ?? null,
    },
    // Not locations: the medallions are not in its sections
    placements: [],
  }),
};
