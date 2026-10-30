// The Door Randomizer's entrance shuffles (source/overworld/
// EntranceShuffle2.py, read by import-dr.mjs into world/connections.json):
// which entrances a seed of each shuffle may move, and where each may lead,
// in the entrance randomizer's ids (src/entrances.ts), so a note of either
// randomizer is the same note.
//
// DR shuffles by pools (`modes`, :1518-1940): each pool a step of its own
// (dungeons among dungeons, Skull Woods' holes and doors among their own,
// some caves kept vanilla), then what is left by the mode's `undefined`
// behaviour (vanilla, shuffled or swapped). Its options decide some steps
// (skullwoods, linked_drops, shuffle_ganon), which a run does not record:
// where one could move an entrance, the pool counts it as moved, so an
// entrance not noted leads nowhere, never to a guess. Which targets each
// entrance may take is over-approximated the same way: the noter's choice,
// never the logic's, which reads only the notes.
import {
  ENTRANCES,
  type EntrancePool,
  type EntranceTarget,
  labelOf,
  type OverworldEntrance,
  TARGETS,
} from "../entrances";
import { locationId } from "../location";
import connectionData from "./world/connections.json" with { type: "json" };

/**
 * DR's entrance shuffles (`--shuffle`, args.json) but `vanilla` and OWR's
 * `district`, whose overworld is its own.
 */
export type DrShuffle =
  | "simple"
  | "restricted"
  | "full"
  | "crossed"
  | "insanity"
  | "swapped"
  | "lite"
  | "lean"
  | "dungeonssimple"
  | "dungeonsfull";

/** What of a DR run decides which entrances its shuffle may move. */
export interface DrPoolSettings {
  readonly mode: "open" | "standard" | "inverted";
  /** shufflelinks: Link's House among the shuffled doors (:555). */
  readonly shuffleLinks: boolean;
  /** shuffletavern: the Tavern's back door shuffled (:211). */
  readonly shuffleTavern: boolean;
  /** The settings lite's and lean's kept caves read (do_vanilla_connect). */
  readonly shopsanity: boolean;
  /** pottery: none, keys, dungeon, … (args.json). */
  readonly pottery: string;
  /** dropshuffle: none, keys, underworld (args.json). */
  readonly dropShuffle: string;
  readonly enemyShuffle: boolean;
}

type Table = { readonly line: number; readonly value: unknown };
const TABLES = (
  connectionData as unknown as Readonly<
    Record<string, Readonly<Record<string, Table>>>
  >
)["source/overworld/EntranceShuffle2.py"] as Readonly<Record<string, Table>>;

const value = <T>(name: string): T => {
  const table = TABLES[name];
  if (table === undefined) throw new RangeError(`No table ${name}`);
  return table.value as T;
};

const DROP_MAP = value<Readonly<Record<string, string>>>("drop_map");
const ENTRANCE_MAP = value<Readonly<Record<string, string>>>("entrance_map");
const SINGLE_MAP = value<Readonly<Record<string, string>>>(
  "single_entrance_map",
);
const SUB_TABLE = value<Readonly<Record<string, string>>>("inverted_sub_table");

/** A pool of a mode, as `modes` writes it. */
interface ModePool {
  readonly special?: string;
  readonly condition?: string | readonly string[];
  readonly entrances?: readonly (string | readonly string[])[];
  readonly connectors?: readonly (readonly string[])[];
  readonly directional?: readonly (readonly string[])[];
  readonly directional_inv?: readonly (readonly string[])[];
  readonly connectors_inv?: readonly (readonly string[])[];
  readonly options?: readonly (string | readonly string[])[];
  readonly entrance?: string;
}

/** A mode of `modes` (EntranceShuffle2.py:1518-1940). */
interface Mode {
  readonly undefined: "vanilla" | "shuffle" | "swap";
  readonly decoupled?: string;
  readonly pools?: Readonly<Record<string, ModePool>>;
}

const MODES = value<Readonly<Record<DrShuffle, Mode>>>("modes");

/** DR's names the entrance randomizer spells otherwise, entrances. */
const ER_ENTRANCE_NAMES: Readonly<Record<string, string>> = {
  "Dark Death Mountain Shop": "Cave Shop (Dark Death Mountain)",
  "Dark Lumberjack Shop": "Dark World Lumberjack Shop",
  "Dark Potion Shop": "Dark World Potion Shop",
  "Hammer Peg Cave": "Dark World Hammer Peg Cave",
  "Lake Hylia Shop": "Cave Shop (Lake Hylia)",
  "Mire Fairy": "Dark Desert Fairy",
  "Mire Hint": "Dark Desert Hint",
};

