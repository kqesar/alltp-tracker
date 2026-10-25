import { RunTimer } from "@/components/ui/RunTimer";
import { useSmAutotrackStore } from "@/games/sm/autotrack/store";
import { useSmStore } from "@/games/sm/store";
import { isIdle } from "@/utils/runTimer";

/** Whether the RTA clock was read: autotracking runs, outside Race Mode. */
const useClockRead = (): boolean =>
  useSmAutotrackStore((state) => typeof state.reading?.clock === "object");

/** Whether Race Mode is on: Map Rando has no race flag, so the player's choice. */
const useRaceMode = (): boolean =>
  useSmAutotrackStore((state) => state.raceChoice === "on");

/**
 * Super Metroid's run timer: the shared timer over the run's, started and
 * paused by the player, or by the game while autotracking reads it ("Start and
 * stop with the game": the first reading in play after the title or the file
 * select, the goal in the ship), or set on Map Rando's RTA clock ("Game time",
 * outside Race Mode, which never reads it; the follower does it).
 */
export const SmRunTimer = () => {
  const timer = useSmStore((state) => state.timer);
  const autoTimer = useSmStore((state) => state.autoTimer);
  const timerClock = useSmStore((state) => state.timerClock);
  const startTimer = useSmStore((state) => state.startTimer);
  const pauseTimer = useSmStore((state) => state.pauseTimer);
  const resetTimer = useSmStore((state) => state.resetTimer);
  const setAutoTimer = useSmStore((state) => state.setAutoTimer);
  const setTimerClock = useSmStore((state) => state.setTimerClock);
  const raceMode = useRaceMode();
  const clockRead = useClockRead();
  // The clock sets a timer that has begun; an idle one waits for its start
  const following =
    timerClock === "game" && !raceMode && clockRead && !isIdle(timer);

  return (
    <RunTimer
      auto={{
        checked: autoTimer,
        label: "Start and stop with the game",
        onChange: setAutoTimer,
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
      onPause={() => pauseTimer()}
      onReset={resetTimer}
      onStart={() => startTimer()}
      timer={timer}
    />
  );
};
