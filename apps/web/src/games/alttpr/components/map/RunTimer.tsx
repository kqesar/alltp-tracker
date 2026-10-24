import { playTimeMs } from "@alltp/pack-alttpr";
import { RunTimer as Timer } from "@/components/ui/RunTimer";
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

/**
 * ALttPR's run timer, beside go mode: the shared timer over the run's, started
 * and paused by the player, or by the game while autotracking reads it
 * ("Start and stop with the game"); outside Race Mode its panel also gives
 * the game's own play time.
 */
export const RunTimer = () => {
  const timer = useGameStore((state) => state.timer);
  const autoTimer = useGameStore((state) => state.autoTimer);
  const startTimer = useGameStore((state) => state.startTimer);
  const pauseTimer = useGameStore((state) => state.pauseTimer);
  const resetTimer = useGameStore((state) => state.resetTimer);
  const setAutoTimer = useGameStore((state) => state.setAutoTimer);
  const playTime = usePlayTime();

  return (
    <Timer
      auto={{
        checked: autoTimer,
        label: "Start and stop with the game",
        onChange: setAutoTimer,
      }}
      onPause={() => pauseTimer()}
      onReset={resetTimer}
      onStart={() => startTimer()}
      timer={timer}
    >
      {playTime !== undefined && (
        <p className="run-timer-panel__igt" data-testid="run-timer-igt">
          In-game time: {formatTime(playTime)}
        </p>
      )}
    </Timer>
  );
};
