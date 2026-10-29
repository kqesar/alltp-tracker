// Loads the entrance-randomizer seeds scripts/record-er-seeds.mjs records
// under test/er-seeds/: a real seed's spoiler, its patch left out.
import { readFileSync } from "node:fs";
import type { State } from "@alltp/engine";
import { DUNGEON_CODES, ITEMS } from "../scripts/er-rules.mjs";
import {
  BOSS_PLACES,
  type BossPlaceId,
  bossFacts,
  SHUFFLED_BOSSES,
  type ShuffledBoss,
} from "../src/bosses";
import rules from "../src/entrances/rules.json" with { type: "json" };
import { medallionFacts, padsFromUpstream } from "../src/medallions";

/** One line of a spoiler's `Entrances`: a door or hole and where it leads. */
export interface ErEntrance {
  readonly direction: "both" | "entrance" | "exit";
  readonly entrance: string;
  readonly exit: string;
}

/** A recorded seed: where the file says it came from, and its spoiler. */
export interface ErSeed {
  readonly generated: string;
  readonly hash: string;
  readonly spoiler: {
    readonly Entrances: readonly ErEntrance[];
    readonly Bosses: Readonly<Record<string, string>>;
    /** The medallion each pad wants, by the pad's dungeon. */
    readonly Special: Readonly<Record<string, string>>;
    readonly meta: {
      readonly dungeon_items: string;
      readonly mode: string;
      readonly shuffle: string;
      readonly [key: string]: unknown;
    };
    /** Sphere number to location to item; a sphere may also be a note. */
    readonly playthrough: Readonly<
      Record<string, Readonly<Record<string, string>> | string | number>
    >;
    /** Every other section: a place's locations and their items. */
    readonly [section: string]: unknown;
  };
}

/** The records of `test/er-seeds/index.json`. */
export function erSeedHashes(): string[] {
  const index = JSON.parse(
    readFileSync(new URL("er-seeds/index.json", import.meta.url), "utf8"),
  ) as { seeds: Record<string, unknown> };
  return Object.keys(index.seeds);
}

/** A recorded seed. */
export function erSeed(hash: string): ErSeed {
  return JSON.parse(
    readFileSync(new URL(`er-seeds/${hash}.json`, import.meta.url), "utf8"),
  ) as ErSeed;
}

const PROGRESSIVE: Readonly<Record<string, string>> = {
  "Progressive Armor": "armor",
  "Progressive Bow": "bow",
  "Progressive Glove": "glove",
  "Progressive Shield": "shield",
  "Progressive Sword": "sword",
};

/** The event items (Agahnim's defeats...), by the spoiler's name. */
const EVENTS = new Map(
  Object.entries(rules.events).map(([id, { item }]) => [item, id]),
);

/**
 * The state holding the items a spoiler names, the way it spells them
 * ("Small Key (Desert Palace)", "Rupees (20)", a bare "Key" in Retro): the
 * entrance randomizer's names, which are not vt's. The three hearts Link
 * starts with are held.
 */
export function holding(names: readonly string[]): State {
  const state: Record<string, number> = { heartContainer: 3 };
  const add = (id: string) => {
    state[id] = (state[id] ?? 0) + 1;
  };
  const atLeast = (id: string, level: number) => {
    state[id] = Math.max(state[id] ?? 0, level);
  };
  for (const name of names) {
    const key = /^(Small|Big) Key \((.+)\)$/.exec(name);
    const item = (ITEMS as Record<string, [string, number?]>)[name];
    const event = EVENTS.get(name);
    if (PROGRESSIVE[name] !== undefined) add(PROGRESSIVE[name]);
    else if (name.startsWith("Bottle")) add("bottle");
    else if (/^(Boss|Sanctuary) Heart Container$/.test(name))
      add("heartContainer");
    else if (name === "Piece of Heart") add("pieceOfHeart");
    else if (name === "Bombs (10)") atLeast("tenBombs", 1);
    else if (name === "Silver Arrows") atLeast("silverArrowUpgrade", 1);
    else if (key !== null) {
      const code =
        (DUNGEON_CODES as Record<string, string>)[key[2] ?? ""] ??
        (key[2] === "Escape" ? "H2" : undefined);
      if (key[1] === "Small") add(`key${code}`);
      else atLeast(`bigKey${code}`, 1);
    } else if (item !== undefined) atLeast(item[0], item[1] ?? 1);
    else if (event !== undefined) atLeast(event, 1);
  }
  return state;
}

/**
 * What the seed's spoiler tells a player who reads it: the medallion each
 * pad wants (`Special`), as the facts of a state.
 */
export function knowing(special: Readonly<Record<string, string>>): State {
  return medallionFacts(
    padsFromUpstream(
      Object.fromEntries(
        Object.entries(special).map(([place, item]) => [
          `${place} Medallion`,
          item,
        ]),
      ),
    ),
  );
}

/** A spoiler's `Bosses` place that is no slot's name spelled alike. */
const BOSS_PLACE_NAMES: Readonly<Record<string, BossPlaceId>> = {
  "Ganons Tower Basement": "ganonsTowerBottom",
};

/** A name without its spaces and case: "Tower Of Hera", "towerOfHera". */
const squeezed = (name: string) => name.replaceAll(" ", "").toLowerCase();

/**
 * What the seed's spoiler tells of its bosses (`Bosses`), as the facts of a
 * state: each slot boss shuffle fills, its boss (the Agahnims and Ganon,
 * which never move, left out).
 */
export function bossesKnown(bosses: Readonly<Record<string, string>>): State {
  const known: Partial<Record<BossPlaceId, ShuffledBoss>> = {};
  for (const [place, name] of Object.entries(bosses)) {
    const slot =
      BOSS_PLACE_NAMES[place] ??
      (Object.keys(BOSS_PLACES) as BossPlaceId[]).find(
        (id) => squeezed(id) === squeezed(place),
      );
    const boss = SHUFFLED_BOSSES.find((b) => squeezed(b) === squeezed(name));
    if (slot !== undefined && boss !== undefined) known[slot] = boss;
  }
  return bossFacts(known);
}

/** A retro seed's shops (`Shops`) selling an item: their names. */
export function shopsSelling(
  shops: unknown,
  item: "Single Arrow" | "Small Key (Universal)",
): string[] {
  if (!Array.isArray(shops)) return [];
  return (shops as readonly Record<string, string>[])
    .filter((shop) =>
      Object.entries(shop).some(
        ([key, value]) => key.startsWith("item_") && value.startsWith(item),
      ),
    )
    .map((shop) => shop.location ?? "");
}
