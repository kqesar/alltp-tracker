// samus.link's two spoiler layouts as one document.
//
// Its seed page fetches `GET /api/spoiler/<guid>` (SpoilerController.cs) and
// either shows it or, with Download, turns it into a YAML text file
// (`downloadSpoiler`, WebRandomizer/ClientApp/src/spoiler/Spoiler.jsx:92-121
// at d53be76, tewtal/SMZ3Randomizer). Both carry the same facts:
//
// - the title: `<GAME> <version> <four words>`; the API keeps them as
//   `gameId`, `gameVersion` and `hash`;
// - the playthrough: spheres of `location: item`, the progression only
//   (Playthrough.cs), empty spheres dropped by the page (the API keeps
//   them); the API's last element is the prizes (Playthrough.cs:65-76),
//   which the YAML names `Prizes and Requirements`;
// - every location and what it held, grouped by region;
// - the seed's guid and settings (Meta).
//
// Validation is zod/mini's, once, at this boundary: what comes out is typed
// and the rest of the parser trusts it. Zod is the spoiler parser's alone.

import { accept, refuse, type SpoilerResult } from "@alltp/spoiler";
import * as z from "zod/mini";
import { DEFAULT_SETTINGS } from "../settings";

/** `location: item` (or `Prize - area: reward`), as the log writes them. */
export type Names = Readonly<Record<string, string>>;

export interface Meta {
  readonly guid: string;
  readonly goal: string;
  readonly smlogic: "normal" | "hard";
  readonly keyshuffle: "none" | "keysanity";
  readonly towerCrystals: number;
  readonly ganonCrystals: number;
  readonly tourianBossTokens: number;
}

export interface Document {
  readonly version: string;
  readonly hash: string;
  /** The playthrough's spheres, empty ones dropped: index + 1 is the sphere. */
  readonly spheres: readonly Names[];
  readonly prizes: Names;
  readonly regions: readonly {
    readonly name: string;
    readonly locations: Names;
  }[];
  readonly meta: Meta;
}

const NAMES = z.record(z.string(), z.string());

// A count is YAML text in the Download and a JSON number in the API
const COUNT = z.optional(z.union([z.number(), z.string()]));

// Config.cs:25-30 (SMLogic) and :63-68 (KeyShuffle), lowercased as the site's
// options write them (RandomizerOptions.cs `ToLowerString`)
const META = z.object({
  ganonCrystals: COUNT,
  goal: z.string(),
  guid: z.string().check(z.regex(/^[0-9a-f]{32}$/i)),
  keyshuffle: z.enum(["none", "keysanity"]),
  smlogic: z.enum(["normal", "hard"]),
  tourianBossTokens: COUNT,
  towerCrystals: COUNT,
});

const SINGLE = z.record(z.string(), z.unknown());

