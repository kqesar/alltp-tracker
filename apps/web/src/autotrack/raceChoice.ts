// The Race Mode the player picks, saved with each game's autotracking
// preferences and handed to its session (`AutotrackSession.setRaceMode`).
// For a game whose ROMs carry a race flag: "auto" follows the flag, "on"
// holds Race Mode whatever the ROM says, for a race on a seed generated
// without it; there is no "off" there: a seed whose flag says race stays in
// Race Mode. For a game without one (Map Rando): "on", the default, or "off".
//
// No save ever changed version for it: a version an older tab cannot read
// would make it drop the saved choice. An older version reads "off" as
// "auto", which means off for a game without a flag, as "off" does now; and
// a legacy "auto" of a game without a flag, which every save held as the
// default it then was, reads as that game's default now.

import type { RaceSetting } from "@alltp/autotrack";

export type RaceChoice = RaceSetting;

/** The choices a game offers: with its race flag, or without one. */
export const RACE_CHOICES = {
  flag: ["auto", "on"],
  flagless: ["on", "off"],
} as const satisfies Record<string, readonly RaceChoice[]>;

/**
 * A saved choice the game offers (`choices`), or the game's default, the
 * first of them, for anything else.
 */
export const restoreRaceChoice = (
  saved: unknown,
  choices: readonly RaceChoice[] = RACE_CHOICES.flag,
): RaceChoice =>
  choices.find((choice) => choice === saved) ?? choices[0] ?? "auto";

/**
 * The persist middleware's merge for a store that saves a Race Mode choice:
 * the saved fields over the fresh ones, the choice checked against what the
 * game offers, so any other value reads as the game's default; the race
 * remembered (`raceSeen`) only if the save says so.
 */
export const mergeRaceChoice = <
  State extends { raceChoice: RaceChoice; raceSeen: boolean },
>(
  persisted: unknown,
  current: State,
  choices: readonly RaceChoice[] = RACE_CHOICES.flag,
): State => {
  const saved: Partial<State> =
    typeof persisted === "object" && persisted !== null
      ? (persisted as Partial<State>)
      : {};
  return {
    ...current,
    ...saved,
    raceChoice: restoreRaceChoice(saved.raceChoice, choices),
    // Absent from a save before the memory, or not a boolean: no race read
    raceSeen: saved.raceSeen === true,
  };
};
