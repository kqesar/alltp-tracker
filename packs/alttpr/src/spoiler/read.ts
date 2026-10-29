// A spoiler document, vt's, the entrance randomizer's or the Door
// Randomizer's, as the @alltp/spoiler model. The shapes differ in how they
// write a name, an item, the playthrough, `Special`, the settings and the
// starting items (vt.ts, er.ts, dr.ts); everything after that is shared.

import {
  accept,
  type Placement,
  refuse,
  type SpoilerLog,
  type SpoilerResult,
} from "@alltp/spoiler";
import * as z from "zod/mini";
import type { SeedSettingsReading } from "../autotrack/seed-settings";
import { DUNGEONS } from "../dungeons";
import { fromUpstream } from "../items";
import { MEDALLIONS, type Medallion } from "../medallions";
import { metaReading } from "../seed-file";
import type { DoorSpoilerFacts } from "./dr";
import { knownLocationIds } from "./known";

/** What the spoiler says of an item it names. */
export type ItemRead =
  /**
   * An item of the pack's: its vt class and its English name. The class is
   * null for an item vt has none for (the Door Randomizer's Fairy, Big
   * Magic…), shown by name only.
   */
  | {
      readonly kind: "item";
      readonly class: string | null;
      readonly name: string;
    }
  /** An event (`Beat Agahnim 1`): no item, skipped. */
  | { readonly kind: "event" }
  /** An item no table of the pack has: a newer randomizer's. */
  | { readonly kind: "unknown" }
  /** Another world's item: a multiworld. */
  | { readonly kind: "world" };

/** How one of the two layouts writes what the shared reading needs. */
export interface Shape {
  readonly format: "vt" | "er" | "dr";
  /** The top-level keys that are no list of locations. */
  readonly reserved: ReadonlySet<string>;
  /** Every location id a name of the log may resolve to. */
  readonly known: () => ReadonlySet<string>;
  /** A section's key -> `Placement.area`, or null when it means nothing. */
  readonly area: (section: string) => string | null;
  /** A location as written -> its name; null when it is another world's. */
  readonly name: (written: string) => string | null;
  /** A location's name -> the pack's id. */
  readonly id: (name: string) => string;
  readonly item: (written: string) => ItemRead;
  /** An item as written -> its English name, for a list of names. */
  readonly describeItem: (written: string) => string;
  /** The playthrough's (sphere, location as written) pairs; null if malformed. */
  readonly playthrough: (
    value: unknown,
  ) => readonly (readonly [number, string])[] | null;
  /** A shop's item (any shape of value) as a name and a price; null if malformed. */
  readonly shopItem: (
    value: unknown,
  ) => { readonly name: string; readonly price: number | null } | null;
  /**
   * `Special`: the two medallions' names in lower case, and the entries
   * that are locations of the pack (vt's bottles and medallions), as written.
   */
  readonly special: (special: Readonly<Record<string, string>>) => {
    readonly medallions: {
      readonly mire: string | null;
      readonly turtleRock: string | null;
    };
    readonly placements: readonly (readonly [string, string])[];
  };
  /** The settings the document's `meta` states, for the seed id given. */
  readonly settings: (
    meta: unknown,
    seed: string | null,
  ) => SeedSettingsReading | null;
  /** The starting items, as written. */
  readonly start: (doc: Readonly<Record<string, unknown>>) => string[];
}

/** A shop of the seed and what it sells. */
export interface SpoilerShop {
  readonly location: string;
  readonly type: string;
  readonly items: readonly {
    readonly name: string;
    readonly price: number | null;
  }[];
}

/** What an ALttPR log holds beyond placements: `SpoilerLog.extra`. */
export interface AlttprSpoilerExtra {
  /**
   * The seed's settings as its `meta` states them, read as a seed file's is
   * (seed-file.ts): null when the `meta` is not vt's.
   */
  readonly settings: SeedSettingsReading | null;
  /** The medallions Misery Mire and Turtle Rock ask for. */
  readonly medallions: {
    readonly mire: Medallion | null;
    readonly turtleRock: Medallion | null;
  };
  /** The prize each dungeon holds: its id -> the pack's item id (`crystal6`). */
  readonly prizes: Readonly<Record<string, string>>;
  /** Each dungeon's boss, when the seed shuffles them; else null. */
  readonly bosses: Readonly<Record<string, string>> | null;
  readonly shops: readonly SpoilerShop[];
  /** A Door Randomizer log's own facts (dr.ts); absent from alttpr.com's. */
  readonly door?: DoorSpoilerFacts;
}

export type AlttprSpoilerLog = SpoilerLog<AlttprSpoilerExtra>;

/** The top-level keys that are not a list of locations. */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  "Bosses",
  "Entrances",
  "Equipped",
  "meta",
  "paths",
  "playthrough",
  "Shops",
  "Special",
]);

/** Unknown locations a log may hold before it is a newer randomizer's. */
export const MAX_UNKNOWN_LOCATIONS = 4;

const STRINGS = z.record(z.string(), z.string());
const SHOPS = z.catch(
  z.array(z.looseObject({ location: z.string(), type: z.string() })),
  [],
);
const ITEM_KEY = /^item_(\d+)$/;

