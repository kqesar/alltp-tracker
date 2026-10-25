#!/usr/bin/env node
// Writes the spoiler fixtures of test/spoilers/ from a seed on samus.link:
//
//   pnpm --filter @alltp/pack-smz3 spoiler-fixtures <guid | API JSON file>
//
// samus.link's seed page shows a spoiler log; its API answers
// `GET /api/spoiler/<guid>` with the JSON the page reads (no cookie, no key
// for a seed that is not a race's). The page's Download button turns that
// JSON into a YAML text file with `downloadSpoiler`
// (WebRandomizer/ClientApp/src/spoiler/Spoiler.jsx:92-121 at d53be76,
// tewtal/SMZ3Randomizer, MIT; the site's dependency is `yaml` ^1.10.2).
// This script runs that code over the same JSON, with `yaml` 1.10.3 and
// `indentSeq: false` as the page does, and writes both files. The YAML is
// therefore REBUILT, not downloaded from the button: say so wherever it is
// quoted (provenance.json beside the files does).
//
// The fixtures are written, never edited: `test/spoiler-fixtures.spec.ts`
// renders the YAML again from the JSON and fails on any difference.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

/**
 * region_ordering.js: the order the page lists the regions in.
 * @type {readonly string[]}
 */
export const REGION_ORDER = [
  "Light World Death Mountain West",
  "Light World Death Mountain East",
  "Light World North West",
  "Light World North East",
  "Light World South",
  "Hyrule Castle",
  "Dark World Death Mountain West",
  "Dark World Death Mountain East",
  "Dark World North West",
  "Dark World North East",
  "Dark World South",
  "Dark World Mire",
  "Castle Tower",
  "Eastern Palace",
  "Desert Palace",
  "Tower of Hera",
  "Palace of Darkness",
  "Swamp Palace",
  "Skull Woods",
  "Thieves' Town",
  "Ice Palace",
  "Misery Mire",
  "Turtle Rock",
  "Ganon's Tower",
  "Crateria West",
  "Crateria Central",
  "Crateria East",
  "Brinstar Blue",
  "Brinstar Green",
  "Brinstar Pink",
  "Brinstar Red",
  "Brinstar Kraid",
  "Wrecked Ship",
  "Maridia Outer",
  "Maridia Inner",
  "Norfair Upper West",
  "Norfair Upper East",
  "Norfair Upper Crocomire",
  "Norfair Lower West",
  "Norfair Lower East",
];

const API = "https://samus.link/api/spoiler/";

/** slugid's encoding of a guid: its 16 bytes in unpadded base64url. */
export function slug(/** @type {string} */ guid) {
  return Buffer.from(guid, "hex").toString("base64url");
}

/**
 * The page's `downloadSpoiler` for a single-player SMZ3 seed.
 * @param {any} api - The API's answer, parsed
 * @returns {string} The file's text
 */
export function renderDownload(api) {
  const { seed, locations } = api;
  const { settings, worldState } = seed.worlds[0];
  // toggleSpoiler: the page drops empty spheres and sorts by region
  const playthrough = JSON.parse(seed.spoiler).filter(
    (/** @type {object} */ sphere) => Object.keys(sphere).length > 0,
  );
  const sorted = [...locations].sort(
    (a, b) =>
      REGION_ORDER.indexOf(a.locationRegion) -
      REGION_ORDER.indexOf(b.locationRegion),
  );
  /** @type {Map<string, any[]>} */
  const groups = new Map();
  for (const location of sorted) {
    const group = groups.get(location.locationRegion) ?? [];
    group.push(location);
    groups.set(location.locationRegion, group);
  }
  const pick = (/** @type {any} */ from, /** @type {string[]} */ keys) =>
    Object.fromEntries(
      keys.filter((key) => from && key in from).map((key) => [key, from[key]]),
    );
  const state = JSON.parse(worldState);
  const content = [
    `${seed.gameId.toUpperCase()} ${seed.gameVersion} ${seed.hash}`,
    {
      Playthrough: playthrough
        .slice(0, -1)
        .map((/** @type {object} */ sphere, /** @type {number} */ i) => ({
          [`Sphere ${i + 1}`]: sphere,
        })),
    },
    { "Prizes and Requirements": playthrough.at(-1) },
    ...[...groups].map(([region, list]) => ({
      [region]: Object.fromEntries(
        list.map((l) => [l.locationName, l.itemName]),
      ),
    })),
    {
      Meta: {
        guid: seed.guid,
        ...pick(JSON.parse(settings), ["goal", "smlogic", "keyshuffle"]),
        ...pick(state, ["towerCrystals", "ganonCrystals", "tourianBossTokens"]),
        dropPrizes: pick(state.dropPrizes, [
          "treePulls",
          "crabContinous",
          "crabFinal",
          "stun",
        ]),
      },
    },
  ];
  return YAML.stringify(content, { indentSeq: false });
}

/** The name the page saves the download under. */
export function downloadName(/** @type {any} */ api) {
  const { seed } = api;
  return `${seed.gameName} v${seed.gameVersion} - ${slug(seed.guid)} - Spoiler.txt`;
}

/**
 * What is written beside the fixtures to say where they come from.
 * @param {any} api
 * @param {string} source
 */
export function provenance(api, source) {
  return {
    api: `${API}${api.seed.guid}`,
    downloadName: downloadName(api),
    guid: api.seed.guid,
    note: "The YAML was REBUILT from the API JSON with samus.link's own downloadSpoiler code, not downloaded from the site's Download button; the JSON is the API's answer as received.",
    renderedWith: "yaml@1.10.3, indentSeq: false",
    rendererSource:
      "tewtal/SMZ3Randomizer d53be76, WebRandomizer/ClientApp/src/spoiler/Spoiler.jsx:92-121",
    source,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: spoiler-fixtures.mjs <guid | API JSON file>");
    process.exit(1);
  }
  const isGuid = /^[0-9a-f]{32}$/.test(arg);
  const text = isGuid
    ? await (await fetch(`${API}${arg}`)).text()
    : readFileSync(arg, "utf8");
  const api = JSON.parse(text);
  const outDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../test/spoilers",
  );
  mkdirSync(outDir, { recursive: true });
  const name = slug(api.seed.guid);
  writeFileSync(join(outDir, `${name}.json`), text);
  writeFileSync(join(outDir, `${name}.txt`), renderDownload(api));
  writeFileSync(
    join(outDir, "provenance.json"),
    `${JSON.stringify(
      provenance(
        api,
        isGuid ? "fetched from the API" : "a saved copy of the API's answer",
      ),
      null,
      2,
    )}\n`,
  );
  console.log(`${name}: ${api.locations.length} locations`);
}
