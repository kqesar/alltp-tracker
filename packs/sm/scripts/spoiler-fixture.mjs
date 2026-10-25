// Derives a Map Rando spoiler fixture from a real spoiler.json: the keys the
// pack reads (src/spoiler.ts `KEYS`), in the file's own order, and nothing
// else. The full file is 21 MB, nearly all of it sm-json-data copied into it
// (`game_data`), the routes (`details`) and the traversals; none of that is
// kept. Never edit the output by hand: run this again.
//
//   pnpm --filter @alltp/pack-sm spoiler-fixture <seed name | spoiler.json> [name]
//
// A seed name downloads https://maprando.com/seed/<name>/data/spoiler.json
// (the file itself names no seed, so the name is the fixture's); a path reads
// that file, and then `name` is required. Writes test/spoilers/<name>.json and
// <name>.provenance.json (where it came from, the source's SHA-256 and size).

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Keep in step with `KEYS` in src/spoiler.ts (spoiler.spec.ts holds them to it).
const KEYS = [
  "all_items",
  "missile_size",
  "objectives",
  "powerbomb_size",
  "start_location",
  "summary",
  "super_size",
];

const [source, nameArg] = process.argv.slice(2);
if (!source) {
  console.error("usage: spoiler-fixture <seed name | spoiler.json> [name]");
  process.exit(2);
}

const isFile = source.includes("/") || source.endsWith(".json");
let bytes;
let from;
let name;
if (isFile) {
  if (!nameArg) {
    console.error(
      "a file needs the fixture's name: spoiler-fixture <file> <name>",
    );
    process.exit(2);
  }
  bytes = readFileSync(source);
  from = `file ${basename(source)}`;
  name = nameArg;
} else {
  if (!/^[A-Za-z0-9_-]{1,15}$/.test(source)) {
    console.error("not a seed name");
    process.exit(2);
  }
  const url = `https://maprando.com/seed/${source}/data/spoiler.json`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`${url}: HTTP ${response.status}`);
    process.exit(1);
  }
  bytes = Buffer.from(await response.arrayBuffer());
  from = url;
  name = nameArg ?? source;
}
if (!/^[A-Za-z0-9_-]+$/.test(name)) {
  console.error("the fixture's name is letters, digits, - and _");
  process.exit(2);
}

const whole = JSON.parse(bytes.toString("utf8"));
const kept = {};
for (const key of Object.keys(whole)) {
  if (KEYS.includes(key)) kept[key] = whole[key];
}
for (const key of KEYS) {
  if (!(key in kept)) {
    console.error(`the file has no "${key}"`);
    process.exit(1);
  }
}

const directory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../test/spoilers",
);
mkdirSync(directory, { recursive: true });
const text = `${JSON.stringify(kept)}\n`;
writeFileSync(join(directory, `${name}.json`), text);
writeFileSync(
  join(directory, `${name}.provenance.json`),
  `${JSON.stringify(
    {
      keptBytes: Buffer.byteLength(text),
      keys: Object.keys(kept),
      source: from,
      sourceBytes: bytes.length,
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    },
    null,
    2,
  )}\n`,
);
console.log(
  `${name}: ${Buffer.byteLength(text)} of ${bytes.length} bytes kept`,
);