/** The sections of locations a document holds, with the key naming each. */
export function sectionsOf(
  doc: Readonly<Record<string, unknown>>,
  reserved: ReadonlySet<string> = RESERVED_KEYS,
): [string, Record<string, string>][] {
  const sections: [string, Record<string, string>][] = [];
  for (const [key, value] of Object.entries(doc)) {
    if (reserved.has(key)) continue;
    const parsed = STRINGS.safeParse(value);
    if (parsed.success) sections.push([key, parsed.data]);
  }
  return sections;
}

const medallionOf = (word: string | null): Medallion | null =>
  MEDALLIONS.find((medallion) => medallion === word) ?? null;

export const stringsOf = (value: unknown): Record<string, string> | null => {
  const parsed = STRINGS.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/**
 * A document's log. `meta` is the document's, already checked to be an
 * object; `bossShuffle` says whether `Bosses` is worth keeping.
 */
export function readLog(
  doc: Readonly<Record<string, unknown>>,
  shape: Shape,
  seed: AlttprSpoilerLog["seed"],
  bossShuffle: boolean,
): SpoilerResult<AlttprSpoilerLog> {
  const special = shape.special(stringsOf(doc.Special) ?? {});
  const rows: { area: string | null; item: string; location: string }[] = [
    ...sectionsOf(doc, shape.reserved).flatMap(([area, section]) =>
      Object.entries(section).map(([location, item]) => ({
        area: shape.area(area),
        item,
        location,
      })),
    ),
    ...special.placements.map(([location, item]) => ({
      area: "Special",
      item,
      location,
    })),
  ];

  const known = shape.known();
  const placements: Omit<Placement, "sphere">[] = [];
  const skipped: string[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = shape.name(row.location);
    const item = shape.item(row.item);
    if (name === null || item.kind === "world") {
      return refuse("unsupported", "multiworld");
    }
    if (item.kind === "event") {
      skipped.push(name);
      continue;
    }
    if (item.kind === "unknown") return refuse("newer-version", row.item);
    const id = shape.id(name);
    if (!known.has(id)) {
      unknown.push(name);
      continue;
    }
    if (seen.has(id)) return refuse("not-a-spoiler", `twice: ${name}`);
    seen.add(id);
    placements.push({
      area: row.area,
      item:
        item.class === null ? null : (fromUpstream(item.class)?.item ?? null),
      itemName: item.name,
      location: id,
      locationName: name,
    });
  }
  if (unknown.length > MAX_UNKNOWN_LOCATIONS) {
    return refuse("newer-version", unknown[0]);
  }
  skipped.push(...unknown);
  if (placements.length === 0) return refuse("not-a-spoiler", "no locations");

  // The playthrough only says in which sphere a location sits
  const sphereOf = new Map<string, number>();
  let spheres = 0;
  if (doc.playthrough !== undefined) {
    const entries = shape.playthrough(doc.playthrough);
    if (entries === null) return refuse("not-a-spoiler", "playthrough");
    for (const [sphere, written] of entries) {
      const name = shape.name(written);
      if (name === null) return refuse("unsupported", "multiworld");
      const id = shape.id(name);
      sphereOf.set(id, Math.min(sphereOf.get(id) ?? sphere, sphere));
      spheres = Math.max(spheres, sphere);
    }
  }

  const prizes: Record<string, string> = {};
  for (const dungeon of DUNGEONS) {
    // Zelda's and Agahnim's prizes are events, which a spoiler leaves out
    const prize = placements.find((p) => p.location === `${dungeon.id}/prize`);
    if (prize?.item != null) prizes[dungeon.id] = prize.item;
  }

  const bosses = bossShuffle ? stringsOf(doc.Bosses) : null;
  const shops = SHOPS.parse(doc.Shops).flatMap((shop) => {
    const items = Object.entries(shop)
      .flatMap(([key, value]) => {
        const at = ITEM_KEY.exec(key)?.[1];
        const sold = at === undefined ? null : shape.shopItem(value);
        return sold === null || at === undefined
          ? []
          : [{ at: Number(at), ...sold }];
      })
      .sort((a, b) => a.at - b.at)
      .map(({ name, price }) => ({ name, price }));
    return [{ items, location: shop.location, type: shop.type }];
  });

  return accept({
    extra: {
      bosses,
      medallions: {
        mire: medallionOf(special.medallions.mire),
        turtleRock: medallionOf(special.medallions.turtleRock),
      },
      prizes,
      settings: shape.settings(doc.meta, seed.id),
      shops,
    },
    format: shape.format,
    game: "alttpr",
    placements: placements.map((p) => ({
      ...p,
      sphere: sphereOf.get(p.location) ?? null,
    })),
    seed,
    skipped,
    spheres,
    start: shape.start(doc).map(shape.describeItem),
  });
}

/** What vt's and the entrance randomizer's logs share: alttpr.com's own. */
export const ALTTPR_COM: Pick<
  Shape,
  "known" | "reserved" | "settings" | "start"
> = {
  known: knownLocationIds,
  reserved: RESERVED_KEYS,
  settings: metaReading,
  start: (doc) => Object.values(stringsOf(doc.Equipped) ?? {}),
};
