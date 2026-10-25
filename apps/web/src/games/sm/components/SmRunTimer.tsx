import { GameRunTimer } from "@/components/ui/GameRunTimer";
import { useSmAutotrackStore } from "@/games/sm/autotrack/store";
import { useSmStore } from "@/games/sm/store";

/** Whether the RTA clock was read: autotracking runs, outside Race Mode. */
const useClockRead = (): boolean =>
  useSmAutotrackStore((state) => typeof state.reading?.clock === "object");

/** Whether Race Mode is on: Map Rando has no race flag, so the player's choice. */
const useRaceMode = (): boolean =>
  useSmAutotrackStore((state) => state.raceChoice === "on");

/**
 * Super Metroid's run timer: the shared one over the run's store, started and
 * paused by the player, or by the game while autotracking reads it ("Start and
 * stop with the game": the first reading in play after the title or the file
 * select, the goal in the ship), or set on Map Rando's RTA clock ("Game time",
 * outside Race Mode, which never reads it; the follower does it).
 */
export const SmRunTimer = () => (
  <GameRunTimer
    clockRead={useClockRead()}
    endable
    raceMode={useRaceMode()}
    useRun={useSmStore}
  />
);
