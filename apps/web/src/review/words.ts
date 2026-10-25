// What the player is told when a spoiler log is not read or not shown: one
// sentence per code of @alltp/spoiler, with the short `detail` it carries
// (never the file's text at length). The codes are the package's; the words
// are the app's.

import type { Refusal } from "@alltp/spoiler";

/** What each game's spoiler log is called, and which randomizer writes it. */
const SOURCES: Readonly<Record<string, string>> = {
  alttpr: "an alttpr.com spoiler log",
  archipelago: "an Archipelago spoiler log",
  sm: "a Map Rando spoiler log (Super Metroid)",
  smz3: "a samus.link spoiler log (SMZ3)",
  "smz3-sm": "a samus.link Super Metroid spoiler log",
};

/** What a refusal's `detail` of "name: run / file" or "run / file" holds. */
const sides = (detail: string): { name: string; run: string; file: string } => {
  const colon = detail.indexOf(": ");
  const name = colon < 0 ? "" : detail.slice(0, colon);
  const [run = "?", file = "?"] = (
    colon < 0 ? detail : detail.slice(colon + 2)
  ).split(" / ");
  return { file, name, run };
};

/** The words for a setting's name in a refusal. */
const SETTING_NAMES: Readonly<Record<string, string>> = {
  accessibility: "accessibility",
  crystalsGanon: "crystals for Ganon",
  crystalsTower: "crystals for Ganon's Tower",
  dungeonItems: "dungeon items",
  entranceShuffle: "entrance shuffle",
  goal: "goal",
  itemFunctionality: "item functionality",
  itemPlacement: "item placement",
  itemPool: "item pool",
  keysanity: "key shuffle",
  "medallion:mire": "Misery Mire's medallion",
  "medallion:turtle-rock": "Turtle Rock's medallion",
  mode: "mode",
  smLogic: "Super Metroid logic",
  swordless: "swordless",
  tourianBosses: "bosses to open Tourian",
  towerCrystals: "crystals for Ganon's Tower",
};

/**
 * The sentence for a refusal.
 * @param refusal - The code and its detail
 * @param gameName - Its name, for "your run"
 */
export const refusalWords = (refusal: Refusal, gameName: string): string => {
  const detail = refusal.detail ?? "";
  switch (refusal.error) {
    case "not-over":
      return "A review opens once the run is over: at the goal, or after End run.";
    case "race-mode":
      return "Off in Race Mode: a spoiler log stays closed during a race.";
    case "too-large":
      return `This file is over ${detail || "the limit"}: it is not a spoiler log.`;
    case "not-a-spoiler":
      return detail === "rom"
        ? "This is a ROM, not a spoiler log. Pick the file the seed page's Save Spoiler button writes."
        : "This is not a spoiler log the tracker reads. Pick the file the seed page's Save Spoiler button writes.";
    case "other-game":
      return `This is ${SOURCES[detail] ?? "another game's spoiler log"}, not ${gameName}'s. Pick the one for this run.`;
    case "unsupported":
      return detail === "multiworld"
        ? "This is a multiworld spoiler log. The tracker reviews single-player seeds only."
        : `The tracker does not read ${SOURCES[detail] ?? "this spoiler log"}.`;
    case "stripped":
      return detail === "mystery"
        ? "alttpr.com keeps a Mystery seed's spoiler log to itself: this file holds none of its placements."
        : detail === "generate"
          ? "alttpr.com gives this seed's spoiler log only when the seed is generated: this file holds no placements."
          : "alttpr.com withheld this seed's spoiler log (a race): this file holds no placements.";
    case "newer-version":
      return "This log was made by a newer randomizer than this tracker knows. Reload the page for the latest version; if it still fails, it is not read yet.";
    case "seed-differs": {
      const { file, run } = sides(detail);
      return `This spoiler log is for seed ${file}; your run is seed ${run}.`;
    }
    case "settings-differ": {
      const { file, name, run } = sides(detail);
      return `This spoiler log is not your run's: its ${SETTING_NAMES[name] ?? name} is ${file}, your run's is ${run}.`;
    }
  }
};
