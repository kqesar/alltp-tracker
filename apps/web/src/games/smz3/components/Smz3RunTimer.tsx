import { GameRunTimer } from "@/components/ui/GameRunTimer";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import { useSmz3Store } from "@/games/smz3/store";

/** Whether the games' frame counters were read: autotracking runs, outside Race Mode. */
const useClockRead = (): boolean =>
  smz3Autotrack.useStore((state) => typeof state.reading?.clock === "object");

/** Whether a game in play, not at its goal, is read now. */
const useInPlay = (): boolean =>
  smz3Autotrack.useStore(
    (state) =>
      state.status.code === "connected" &&
      state.reading?.inPlay === true &&
      state.reading.goal !== true,
  );

/** Whether Race Mode is on as the player set it (a race seed's own flag is not asked: the clock is read only when it is off). */
const useRaceMode = (): boolean =>
  smz3Autotrack.useStore(
    (state) => state.reading?.race ?? state.raceChoice === "on",
  );

/**
 * SMZ3's run timer: the shared one over the run's store, started and paused
 * by the player, or by the game while autotracking reads it ("Start and stop
 * with the game": the first reading in play after the title or a file's
 * loading, in either game, and the credits), or set on the games' frame
 * counters ("Game time", outside Race Mode, which never reads them; the
 * follower does it).
 */
export const Smz3RunTimer = () => (
  <GameRunTimer
    clockRead={useClockRead()}
    endable
    inPlay={useInPlay()}
    raceMode={useRaceMode()}
    useRun={useSmz3Store}
  />
);
