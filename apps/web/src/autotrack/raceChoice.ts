// The Race Mode the player picks, saved with each game's autotracking
// preferences and handed to its session (`AutotrackSession.setRaceMode`):
// "auto" follows the ROM's race flag, "on" holds Race Mode whatever the ROM
// says, for a race on a seed generated without the flag. There is no "off":
// a seed whose flag says race stays in Race Mode.

import type { RaceSetting } from "@alltp/autotrack";

export type RaceChoice = Extract<RaceSetting, "auto" | "on">;

/**
 * A saved choice, or `fallback` (the game's default, "auto" unless it says
 * otherwise) for anything else.
 */
export const restoreRaceChoice = (
  saved: unknown,
  fallback: RaceChoice = "auto",
): RaceChoice => (saved === "on" || saved === "auto" ? saved : fallback);

/**
 * The save's version for a game's autotracking (`autotrack/gameSession.ts`):
 * 1 since Super Metroid's Race Mode is on by default. A save before it kept
 * "auto" as the default it then was, never as a choice: `migrateRaceChoice`
 * reads it as the game's default now.
 */
export const RACE_CHOICE_VERSION = 1;

/**
 * The persist middleware's migration to `RACE_CHOICE_VERSION`: a choice saved
 * before it reads "auto" as the game's default, `fallback`, since every save
 * held the default then; "on", which only the player set, stays.
 */
export const migrateRaceChoice = (
  persisted: unknown,
  version: number,
  fallback: RaceChoice,
): unknown => {
  if (version >= RACE_CHOICE_VERSION) return persisted;
  if (typeof persisted !== "object" || persisted === null) return persisted;
  const saved = persisted as { raceChoice?: unknown };
  return saved.raceChoice === "on"
    ? persisted
    : { ...persisted, raceChoice: fallback };
};

/**
 * The persist middleware's merge for a store that saves a Race Mode choice:
 * the saved fields over the fresh ones, the choice checked, so a value no
 * version writes reads as `fallback`, the game's default ("auto" unless it
 * says otherwise).
 */
export const mergeRaceChoice = <State extends { raceChoice: RaceChoice }>(
  persisted: unknown,
  current: State,
  fallback: RaceChoice = "auto",
): State => {
  const saved: Partial<State> =
    typeof persisted === "object" && persisted !== null
      ? (persisted as Partial<State>)
      : {};
  return {
    ...current,
    ...saved,
    raceChoice: restoreRaceChoice(saved.raceChoice, fallback),
  };
};
