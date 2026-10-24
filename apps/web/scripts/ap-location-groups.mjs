// Writes the location groups of Archipelago's Super Metroid and SMZ3 worlds,
// which name none of their own (AP gives them `Everywhere` alone), as data:
// apps/web/src/games/archipelago/worlds/{sm,smz3}-groups.json, a list of
// [group, locations] in the source's order. Read from an AP checkout at the
// release packages/archipelago/upstream.json pins:
// - Super Metroid: VARIA's graph areas, `GraphArea` of each location in
//   worlds/sm/variaRandomizer/graph/location.py, named in words;
// - SMZ3: TotalSMZ3's regions, each region's `Name` in
//   worlds/smz3/TotalSMZ3/Regions/, in World.py's order.
// Only the locations the pinned name data holds (the bosses carry no id).
// Usage: node apps/web/scripts/ap-location-groups.mjs <AP checkout>; then
// `pnpm lint:fix`. worlds/sm.spec.ts and smz3.spec.ts hold the output to the
// pinned name data.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const ap = process.argv[2];
if (ap === undefined) {
  console.error("Usage: ap-location-groups.mjs <AP checkout>");
  process.exit(2);
}
const out = join(root, "apps/web/src/games/archipelago/worlds");
const pinned = (file) =>
  new Set(
    Object.keys(
      JSON.parse(
        readFileSync(
          join(root, "packages/archipelago/test/datapackages", file),
          "utf8",
        ),
      ).location_name_to_id,
    ),
  );
/** A source file, without the byte order mark some of AP's carry. */
const read = (path) => readFileSync(join(ap, path), "utf8").replace(/^﻿/, "");

/** VARIA's graph areas, in words. */
const SM_AREAS = {
  Crateria: "Crateria and Blue Brinstar",
  Crocomire: "Crocomire's Lair",
  EastMaridia: "East Maridia",
  GreenPinkBrinstar: "Green and Pink Brinstar",
  Kraid: "Kraid's Lair",
  LowerNorfair: "Lower Norfair",
  Norfair: "Upper Norfair",
  RedBrinstar: "Red Brinstar",
  Tourian: "Tourian",
  WestMaridia: "West Maridia",
  WreckedShip: "Wrecked Ship",
};

/** Groups in first-seen order, only the pinned names, none left empty. */
const write = (file, entries, names) => {
  const groups = new Map();
  for (const [group, location] of entries) {
    if (!names.has(location)) continue;
    groups.set(group, [...(groups.get(group) ?? []), location]);
  }
  writeFileSync(join(out, file), `${JSON.stringify([...groups], null, 2)}\n`);
  console.log(`wrote ${file}: ${groups.size} groups`);
};

// Super Metroid
const sm = read("worlds/sm/variaRandomizer/graph/location.py");
write(
  "sm-groups.json",
  [...sm.matchAll(/GraphArea="([^"]+)",[\s\S]*?Name="([^"]+)"/g)].map(
    ([, area, name]) => {
      if (!(area in SM_AREAS)) throw new Error(`No words for ${area}`);
      return [SM_AREAS[area], name];
    },
  ),
  pinned("Super_Metroid.json"),
);

// SMZ3: World.py's regions in order, each class found through its import
// (`from .Regions.Zelda.LightWorld.South import South as LightWorldSouth`)
const world = read("worlds/smz3/TotalSMZ3/World.py");
const imports = new Map(
  [
    ...world.matchAll(/^from \.Regions\.([\w.]+) import (\w+)(?: as (\w+))?/gm),
  ].map(([, module, name, alias]) => [
    alias ?? name,
    {
      file: `worlds/smz3/TotalSMZ3/Regions/${module.replaceAll(".", "/")}.py`,
      name,
    },
  ]),
);
const order = world
  .slice(
    world.indexOf("self.Regions = ["),
    world.indexOf("self.Locations = []"),
  )
  .matchAll(/(\w+)\(self, self\.Config\)/g);
const entries = [];
for (const [, used] of order) {
  const found = imports.get(used);
  if (found === undefined) throw new Error(`No import of ${used}`);
  const cls = read(found.file)
    .split(/\nclass /)
    .find((text) => text.startsWith(`${found.name}(`));
  const name = cls?.match(/Name = "([^"]+)"/)?.[1];
  if (cls === undefined || name === undefined) {
    throw new Error(`No region ${found.name} in ${found.file}`);
  }
  for (const [, location] of cls.matchAll(/Location\(self,[^"]*?"([^"]+)"/g)) {
    entries.push([name, location]);
  }
}
write("smz3-groups.json", entries, pinned("SMZ3.json"));
