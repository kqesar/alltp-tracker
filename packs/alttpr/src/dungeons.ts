// The dungeons: the regions whose items upstream keeps inside them, and the
// code their keys, big key, map and compass carry (`KeyP3`, `BigKeyP3`).
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31): each
// dungeon is a region of app/World/Standard.php whose `$region_items` name
// its dungeon items, and config/item.php:94-147 holds how many of each the
// pool has, which items.ts keeps as each item's maximum.
import { ITEMS } from "./items";
import type { Source } from "./location";
import { regionModules } from "./pack";
import type { AlttprSettings } from "./settings";
import type { RegionDef } from "./world";

/** One dungeon. */
export interface DungeonDef {
  /** Its id: the slug of its name, which its locations' ids start with. */
  readonly id: string;
  readonly name: string;
  /**
   * The engine id of its region (the key of World/Standard.php, as
   * regionId spells it). The region module holding it is the dungeon: Turtle
   * Rock's three ways in are parts of it.
   */
  readonly region: string;
  /** The code of its items (`P3`): keyP3, bigKeyP3, mapP3, compassP3. */
  readonly code: string;
  /** Its `$region_items`, which name that code. */
  readonly source: Source;
  /**
   * The event its prize location holds, which completing it gives: Zelda
   * rescued, Agahnim or Agahnim 2 defeated. A dungeon without one drops a
   * pendant or a crystal, which the randomizer shuffles among the ten of
   * them (app/Randomizer.php:464-540).
   */
  readonly event?: {
    readonly item: "defeatAgahnim" | "defeatAgahnim2" | "rescueZelda";
    readonly source: Source;
  };
}

const at = (file: string, line: number): Source =>
  `app/Region/Standard/${file}.php:${line}`;

/** The thirteen dungeons, in the order of World/Standard.php. */
export const DUNGEONS = [
  {
    code: "H2",
    event: {
      item: "rescueZelda",
      source: at("HyruleCastleEscape", 56),
    },
    id: "hyrule-castle",
    name: "Hyrule Castle",
    region: "escape",
    source: at("HyruleCastleEscape", 18),
  },
  {
    code: "P1",
    id: "eastern-palace",
    name: "Eastern Palace",
    region: "easternPalace",
    source: at("EasternPalace", 24),
  },
  {
    code: "P2",
    id: "desert-palace",
    name: "Desert Palace",
    region: "desertPalace",
    source: at("DesertPalace", 27),
  },
  {
    code: "P3",
    id: "tower-of-hera",
    name: "Tower of Hera",
    region: "towerOfHera",
    source: at("TowerOfHera", 26),
  },
  {
    code: "A1",
    event: {
      item: "defeatAgahnim",
      source: at("HyruleCastleTower", 47),
    },
    id: "castle-tower",
    name: "Castle Tower",
    region: "hyruleCastleTower",
    source: at("HyruleCastleTower", 18),
  },
  {
    code: "D1",
    id: "palace-of-darkness",
    name: "Palace of Darkness",
    region: "palaceOfDarkness",
    source: at("PalaceOfDarkness", 24),
  },
  {
    code: "D2",
    id: "swamp-palace",
    name: "Swamp Palace",
    region: "swampPalace",
    source: at("SwampPalace", 24),
  },
  {
    code: "D3",
    id: "skull-woods",
    name: "Skull Woods",
    region: "skullWoods",
    source: at("SkullWoods", 31),
  },
  {
    code: "D4",
    id: "thieves-town",
    name: "Thieves' Town",
    region: "thievesTown",
    source: at("ThievesTown", 24),
  },
  {
    code: "D5",
    id: "ice-palace",
    name: "Ice Palace",
    region: "icePalace",
    source: at("IcePalace", 24),
  },
  {
    code: "D6",
    id: "misery-mire",
    name: "Misery Mire",
    region: "miseryMire",
    source: at("MiseryMire", 24),
  },
  {
    code: "D7",
    id: "turtle-rock",
    name: "Turtle Rock",
    region: "turtleRock",
    source: at("TurtleRock", 27),
  },
  {
    code: "A2",
    event: {
      item: "defeatAgahnim2",
      source: at("GanonsTower", 84),
    },
    id: "ganons-tower",
    name: "Ganon's Tower",
    region: "ganonsTower",
    source: at("GanonsTower", 25),
  },
] as const satisfies readonly DungeonDef[];

export type DungeonId = (typeof DUNGEONS)[number]["id"];

/** The ids of the dungeons, for tables keyed by dungeon. */
export const DUNGEON_IDS: readonly DungeonId[] = DUNGEONS.map((d) => d.id);

/** The dungeon of an id; throws a RangeError for an id it does not know. */
export function dungeon(id: string): DungeonDef {
  const found = DUNGEONS.find((d) => d.id === id);
  if (found === undefined) throw new RangeError(`No dungeon "${id}"`);
  return found;
}

const POOL = new Map<string, number>(ITEMS.map(({ id, max }) => [id, max]));

/**
 * How many of each of its items the pool holds (config/item.php:94-147):
 * small keys, big key, map and compass. Eastern Palace has no small key.
 */
export function dungeonPool(d: DungeonDef): {
  readonly bigKey: number;
  readonly compass: number;
  readonly map: number;
  readonly smallKeys: number;
} {
  return {
    bigKey: POOL.get(`bigKey${d.code}`) ?? 0,
    compass: POOL.get(`compass${d.code}`) ?? 0,
    map: POOL.get(`map${d.code}`) ?? 0,
    smallKeys: POOL.get(`key${d.code}`) ?? 0,
  };
}

/** The regions of a dungeon in the run's world: its region module's. */
export function dungeonRegions(
  d: DungeonDef,
  settings: AlttprSettings,
): readonly RegionDef[] {
  const module = regionModules(settings).find((m) =>
    m.regions.some((r) => r.id === d.region),
  );
  if (module === undefined) {
    throw new RangeError(`No region "${d.region}" for ${d.id}`);
  }
  return module.regions;
}

/**
 * The dungeon's item locations in the run's world: every location of its
 * regions but the prize, which holds a pendant, a crystal or an event.
 */
export function dungeonLocations(
  d: DungeonDef,
  settings: AlttprSettings,
): string[] {
  return dungeonRegions(d, settings).flatMap((r) =>
    r.locations.filter((l) => l.kind !== "prize").map((l) => l.id),
  );
}
