// The Race Mode the player picks, saved with each game's autotracking
// preferences and handed to its session (`AutotrackSession.setRaceMode`):
// "auto" follows the ROM's race flag, "on" holds Race Mode whatever the ROM
// says, for a race on a seed generated without the flag. There is no "off":
// a seed whose flag says race stays in Race Mode.

import type { RaceSetting } from "@alltp/autotrack";

export type RaceChoice = Extract<RaceSetting, "auto" | "on">;

/** A saved choice, or "auto" for anything else. */
export const restoreRaceChoice = (saved: unknown): RaceChoice =>
  saved === "on" ? "on" : "auto";

/**
 * The persist middleware's merge for a store that saves a Race Mode choice:
 * the saved fields over the fresh ones, the choice checked, so a value no
 * version writes reads as "auto".
 */
export const mergeRaceChoice = <State extends { raceChoice: RaceChoice }>(
  persisted: unknown,
  current: State,
): State => {
  const saved: Partial<State> =
    typeof persisted === "object" && persisted !== null
      ? (persisted as Partial<State>)
      : {};
  return {
    ...current,
    ...saved,
    raceChoice: restoreRaceChoice(saved.raceChoice),
  };
};
