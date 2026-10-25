// The real spoiler logs of alttpr.com that the pack keeps as fixtures
// (packs/alttpr/test/spoilers/, recorded by its script, never edited), for the
// app's specs.

import { type AlttprSpoilerLog, parseSpoiler } from "@alltp/pack-alttpr";
import entrances from "../../../../../../packs/alttpr/test/spoilers/0yAObedRMV.txt?raw";
import vt from "../../../../../../packs/alttpr/test/spoilers/9MQ9gO1wMD.txt?raw";
import daily from "../../../../../../packs/alttpr/test/spoilers/eM43RgZ4Gj.txt?raw";

/** A seed the pack holds: vt's own layout, the entrance randomizer's, and a daily's (no placements). */
export type FixtureHash = "0yAObedRMV" | "9MQ9gO1wMD" | "eM43RgZ4Gj";

const TEXTS: Readonly<Record<FixtureHash, string>> = {
  "0yAObedRMV": entrances,
  "9MQ9gO1wMD": vt,
  eM43RgZ4Gj: daily,
};

/** The file as the site's Save Spoiler button writes it. */
export const spoilerText = (hash: FixtureHash): string => TEXTS[hash];

/** The name the site gives the file. */
export const spoilerName = (hash: FixtureHash): string =>
  `alttpr - NoGlitches-open-ganon_${hash}.txt`;

/** The file the player would pick. */
export const spoilerFile = (
  hash: FixtureHash,
  name = spoilerName(hash),
): File => new File([spoilerText(hash)], name, { type: "text/plain" });

/** The log, parsed. */
export const spoilerLog = (hash: FixtureHash): AlttprSpoilerLog => {
  const result = parseSpoiler(spoilerText(hash), spoilerName(hash));
  if (!result.ok) throw new Error(`fixture ${hash}: ${result.error}`);
  return result.value;
};
