// samus.link's spoiler log as a `SpoilerLog` (@alltp/spoiler).
//
// Two files hold it: the YAML text the seed page's Download button saves, and
// the JSON of `/api/spoiler/<guid>` the page reads (a player may have saved
// that instead). `document.ts` turns either into one document; this module
// maps its names to the pack's ids and answers the model.
//
// Names are the identity in the log (it holds no location or item id): a
// location by its upstream name, which is what `locationId` slugs (316 of
// them, the same set as the pack's, held by `parse.spec.ts`), an item by its
// description in Item.cs's `ItemType` (`item-types.json`, written by the
// importer), then `fromUpstream` for the pack's item. An item the pack has no
// id for (rupees, arrows, the maps and compasses...) keeps `item: null`; a
// name the tables do not know is skipped and listed, and a file with too many
// of those is a newer samus.link's (`newer-version`).
//
// The parser is pure and never throws on its input. It imports js-yaml (via
// `yaml.ts`) and zod: the app loads this module only when a player imports a
// spoiler log.

import {
  accept,
  checkSize,
  type Placement,
  refuse,
  SNIFF_HEAD_LENGTH,
  type SpoilerLog,
  type SpoilerResult,
  sniffSpoiler,
} from "@alltp/spoiler";
import { fromUpstream } from "../items";
import { MEDALLIONS, type Medallion, type Pad } from "../medallions";
import { REGION_MODULES } from "../regions";
import type { Smz3Settings } from "../settings";
import { type Document, fromApi, fromYaml } from "./document";
import ITEM_TYPES from "./item-types.json";
import { readYaml } from "./yaml";

/** What a samus.link log states beyond the placements. */
export interface Smz3SpoilerExtra {
  /** The seed's guid, 32 lowercase hex digits: the seed page's address. */
  readonly guid: string;
  /** samus.link's version, "11.3.2". */
  readonly version: string;
  /** The four words of the seed's hash, as the seed page and the title screen show them. */
  readonly hash: string;
  /** Config.cs's goal, lowercased: "defeatboth"... */
  readonly goal: string;
  readonly settings: Smz3Settings;
  /** The reward each prize area holds, as a pack item id (`pendantGreen`, `crystalRed`, `tokenKraid`...), by the area's name. */
  readonly prizes: Readonly<Record<string, string>>;
  /** The medallion each pad wants. */
  readonly medallions: Readonly<Record<Pad, Medallion>>;
}

/**
 * Past this many names the pack does not know, a file is another version's.
 * One or two are a location or an item a patch added.
 */
const MAX_UNKNOWN = 5;

/**
 * Region.cs:10-36 (`RewardType`'s descriptions), as the pack's items: the
 * rewards are counted as found (items.ts), whatever boss holds them.
 */
export const REWARDS: Readonly<Record<string, string>> = {
  "Blue Crystal": "crystalBlue",
  "Blue/Red Pendant": "pendantNonGreen",
  "Draygon Boss Token": "tokenDraygon",
  "Green Pendant": "pendantGreen",
  "Kraid Boss Token": "tokenKraid",
  "Phantoon Boss Token": "tokenPhantoon",
  "Red Crystal": "crystalRed",
  "Ridley Boss Token": "tokenRidley",
};

/** The pads that want a medallion: the region's name in Playthrough.cs. */
const PADS: Readonly<Record<string, Pad>> = {
  "Misery Mire": "mire",
  "Turtle Rock": "turtleRock",
};

let locationIds: ReadonlyMap<string, string> | undefined;

/** The pack's location id for each upstream name. */
function locations(): ReadonlyMap<string, string> {
  locationIds ??= new Map(
    REGION_MODULES.flatMap(({ region }) =>
      region.locations.map(({ id, name }): [string, string] => [name, id]),
    ),
  );
  return locationIds;
}

const ITEM_TYPE_OF: ReadonlyMap<string, string> = new Map(
  Object.entries(ITEM_TYPES.items),
);

/**
 * A file with many names the pack does not know, most of them a known name
 * with ` - <player>` after it, is a multiworld's (Spoiler.jsx
 * writes `name - player`).
 */
function isMultiworld(unknownLocations: readonly string[]): boolean {
  const known = locations();
  const stripped = unknownLocations.filter((name) => {
    const at = name.lastIndexOf(" - ");
    return at > 0 && known.has(name.slice(0, at));
  });
  return (
    unknownLocations.length > 0 &&
    stripped.length * 2 >= unknownLocations.length
  );
}

