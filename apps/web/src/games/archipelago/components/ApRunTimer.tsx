import { RunTimer } from "@/components/ui/RunTimer";
import { useArchipelagoStore } from "@/games/archipelago/store";

/**
 * The run timer of an Archipelago board: the shared timer over the run's,
 * started and paused by the player, or started by the room's countdown as
 * it reaches 0 ("GO") while "Start at the room's countdown" is ticked (on
 * by default). The room says nothing of a goal's time, so nothing stops it.
 */
export const ApRunTimer = () => {
  const timer = useArchipelagoStore((state) => state.timer);
  const auto = useArchipelagoStore((state) => state.prefs.countdownTimer);
  const setPref = useArchipelagoStore((state) => state.setPref);
  const start = useArchipelagoStore((state) => state.startTimer);
  const pause = useArchipelagoStore((state) => state.pauseTimer);
  const reset = useArchipelagoStore((state) => state.resetTimer);
  return (
    <RunTimer
      auto={{
        checked: auto,
        label: "Start at the room's countdown",
        onChange: (checked) => setPref("countdownTimer", checked),
      }}
      onPause={() => pause()}
      onReset={reset}
      onStart={() => start()}
      timer={timer}
    />
  );
};
