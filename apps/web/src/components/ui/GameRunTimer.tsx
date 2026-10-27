import { RunTimer } from "@/components/ui/RunTimer";
import type { TimerActions, TimerSlice } from "@/games/timerSlice";
import { isIdle } from "@/utils/runTimer";

/** The timer's part of a game's store: its hook, as a selector takes it. */
type RunStore = <T>(
  selector: (
    state: TimerSlice & TimerActions & { resetTimer: () => void },
  ) => T,
) => T;

/**
 * A board's run timer over its game's store: the shared timer, started and
 * paused by the player, or by the game while autotracking reads it ("Start
 * and stop with the game"), or set on the game's own clock ("Game time",
 * outside Race Mode, which never reads it; the game's follower does it).
 * Super Metroid's and SMZ3's boards draw this one.
 * @param useRun - The game's store
 * @param raceMode - Race Mode is on: the clock is never read
 * @param clockRead - The clock was read: autotracking runs, outside Race Mode
 * @param endable - The board reviews a finished run: the timer offers End run
 * @param autoInRace - The game may start and stop the timer in Race Mode;
 * false for Super Metroid, whose races state no rule for it (the player's
 * then, as racetime.gg times the race)
 */
export const GameRunTimer = ({
  autoInRace = true,
  clockRead,
  endable = false,
  raceMode,
  useRun,
}: {
  autoInRace?: boolean;
  clockRead: boolean;
  endable?: boolean;
  raceMode: boolean;
  useRun: RunStore;
}) => {
  const timer = useRun((state) => state.timer);
  const autoTimer = useRun((state) => state.autoTimer);
  const timerClock = useRun((state) => state.timerClock);
  const startTimer = useRun((state) => state.startTimer);
  const finishTimer = useRun((state) => state.finishTimer);
  const pauseTimer = useRun((state) => state.pauseTimer);
  const setAutoTimer = useRun((state) => state.setAutoTimer);
  const setTimerClock = useRun((state) => state.setTimerClock);
  const resetTimer = useRun((state) => state.resetTimer);
  // The clock sets a timer that has begun; an idle one waits for its start
  const following =
    timerClock === "game" && !raceMode && clockRead && !isIdle(timer);

  return (
    <RunTimer
      auto={{
        checked: autoTimer,
        label: "Start and stop with the game",
        onChange: setAutoTimer,
        unavailable:
          raceMode && !autoInRace
            ? "Not in Race Mode: start and end the run yourself, as racetime.gg times the race."
            : null,
      }}
      clock={{
        following,
        onChange: setTimerClock,
        unavailable: raceMode
          ? "Not in Race Mode: the timer counts real time."
          : null,
        value: timerClock,
        waiting: clockRead
          ? "The timer follows the game's clock once it starts."
          : "Counts real time until autotracking reads the game's clock.",
      }}
      onEnd={endable ? () => finishTimer() : undefined}
      onPause={() => pauseTimer()}
      onReset={resetTimer}
      onStart={() => startTimer()}
      timer={timer}
    />
  );
};