/** An integer from 0 to `max`, from a YAML string or a JSON number. */
function count(
  value: string | number | undefined,
  fallback: number,
  max: number,
): number | null {
  if (value === undefined) return fallback;
  if (typeof value === "string" && !/^\d{1,2}$/.test(value)) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

/** The Meta block, checked. Missing counts are samus.link's defaults. */
function readMeta(raw: unknown): SpoilerResult<Meta> {
  const parsed = z.safeParse(META, raw);
  if (!parsed.success) return refuse("not-a-spoiler", "Meta block");
  const m = parsed.data;
  const towerCrystals = count(
    m.towerCrystals,
    DEFAULT_SETTINGS.towerCrystals,
    7,
  );
  const ganonCrystals = count(
    m.ganonCrystals,
    DEFAULT_SETTINGS.ganonCrystals,
    7,
  );
  const tourianBossTokens = count(
    m.tourianBossTokens,
    DEFAULT_SETTINGS.tourianBosses,
    4,
  );
  if (
    towerCrystals === null ||
    ganonCrystals === null ||
    tourianBossTokens === null
  ) {
    return refuse("not-a-spoiler", "Meta counts");
  }
  return accept({
    ganonCrystals,
    goal: m.goal,
    guid: m.guid.toLowerCase(),
    keyshuffle: m.keyshuffle,
    smlogic: m.smlogic,
    tourianBossTokens,
    towerCrystals,
  });
}

const TITLE = /^(SMZ3|SM) (\d+(?:\.\d+)*) (\S.*)$/;

/**
 * The Download file, read as plain data by `readYaml`: a sequence whose first
 * item is the title and whose others are one-key maps (Playthrough, Prizes
 * and Requirements, a region each, Meta).
 */
export function fromYaml(root: unknown): SpoilerResult<Document> {
  if (!Array.isArray(root)) {
    // The server's own `?yaml=true` text is a map (`Game:`, `Meta:`,
    // `Regions:`): another layout, which no button of the site saves
    return refuse(
      typeof root === "object" && root !== null && "Game" in root
        ? "unsupported"
        : "not-a-spoiler",
      "samus.link's server YAML layout",
    );
  }
  const [title, ...sections] = root as unknown[];
  const head = typeof title === "string" ? TITLE.exec(title) : null;
  if (head === null) return refuse("not-a-spoiler", "title line");
  if (head[1] !== "SMZ3") return refuse("unsupported", "Super Metroid alone");
  let spheres: Names[] | null = null;
  let prizes: Names | null = null;
  let meta: unknown;
  const regions: { name: string; locations: Names }[] = [];
  for (const section of sections) {
    const single = z.safeParse(SINGLE, section);
    const entries = single.success ? Object.entries(single.data) : [];
    if (entries.length !== 1) return refuse("not-a-spoiler", "section");
    const [[name, body]] = entries as [[string, unknown]];
    if (name === "Playthrough") {
      const list = z.safeParse(z.array(SINGLE), body);
      if (!list.success) return refuse("not-a-spoiler", "Playthrough");
      spheres = [];
      for (const sphere of list.data) {
        const names = z.safeParse(
          NAMES,
          Object.values(sphere).length === 1 ? Object.values(sphere)[0] : null,
        );
        if (!names.success) return refuse("not-a-spoiler", "a sphere");
        spheres.push(names.data);
      }
    } else if (name === "Meta") {
      meta = body;
    } else {
      const names = z.safeParse(NAMES, body);
      if (!names.success) return refuse("not-a-spoiler", name);
      if (name === "Prizes and Requirements") prizes = names.data;
      else regions.push({ locations: names.data, name });
    }
  }
  if (spheres === null) return refuse("not-a-spoiler", "no Playthrough");
  if (prizes === null) return refuse("not-a-spoiler", "no prizes");
  if (meta === undefined) return refuse("not-a-spoiler", "no Meta");
  const read = readMeta(meta);
  if (!read.ok) return read;
  return accept({
    hash: head[3],
    meta: read.value,
    prizes,
    regions,
    spheres,
    version: head[2],
  });
}

const API = z.object({
  locations: z.array(
    z.object({
      itemName: z.string(),
      locationName: z.string(),
      locationRegion: z.string(),
    }),
  ),
  seed: z.object({
    gameId: z.string(),
    gameVersion: z.string(),
    guid: z.string(),
    hash: z.string(),
    players: z.optional(z.number()),
    spoiler: z.string(),
    worlds: z.array(z.object({ settings: z.string(), worldState: z.string() })),
  }),
});

/** JSON inside a JSON string field (the API nests several), or undefined. */
function nested(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The API's answer, parsed (`JSON.parse` by the caller): `/api/spoiler/<guid>`. */
export function fromApi(root: unknown): SpoilerResult<Document> {
  const api = z.safeParse(API, root);
  if (!api.success) return refuse("not-a-spoiler", "samus.link API shape");
  const { locations, seed } = api.data;
  // The title's game sits after the spoiler text, past `sniffSpoiler`'s head
  if (seed.gameId !== "smz3")
    return refuse("unsupported", "Super Metroid alone");
  if ((seed.players ?? 1) > 1 || seed.worlds.length > 1) {
    return refuse("unsupported", "multiworld");
  }
  const [world] = seed.worlds;
  const list = z.safeParse(z.array(NAMES), nested(seed.spoiler));
  const settings = z.safeParse(SINGLE, nested(world?.settings ?? ""));
  const state = z.safeParse(SINGLE, nested(world?.worldState ?? ""));
  if (
    !list.success ||
    list.data.length < 1 ||
    !settings.success ||
    !state.success
  ) {
    return refuse("not-a-spoiler", "spoiler or settings");
  }
  const meta = readMeta({
    ganonCrystals: state.data.ganonCrystals,
    goal: settings.data.goal,
    guid: seed.guid,
    keyshuffle: settings.data.keyshuffle,
    smlogic: settings.data.smlogic,
    tourianBossTokens: state.data.tourianBossTokens,
    towerCrystals: state.data.towerCrystals,
  });
  if (!meta.ok) return meta;
  // Entries, not an object: a location named `__proto__` is data
  const regions = new Map<string, [string, string][]>();
  const listed = new Set<string>();
  for (const { itemName, locationName, locationRegion } of locations) {
    // `Object.fromEntries` below would keep the last of two
    if (listed.has(locationName)) {
      return refuse("not-a-spoiler", `${locationName} twice`);
    }
    listed.add(locationName);
    const group = regions.get(locationRegion) ?? [];
    group.push([locationName, itemName]);
    regions.set(locationRegion, group);
  }
  return accept({
    hash: seed.hash,
    meta: meta.value,
    prizes: list.data[list.data.length - 1] ?? {},
    regions: [...regions].map(([name, found]) => ({
      locations: Object.fromEntries(found),
      name,
    })),
    spheres: list.data.slice(0, -1).filter((s) => Object.keys(s).length > 0),
    version: seed.gameVersion,
  });
}
