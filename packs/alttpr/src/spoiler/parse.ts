// Reads the spoiler log alttpr.com lets a player save after a seed: the "Save
// Spoiler" button writes `JSON.stringify(spoiler, null, 4)` to a `.txt`
// named `alttpr - <logic>-<mode>-<goal>_<hash>.txt`
// (resources/js/rom.js:576-594, HashLoader.vue:199-204 at 219fcafd). The seed
// file the site keeps on S3 (`{ hash, spoiler, … }`, seed-file.ts) holds the
// same object, and is read too.
//
// Two layouts come out of it (vt.ts, er.ts), both into the @alltp/spoiler
// model. The hash is nowhere in the spoiler itself: only the S3 file has it,
// as `hash`, and a saved log only in its name, which a player may rename.
//
// Nothing here throws on the file: every reason not to show it is a
// refusal with a code of @alltp/spoiler.

import {
  checkSize,
  type Fact,
  type FactValue,
  refuse,
  SNIFF_HEAD_LENGTH,
  type SpoilerResult,
  sniffSpoiler,
} from "@alltp/spoiler";
import * as z from "zod/mini";
import { SEED_HASH } from "../seed-link";
import { isDoorDocument, parseDoorLog } from "./dr";
import { ER } from "./er";
import { type AlttprSpoilerLog, readLog, sectionsOf } from "./read";
import { VT } from "./vt";

const DOCUMENT = z.record(z.string(), z.unknown());
const SEED_FILE = z.object({
  hash: z.string(),
  spoiler: DOCUMENT,
});
const META = z.looseObject({
  "enemizer.boss_shuffle": z.catch(z.optional(z.string()), undefined),
  players: z.catch(z.optional(z.number()), undefined),
  spoilers: z.catch(z.optional(z.string()), undefined),
  worlds: z.catch(z.optional(z.number()), undefined),
});

/**
 * `…_<hash>.txt` in a saved log's name, which a browser may have written as
 * `…_<hash> (1).txt` when the file existed.
 */
const NAME_HASH = /_([^_.()\s]+)(?: \(\d+\))?\.(?:txt|json)$/i;

/** The seed's hash in a file's name, or null. */
export function hashInName(fileName: string): string | null {
  const hash = NAME_HASH.exec(fileName)?.[1];
  return hash !== undefined && SEED_HASH.test(hash) ? hash : null;
}

/**
 * Reads the text of a spoiler log, saved by alttpr.com or the seed file S3
 * keeps, or written by the Door Randomizer (text or JSON, dr.ts), into the
 * model.
 *
 * Refuses, with the code of @alltp/spoiler: a file over the size bound
 * (`too-large`); a ROM, a binary or anything that is not a JSON object with
 * a `meta` (`not-a-spoiler`); another randomizer's log (`other-game`) or one
 * the tracker does not read (`unsupported`: Archipelago, samus.link's Super
 * Metroid, a multiworld); a log alttpr.com withheld, where a race or a
 * mystery seed keeps only its `meta` (`stripped`, the `detail` being
 * `spoilers`' value); an item no table of the pack has, or many unknown
 * locations (`newer-version`).
 *
 * A spoiler race's log (placements, no playthrough) is accepted with
 * `spheres` 0.
 *
 * @param text - The file, decoded: untrusted
 * @param fileName - Its name, which holds the seed's hash when the file does not
 */
export function parseSpoiler(
  text: string,
  fileName = "",
): SpoilerResult<AlttprSpoilerLog> {
  const tooLarge = checkSize("alttpr", text.length);
  if (tooLarge !== null) return tooLarge;
  const sniffed = sniffSpoiler(text.slice(0, SNIFF_HEAD_LENGTH), fileName);
  if (sniffed.known) {
    if (sniffed.game !== "alttpr") return refuse("other-game", sniffed.game);
  } else if (sniffed.what === "rom") {
    return refuse("not-a-spoiler", "rom");
  } else if (sniffed.what !== "unknown") {
    return refuse("unsupported", sniffed.what);
  }
  // The Door Randomizer's text log (dr.ts); its JSON is told once parsed
  if (
    sniffed.known &&
    sniffed.format === "dr" &&
    !text
      .replace(/^\uFEFF/, "")
      .trimStart()
      .startsWith("{")
  ) {
    return parseDoorLog({ text }, fileName);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return refuse("not-a-spoiler", "not JSON");
  }
  const root = DOCUMENT.safeParse(json);
  if (!root.success) return refuse("not-a-spoiler", "not an object");
  if (isDoorDocument(root.data, sniffed)) {
    return parseDoorLog({ json: root.data }, fileName);
  }
  // The seed file wraps the spoiler with the hash that names it
  const wrapped = SEED_FILE.safeParse(root.data);
  const doc = wrapped.success ? wrapped.data.spoiler : root.data;
  const meta = META.safeParse(doc.meta);
  if (!meta.success) return refuse("not-a-spoiler", "no meta");

  const inFile = wrapped.success ? wrapped.data.hash : null;
  const inName = hashInName(fileName);
  const seed: AlttprSpoilerLog["seed"] =
    inFile !== null && SEED_HASH.test(inFile)
      ? { from: "content", id: inFile }
      : inName !== null
        ? { from: "file-name", id: inName }
        : { from: null, id: null };

  if ((meta.data.worlds ?? 1) > 1 || (meta.data.players ?? 1) > 1) {
    return refuse("unsupported", "multiworld");
  }
  const { spoilers } = meta.data;
  if (sectionsOf(doc).length === 0 && !("Special" in doc)) {
    return spoilers !== undefined && spoilers !== "on"
      ? refuse("stripped", spoilers)
      : refuse("not-a-spoiler", "no locations");
  }

  const bossShuffle = !["none", undefined].includes(
    meta.data["enemizer.boss_shuffle"],
  );
  return readLog(
    doc,
    Array.isArray(doc.Entrances) ? ER : VT,
    seed,
    bossShuffle,
  );
}

/**
 * What a log states that a run can state too, for `bindSeed`'s facts: the
 * settings its `meta` makes known, by the name `SeedSettingsReading` gives
 * them (`logic`, `mode`, `goal`, `crystalsTower`…), the medallions
 * (`medallion:mire`, `medallion:turtle-rock`) and the prize of each dungeon
 * (`prize:<dungeon id>`). A fact the log hides (a mystery seed's) is absent.
 * The adapter pairs each with the run's value of the same name.
 */
export function fileFacts(
  log: AlttprSpoilerLog,
): readonly Pick<Fact, "file" | "name">[] {
  const facts: { file: FactValue; name: string }[] = [];
  for (const [name, setting] of Object.entries(log.extra.settings ?? {})) {
    if (name === "seed") continue;
    if (typeof setting === "object" && setting?.known === true) {
      facts.push({ file: setting.value as FactValue, name });
    }
  }
  const { mire, turtleRock } = log.extra.medallions;
  if (mire !== null) facts.push({ file: mire, name: "medallion:mire" });
  if (turtleRock !== null) {
    facts.push({ file: turtleRock, name: "medallion:turtle-rock" });
  }
  for (const [dungeon, prize] of Object.entries(log.extra.prizes)) {
    facts.push({ file: prize, name: `prize:${dungeon}` });
  }
  return facts;
}
