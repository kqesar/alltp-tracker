// The real spoiler logs of alttpr.com that the pack keeps as fixtures
// (packs/alttpr/test/spoilers/, recorded by its script, never edited), for the
// app's specs.

import {
  type AlttprSpoilerLog,
  LEGACY_DUNGEONS,
  MAP_LOCATIONS,
  MEDALLIONS,
  parseSpoiler,
} from "@alltp/pack-alttpr";
import { checkSeed } from "@/games/alttpr/autotrack/seed";
import type { ItemState } from "@/games/alttpr/data/items";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import { itemsFromPack } from "@/games/alttpr/logic/packItems";
import { stampTimeline, type Timeline } from "@/games/alttpr/logic/timeline";
import type { ReviewedRun } from "@/games/alttpr/review/adapter";
import doorDrops from "../../../../../../packs/alttpr/test/dr-spoilers/DR_278438665_Spoiler.txt?raw";
import doorKeysanity from "../../../../../../packs/alttpr/test/dr-spoilers/DR_660701088_Spoiler.txt?raw";
import entrances from "../../../../../../packs/alttpr/test/spoilers/0yAObedRMV.txt?raw";
import standard from "../../../../../../packs/alttpr/test/spoilers/6v1ab7qmv7.txt?raw";
import vt from "../../../../../../packs/alttpr/test/spoilers/9MQ9gO1wMD.txt?raw";
import daily from "../../../../../../packs/alttpr/test/spoilers/eM43RgZ4Gj.txt?raw";
import retro from "../../../../../../packs/alttpr/test/spoilers/VMR3zKaKv5.txt?raw";

/** A seed the pack holds: vt's own layout, the entrance randomizer's, a daily's (no placements), a retro seed's and a Standard seed's (its playthrough starts at sphere 0). */
export type FixtureHash =
  | "0yAObedRMV"
  | "9MQ9gO1wMD"
  | "eM43RgZ4Gj"
  | "VMR3zKaKv5"
  | "6v1ab7qmv7";

const TEXTS: Readonly<Record<FixtureHash, string>> = {
  "0yAObedRMV": entrances,
  "6v1ab7qmv7": standard,
  "9MQ9gO1wMD": vt,
  eM43RgZ4Gj: daily,
  VMR3zKaKv5: retro,
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

/** One find of a synthetic run: a place checked at a minute of the timer. */
export interface Played {
  readonly location: string;
  readonly minute: number;
}

/** The reward value the board records for a prize item: see packItems' REWARDS. */
const rewardOf = (item: string): number =>
  item === "pendantOfCourage"
    ? 1
    : item.startsWith("pendant")
      ? 2
      : item === "crystal5" || item === "crystal6"
        ? 4
        : 3;

/**
 * A run played as autotracking records one: each place checked and the item
 * it held stamped at one instant (a prize, by its boss beaten), the timer at
 * `minute`, the seed's medallions and prizes on the board. Built through the
 * store's own `stampTimeline`, so the keys are the ones a real run saves.
 */
export const playedRun = (
  log: AlttprSpoilerLog,
  plan: readonly Played[],
  run: ReviewedRun,
  t0 = Date.UTC(2026, 9, 25, 12),
): ReviewedRun => {
  const held = new Map(log.placements.map((p) => [p.location, p.item]));
  const counts: Record<string, number> = {};
  let items = { ...run.items };
  for (const [dungeon, item] of Object.entries(log.extra.prizes)) {
    const index = (LEGACY_DUNGEONS as readonly string[]).indexOf(dungeon);
    if (index >= 0) items[`reward${index}`] = rewardOf(item);
  }
  let checked: Record<string, true> = {};
  let timeline: Timeline = {};
  for (const { location, minute } of plan) {
    const before = { checked, items };
    const item = held.get(location);
    const prize = /^(.+)\/prize$/.exec(location)?.[1];
    if (prize !== undefined) {
      const index = (LEGACY_DUNGEONS as readonly string[]).indexOf(prize);
      items = { ...items, [`boss${index}`]: 2 };
    } else {
      if (item !== null && item !== undefined) {
        counts[item] = (counts[item] ?? 0) + 1;
        items = { ...items, ...itemsFromPack(counts) } as ItemState;
      }
      if (MAP_LOCATIONS.has(location))
        checked = { ...checked, [location]: true };
    }
    timeline = stampTimeline(
      timeline,
      before,
      { checked, items },
      { at: t0 + minute * 60_000, ms: minute * 60_000 },
    );
  }
  const pad = (medallion: string | null) =>
    medallion === null ? 0 : MEDALLIONS.indexOf(medallion as never) + 1;
  const medallions = [...run.medallions];
  medallions[8] = pad(log.extra.medallions.mire);
  medallions[9] = pad(log.extra.medallions.turtleRock);
  return { ...run, checked, items, medallions, timeline };
};

/**
 * The Door Randomizer's real spoiler races' logs the pack keeps (packs/alttpr/
 * test/dr-spoilers/, recorded by its script): keysanity with the doors, pots
 * and drops vanilla, and key drops and key pots shuffled.
 */
export type DoorFixture = "660701088" | "278438665";

const DOOR_TEXTS: Readonly<Record<DoorFixture, string>> = {
  "278438665": doorDrops,
  "660701088": doorKeysanity,
};

/** The name DR writes the file under. */
export const doorSpoilerName = (seed: DoorFixture): string =>
  `DR_${seed}_Spoiler.txt`;

/** The file as DR writes it. */
export const doorSpoilerText = (seed: DoorFixture): string => DOOR_TEXTS[seed];

/** The DR file the player would pick. */
export const doorSpoilerFile = (
  seed: DoorFixture,
  text = DOOR_TEXTS[seed],
): File => new File([text], doorSpoilerName(seed), { type: "text/plain" });

/** The DR log, parsed. */
export const doorSpoilerLog = (
  seed: DoorFixture,
  text = DOOR_TEXTS[seed],
): AlttprSpoilerLog => {
  const result = parseSpoiler(text, doorSpoilerName(seed));
  if (!result.ok) throw new Error(`fixture ${seed}: ${result.error}`);
  return result.value;
};

/**
 * The run type and seed a DR log's own run holds, as the seed import lays
 * them on the Door Randomizer run type (the log's settings; its seed as the
 * ROM's title names it, which autotracking records).
 */
export const doorRunOf = (
  log: AlttprSpoilerLog,
): { presetId: string; seed: string; settings: RunSettings } => {
  const preset = getPreset("door-randomizer");
  const { settings } = log.extra;
  if (settings === null) throw new Error(`fixture ${log.seed.id}: no settings`);
  const check = checkSeed(
    { ...settings, seed: log.seed.id },
    { presetId: preset.id, settings: preset.settings },
  );
  if (check.kind !== "differs" && check.kind !== "same") {
    throw new Error(`fixture ${log.seed.id}: ${check.kind}`);
  }
  return {
    presetId: check.kind === "same" ? preset.id : check.presetId,
    seed: log.seed.id ?? "",
    settings: check.kind === "same" ? preset.settings : check.settings,
  };
};