/**
 * DR's names the entrance randomizer spells otherwise, targets: the same
 * entrance number in both `exit_ids` (entrances.spec.ts holds it).
 */
const ER_TARGET_NAMES: Readonly<Record<string, string>> = {
  "Dark Death Mountain Shop": "Cave Shop (Dark Death Mountain)",
  "Dark Lumberjack Shop": "Dark World Lumberjack Shop",
  "Dark Potion Shop": "Dark World Potion Shop",
  "Hammer Peg Cave": "Dark World Hammer Peg Cave",
  "Hookshot Cave Back Exit": "Hookshot Cave Exit (North)",
  "Hookshot Cave Front Exit": "Hookshot Cave Exit (South)",
  "Lake Hylia Shop": "Cave Shop (Lake Hylia)",
  "Light Hype Fairy": "Swamp Healer Fairy",
  "Mire Healer Fairy": "Dark Desert Healer Fairy",
  "Mire Hint": "Dark Desert Hint",
  "Skull Back Drop": "Skull Woods Second Section (Drop)",
  "Skull Left Drop": "Skull Woods First Section (Left)",
  "Skull Pinball": "Skull Woods First Section (Right)",
  "Skull Pot Circle": "Skull Woods First Section (Top)",
};

/**
 * The targets DR shuffles that the entrance randomizer's pools never do:
 * Link's House (shufflelinks) and the Tavern's back (shuffletavern).
 */
export const DR_EXTRA_TARGETS: readonly EntranceTarget[] = [
  {
    id: locationId("Links House Exit"),
    kind: "connector",
    name: "Links House Exit",
    place: labelOf("Links House"),
  },
  { id: locationId("Tavern"), kind: "single", name: "Tavern", place: "Tavern" },
];

/** Every target a note may name, the entrance randomizer's and DR's own. */
export const DOOR_TARGETS: readonly EntranceTarget[] = [
  ...TARGETS,
  ...DR_EXTRA_TARGETS,
];

const TARGET_BY_NAME = new Map(DOOR_TARGETS.map((t) => [t.name, t]));
const ENTRANCE_BY_NAME = new Map(ENTRANCES.map((e) => [e.name, e]));

/** The target a DR name is, in the entrance randomizer's ids. */
export const drTargetOf = (name: string): EntranceTarget => {
  const found = TARGET_BY_NAME.get(ER_TARGET_NAMES[name] ?? name);
  if (found === undefined) throw new RangeError(`No target for DR's ${name}`);
  return found;
};

/** The entrance a DR name is, in the entrance randomizer's ids. */
export const drEntranceOf = (name: string): OverworldEntrance => {
  const found = ENTRANCE_BY_NAME.get(ER_ENTRANCE_NAMES[name] ?? name);
  if (found === undefined) throw new RangeError(`No entrance for DR's ${name}`);
  return found;
};

/** Where each entrance leads in a vanilla world of a mode. */
export interface VanillaEntrances {
  /** Every entrance of the pool, by DR's name (inverted names put in). */
  readonly pool: readonly string[];
  /** A cave's or dungeon's door to its exit, both ways. */
  readonly twoWay: ReadonlyMap<string, string>;
  /** A hole or a single cave's door to its region, one way. */
  readonly oneWay: ReadonlyMap<string, string>;
}

/**
 * link_entrances_new's pool and vanilla maps (EntranceShuffle2.py:45-80):
 * every entrance not named Inverted, Inverted's own names substituted, and
 * the Inverted world's swaps (:64-78).
 */
export function vanillaEntrances(inverted: boolean): VanillaEntrances {
  const pool = [
    ...[...Object.keys(DROP_MAP), ...Object.keys(ENTRANCE_MAP)].filter(
      (name) => !name.startsWith("Inverted"),
    ),
    ...Object.keys(SINGLE_MAP),
  ].map((name) => (inverted ? (SUB_TABLE[name] ?? name) : name));
  const twoWay = new Map(Object.entries(ENTRANCE_MAP));
  const oneWay = new Map([
    ...Object.entries(DROP_MAP),
    ...Object.entries(SINGLE_MAP),
  ]);
  if (inverted) {
    twoWay.set("Ganons Tower", "Agahnims Tower Exit");
    twoWay.set("Agahnims Tower", "Ganons Tower Exit");
    twoWay.set("Old Man Cave (West)", "Bumper Cave Exit (Bottom)");
    twoWay.set("Death Mountain Return Cave (West)", "Bumper Cave Exit (Top)");
    twoWay.set("Bumper Cave (Bottom)", "Old Man Cave Exit (West)");
    twoWay.set("Dark Death Mountain Fairy", "Old Man Cave Exit (East)");
    oneWay.delete("Dark Death Mountain Fairy");
    twoWay.set("Old Man Cave (East)", "Death Mountain Return Cave Exit (West)");
    oneWay.set("Bumper Cave (Top)", "Dark Death Mountain Healer Fairy");
    twoWay.delete("Bumper Cave (Top)");
    oneWay.delete("Big Bomb Shop");
    oneWay.set("Links House", "Big Bomb Shop");
    twoWay.delete("Links House");
    twoWay.set("Big Bomb Shop", "Links House Exit");
  }
  return { oneWay, pool, twoWay };
}

