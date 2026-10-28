import { playTimeMs } from "@alltp/pack-alttpr";
import { STARTED_IN_PLAY, RunTimer as Timer } from "@/components/ui/RunTimer";
import { gameClockOf } from "@/games/alttpr/logic/timer";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { formatTime } from "@/utils/runTimer";

/**
 * The game's own play time, outside Race Mode, while autotracking reads a
 * game in play: frames counted by the ROM, which stops at the goal.
 */
const usePlayTime = (): number | undefined =>
  useAutotrackStore((state) => {
    const reading = state.reading;
    if (reading === null || reading.race) return undefined;
    const { romStats, started, goal } = reading.progress;
    if (typeof romStats === "string") return undefined;
    return started === true || goal === true
      ? playTimeMs(romStats.playFrames)
      : undefined;
  });

/** Whether the game's clock can set the timer now: read, a file loaded. */
const useGameClockRead = (): boolean =>
  useAutotrackStore((state) => {
    const reading = state.reading;
    return (
      reading !== null &&
      typeof gameClockOf(reading.race, reading.progress) === "object"
    );
  });

/** Whether a game in play, not at its goal, is read now. */
const useInPlay = (): boolean =>
  useAutotrackStore(
    (state) =>
      state.status.code === "connected" &&
      state.reading?.progress.started === true &&
      state.reading.progress.goal !== true,
  );

/** Whether Race Mode is on, set always on or by the seed's race flag. */
const useRaceMode = (): boolean =>
  useAutotrackStore(
    (state) => state.raceChoice === "on" || state.reading?.race === true,
  );

/**
 * ALttPR's run timer, beside go mode: the shared timer over the run's, started
 * and paused by the player, or by the game while autotracking reads it
 * ("Start and stop with the game"), or set on the game's own play time
 * ("Game time", outside Race Mode, once a file is loaded; the follower does
 * it). While the game's time is not what the timer shows, the panel also
 * gives it.
 */
export const RunTimer = () => {
  const timer = useGameStore((state) => state.timer);
  const autoTimer = useGameStore((state) => state.autoTimer);
  const timerClock = useGameStore((state) => state.timerClock);
  const startTimer = useGameStore((state) => state.startTimer);
  const pauseTimer = useGameStore((state) => state.pauseTimer);
  const resetTimer = useGameStore((state) => state.resetTimer);
  const finishTimer = useGameStore((state) => state.finishTimer);
  const setAutoTimer = useGameStore((state) => state.setAutoTimer);
  const setTimerClock = useGameStore((state) => state.setTimerClock);
  const playTime = usePlayTime();
  const raceMode = useRaceMode();
  const clockRead = useGameClockRead();
  const inPlay = useInPlay();
  const following = timerClock === "game" && !raceMode && clockRead;

  return (
    <Timer
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
      }}
      onEnd={() => finishTimer()}
      onPause={() => pauseTimer()}
      onReset={resetTimer}
      onStart={() => startTimer()}
      startHint={inPlay && autoTimer ? STARTED_IN_PLAY : null}
      timer={timer}
    >
      {playTime !== undefined && !following && (
        <p className="run-timer-panel__igt" data-testid="run-timer-igt">
          In-game time: {formatTime(playTime)}
        </p>
      )}
    </Timer>
  );
};