function build(
  doc: Document,
  format: "smz3-yaml" | "smz3-api",
): SpoilerResult<SpoilerLog<Smz3SpoilerExtra>> {
  const known = locations();
  const unknown = new Set<string>();
  const unknownLocations = new Set<string>();

  const sphereOf = new Map<string, number>();
  doc.spheres.forEach((sphere, i) => {
    for (const name of Object.keys(sphere)) sphereOf.set(name, i + 1);
  });

  const placements: Placement[] = [];
  const seen = new Set<string>();
  for (const { name: area, locations: found } of doc.regions) {
    for (const [locationName, itemName] of Object.entries(found)) {
      const location = known.get(locationName);
      if (location === undefined) {
        unknownLocations.add(locationName);
        continue;
      }
      if (seen.has(location)) {
        return refuse("not-a-spoiler", `${locationName} twice`);
      }
      seen.add(location);
      const type = ITEM_TYPE_OF.get(itemName);
      if (type === undefined) unknown.add(itemName);
      placements.push({
        area,
        item: type === undefined ? null : (fromUpstream(type) ?? null),
        itemName,
        location,
        locationName,
        sphere: sphereOf.get(locationName) ?? null,
      });
    }
  }
  // A playthrough location the regions do not list is just as unknown
  for (const name of sphereOf.keys()) {
    if (!known.has(name)) unknownLocations.add(name);
  }

  const prizes: [string, string][] = [];
  const medallions: Partial<Record<Pad, Medallion>> = {};
  for (const [key, value] of Object.entries(doc.prizes)) {
    const prize = /^Prize - (.+)$/.exec(key);
    const pad = /^Medallion Required - (.+)$/.exec(key);
    const reward =
      prize !== null && Object.hasOwn(REWARDS, value)
        ? REWARDS[value]
        : undefined;
    if (prize !== null && reward !== undefined) {
      prizes.push([prize[1] ?? "", reward]);
    } else if (pad !== null && Object.hasOwn(PADS, pad[1] ?? "")) {
      const medallion = value.toLowerCase();
      if (!(MEDALLIONS as readonly string[]).includes(medallion)) {
        return refuse("not-a-spoiler", "medallion");
      }
      medallions[PADS[pad[1] ?? ""] as Pad] = medallion as Medallion;
    } else {
      unknown.add(key);
    }
  }

  if (unknownLocations.size + unknown.size > MAX_UNKNOWN) {
    return isMultiworld([...unknownLocations])
      ? refuse("unsupported", "multiworld")
      : refuse(
          "newer-version",
          `${unknownLocations.size + unknown.size} names unknown`,
        );
  }
  if (placements.length === 0) return refuse("not-a-spoiler", "no locations");
  if (medallions.mire === undefined || medallions.turtleRock === undefined) {
    return refuse("not-a-spoiler", "medallions");
  }

  // The pack's order, whichever order the file lists its locations in (the
  // API's is by location number, the Download's by region)
  const rank = new Map([...known.values()].map((id, i) => [id, i]));
  placements.sort(
    (a, b) => (rank.get(a.location) ?? 0) - (rank.get(b.location) ?? 0),
  );

  const { meta } = doc;
  return accept({
    extra: {
      goal: meta.goal,
      guid: meta.guid,
      hash: doc.hash,
      medallions: { mire: medallions.mire, turtleRock: medallions.turtleRock },
      prizes: Object.fromEntries(prizes),
      settings: {
        ganonCrystals: meta.ganonCrystals,
        keysanity: meta.keyshuffle === "keysanity",
        smLogic: meta.smlogic,
        tourianBosses: meta.tourianBossTokens,
        towerCrystals: meta.towerCrystals,
      },
      version: doc.version,
    },
    format,
    game: "smz3",
    placements,
    seed: { from: "content", id: meta.guid },
    skipped: [...unknownLocations, ...unknown],
    spheres: doc.spheres.length,
    start: [],
  });
}

/**
 * Reads a samus.link spoiler log: the Download's YAML or the API's JSON.
 *
 * Refuses, with the package's codes: a file over 1 MiB (`too-large`); another
 * randomizer's (`other-game`); a Super Metroid-only samus.link file,
 * Archipelago's, a multiworld, the server's own YAML layout (`unsupported`);
 * names it does not know (`newer-version`); anything else that is not a log
 * (`not-a-spoiler`). Never throws.
 *
 * @param text - The file's text
 * @param fileName - Its name, which helps tell a ROM or another game's log
 */
export function parseSpoiler(
  text: string,
  fileName = "",
): SpoilerResult<SpoilerLog<Smz3SpoilerExtra>> {
  const size = checkSize("smz3", text.length);
  if (size !== null) return size;
  const sniffed = sniffSpoiler(text.slice(0, SNIFF_HEAD_LENGTH), fileName);
  if (!sniffed.known) {
    return sniffed.what === "archipelago" || sniffed.what === "smz3-sm"
      ? refuse(
          "unsupported",
          sniffed.what === "smz3-sm" ? "Super Metroid alone" : "Archipelago",
        )
      : refuse("not-a-spoiler");
  }
  if (sniffed.game !== "smz3") return refuse("other-game", sniffed.game);
  if (sniffed.format === "smz3-api") {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return refuse("not-a-spoiler", "invalid JSON");
    }
    const doc = fromApi(json);
    return doc.ok ? build(doc.value, "smz3-api") : doc;
  }
  const yaml = readYaml(text);
  if (!yaml.ok) return yaml;
  const doc = fromYaml(yaml.value);
  return doc.ok ? build(doc.value, "smz3-yaml") : doc;
}