/** Where an entrance leads in the vanilla world: its exit or region. */
const vanillaTarget = (
  maps: VanillaEntrances,
  entrance: string,
): string | undefined => maps.twoWay.get(entrance) ?? maps.oneWay.get(entrance);

/** A pool's entrances, its lists flattened. */
const entrancesOf = (pool: ModePool): string[] =>
  [
    ...(pool.entrances ?? []),
    ...(pool.connectors ?? []),
    ...(pool.directional ?? []),
    ...(pool.directional_inv ?? []),
    ...(pool.connectors_inv ?? []),
    ...(pool.special === "simple_connector" ? (pool.options ?? []) : []),
    ...(pool.special === "limited" ? (pool.entrances ?? []) : []),
  ].flatMap((e) => (typeof e === "string" ? [e] : [...e]));

/**
 * Whether do_vanilla_connect keeps a pool's entrances vanilla (:1060-1086):
 * each condition named a setting that leaves the caves as they are.
 */
function keptVanilla(pool: ModePool, settings: DrPoolSettings): boolean {
  // `name in condition`: a substring of a string, a member of a list
  const condition = pool.condition ?? "";
  const has = (name: string) =>
    typeof condition === "string"
      ? condition.includes(name)
      : condition.some((c) => c === name);
  if (has("shopsanity") && settings.shopsanity) return false;
  if (has("pottery") && !["none", "keys", "dungeon"].includes(settings.pottery))
    return false;
  if (has("dropshuffle") && !["none", "keys"].includes(settings.dropShuffle))
    return false;
  if (
    has("enemy_drop") &&
    !["none", "keys"].includes(settings.dropShuffle) &&
    settings.enemyShuffle
  )
    return false;
  return true;
}

/** Skull Woods' doors and holes: options a run does not record move them. */
const SKULL = /^Skull Woods/;

/**
 * The entrances a shuffle may move, by DR's names: link_entrances_new's
 * pool (:45-80) less what it surely connects vanilla. Standard's escape and
 * Link's House (do_standard_connections, :416-422); Link's House without
 * shufflelinks and the Tavern's back without shuffletavern (do_links_house,
 * :551-560; :211-215); the caves a kept pool connects (do_vanilla_connect,
 * :1060-1086), but Skull Woods', which an earlier pool may have moved
 * (skullwoods); the Inverted world's fixed Bumper Cave (:1832-1836); and in a
 * mode that leaves the rest vanilla (`undefined`), every entrance no pool
 * names.
 */
export function drShuffled(
  shuffle: DrShuffle,
  settings: DrPoolSettings,
): ReadonlySet<string> {
  const inverted = settings.mode === "inverted";
  const maps = vanillaEntrances(inverted);
  const mode = MODES[shuffle];
  const pools = Object.values(mode.pools ?? {});
  const sub = (name: string) => (inverted ? (SUB_TABLE[name] ?? name) : name);
  const named = new Set(
    pools
      .filter((p) => p.special !== "vanilla")
      .flatMap(entrancesOf)
      .map(sub),
  );
  const moved = new Set(
    mode.undefined === "vanilla"
      ? maps.pool.filter((name) => named.has(name))
      : maps.pool,
  );
  for (const pool of pools) {
    if (pool.special === "vanilla" && keptVanilla(pool, settings))
      // The Inverted world trades the Dark Death Mountain fairy for
      // "Bumper Cave (top)", which no entrance is named (:1076-1079)
      for (const name of entrancesOf(pool).map(sub))
        if (
          !SKULL.test(name) &&
          !(inverted && name === "Dark Death Mountain Fairy")
        )
          moved.delete(name);
    if (pool.special === "inverted_fixed" && inverted && pool.entrance)
      moved.delete(pool.entrance);
  }
  const linksHouse = inverted ? "Big Bomb Shop" : "Links House";
  if (settings.mode === "standard")
    for (const name of [
      "Hyrule Castle Entrance (South)",
      "Hyrule Castle Secret Entrance Stairs",
      "Hyrule Castle Secret Entrance Drop",
      "Links House",
    ])
      moved.delete(name);
  if (!settings.shuffleLinks) moved.delete(linksHouse);
  if (!settings.shuffleTavern) moved.delete("Tavern North");
  return moved;
}

/** Whether a shuffle parts a door from its way back (insanity). */
export const drDecoupled = (shuffle: DrShuffle): boolean =>
  MODES[shuffle].decoupled === "on";

/**
 * The shuffles that place dungeons among dungeons alone, by their pools:
 * the single- and multi-entrance dungeons (simple, restricted,
 * dungeonssimple), or the dungeon pool and its connectors (dungeonsfull).
 */
function dungeonEntrances(shuffle: DrShuffle): ReadonlySet<string> {
  const pools = MODES[shuffle].pools ?? {};
  const found = new Set<string>();
  for (const name of [
    "single_entrance_dungeon",
    "multi_entrance_dungeon",
    "dungeon",
  ]) {
    const pool = pools[name];
    if (pool !== undefined) for (const e of entrancesOf(pool)) found.add(e);
  }
  return found;
}

/** A DR pool: the entrance randomizer's shape, and whether it is decoupled. */
export interface DrEntrancePool extends EntrancePool {
  /** Insanity: an exit leads back elsewhere than its door, unnoted. */
  readonly decoupled: boolean;
}

/**
 * What a DR shuffle may move, for a run: its entrances (`drShuffled`), each
 * with the targets it may lead to, among those the moved entrances lead to
 * in the vanilla world. A hole leads to a hole's drop; where a mode places
 * dungeons among dungeons, a dungeon's door to a dungeon's exit (Skull
 * Woods' doors among them) and any other door to the others; elsewhere any
 * door to any door's target. No note settles another (`partners` is
 * empty): the run does not record the options that tie a hole to its cave
 * (linked_drops) or Skull Woods' doors together (skullwoods).
 */
export function drEntrancePool(
  shuffle: DrShuffle,
  settings: DrPoolSettings,
): DrEntrancePool {
  const maps = vanillaEntrances(settings.mode === "inverted");
  const moved = drShuffled(shuffle, settings);
  const holes = new Set(
    [...moved].filter(
      (name) => DROP_MAP[name] !== undefined && maps.oneWay.get(name),
    ),
  );
  const dungeons = dungeonEntrances(shuffle);
  const apart = dungeons.size > 0;
  const groupOf = (name: string) =>
    holes.has(name)
      ? "hole"
      : apart && (dungeons.has(name) || SKULL.test(name))
        ? "dungeon"
        : "door";
  const targetsBy = new Map<string, EntranceTarget[]>();
  const entrances: OverworldEntrance[] = [];
  for (const name of maps.pool) {
    if (!moved.has(name)) continue;
    const target = vanillaTarget(maps, name);
    if (target === undefined) continue;
    entrances.push(drEntranceOf(name));
    const group = groupOf(name);
    targetsBy.set(group, [...(targetsBy.get(group) ?? []), drTargetOf(target)]);
  }
  // Doors first, then holes, as the entrance randomizer's pool lists them
  const holeIds = new Set([...holes].map((h) => drEntranceOf(h).id));
  entrances.sort(
    (a, b) => Number(holeIds.has(a.id)) - Number(holeIds.has(b.id)),
  );
  const nameOf = new Map(
    [...moved].map((name) => [drEntranceOf(name).id, name]),
  );
  const targetsOf = new Map(
    entrances.map((entrance) => [
      entrance.id,
      targetsBy.get(groupOf(nameOf.get(entrance.id) ?? "")) ?? [],
    ]),
  );
  return {
    decoupled: drDecoupled(shuffle),
    entrances,
    holeDoors: new Map(),
    partners: () => [],
    shuffle,
    targetsOf,
  };
}

/** Each entrance the pools may name, by the entrance randomizer's id. */
const DR_NAME_OF_ENTRANCE: ReadonlyMap<string, string> = new Map(
  [...vanillaEntrances(false).pool, ...vanillaEntrances(true).pool].map(
    (name) => [drEntranceOf(name).id, name],
  ),
);

/** Each target the pools may name, by the entrance randomizer's id. */
const DR_NAME_OF_TARGET: ReadonlyMap<string, string> = new Map(
  [false, true].flatMap((inverted) => {
    const maps = vanillaEntrances(inverted);
    return [...maps.twoWay.values(), ...maps.oneWay.values()].map(
      (name) => [drTargetOf(name).id, name] as const,
    );
  }),
);

/** DR's name of a noted entrance (an id), if a DR pool holds it. */
export const drEntranceName = (id: string): string | undefined =>
  DR_NAME_OF_ENTRANCE.get(id);

/** DR's name of a noted target (an id), if a DR pool holds it. */
export const drTargetName = (id: string): string | undefined =>
  DR_NAME_OF_TARGET.get(id);
