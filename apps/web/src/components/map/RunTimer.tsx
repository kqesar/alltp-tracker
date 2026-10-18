import { playTimeMs } from "@alltp/pack-alttpr";
import { useEffect, useId, useRef, useState } from "react";
import { useNow } from "@/hooks/useNow";
import {
  formatTime,
  isIdle,
  isRunning,
  type RunTimer as Timer,
  timerMs,
} from "@/logic/timer";
import { useAutotrackStore } from "@/stores/autotrackStore";
import { useGameStore } from "@/stores/gameStore";
import { placeUnder } from "@/utils/popover";

type TimerState = "finished" | "idle" | "paused" | "running";

/** Each state's glyph on the button, and its words for a screen reader. */
const STATES: Record<TimerState, { glyph: string; words: string }> = {
  finished: { glyph: "✓", words: "stopped at the goal" },
  idle: { glyph: "▷", words: "not started" },
  paused: { glyph: "❚❚", words: "paused" },
  running: { glyph: "▶", words: "running" },
};

const stateOf = (timer: Timer): TimerState => {
  if (timer.finished) return "finished";
  if (isRunning(timer)) return "running";
  return isIdle(timer) ? "idle" : "paused";
};

/** What changed, said once as it happens. */
const announce = (state: TimerState, time: string): string => {
  switch (state) {
    case "running":
      return "Run timer started";
    case "paused":
      return `Run timer paused at ${time}`;
    case "finished":
      return `Run timer stopped at the goal: ${time}`;
    default:
      return "Run timer reset";
  }
};

/**
 * The game's own play time, outside Race Mode, while autotracking reads a
 * game in play: frames counted by the ROM, which stops at the goal.
 */
const usePlayTime = (): number | undefined =>
  useAutotrackStore((state) => {
    const reading = state.reading;
    if (reading === null || reading.race) return undefined;
    const { playFrames, started, goal } = reading.progress;
    if (typeof playFrames !== "number") return undefined;
    return started === true || goal === true
      ? playTimeMs(playFrames)
      : undefined;
  });

/**
 * The run timer, beside go mode: real time, started and paused by the
 * player, or by the game while autotracking reads it ("Start and stop with
 * the game"). Its button shows the time and the state's glyph and opens its
 * controls; outside Race Mode they also give the game's own play time. It
 * redraws once a second while running, and nothing else does.
 */
export const RunTimer = () => {
  const timer = useGameStore((state) => state.timer);
  const autoTimer = useGameStore((state) => state.autoTimer);
  const startTimer = useGameStore((state) => state.startTimer);
  const pauseTimer = useGameStore((state) => state.pauseTimer);
  const resetTimer = useGameStore((state) => state.resetTimer);
  const setAutoTimer = useGameStore((state) => state.setAutoTimer);
  const playTime = usePlayTime();
  const panelId = useId();
  const autoId = useId();
  const state = stateOf(timer);
  const now = useNow(state === "running");
  const time = formatTime(timerMs(timer, now));

  // Say a change of state once, not each second's tick
  const [news, setNews] = useState("");
  const shown = useRef(state);
  useEffect(() => {
    if (shown.current === state) return;
    shown.current = state;
    setNews(announce(state, formatTime(timerMs(timer, Date.now()))));
  }, [state, timer]);

  const { glyph, words } = STATES[state];

  return (
    <>
      <button
        aria-label={`Run timer: ${words}`}
        className={`run-timer run-timer--${state}`}
        data-testid="run-timer"
        onClick={(event) => placeUnder(event, panelId)}
        popoverTarget={panelId}
        title="Run timer"
        type="button"
      >
        <span aria-hidden="true" className="run-timer__glyph">
          {glyph}
        </span>
        <span aria-hidden="true" className="run-timer__time">
          {time}
        </span>
      </button>
      <div
        className="go-mode-panel run-timer-panel"
        data-testid="run-timer-panel"
        id={panelId}
        popover="auto"
      >
        <p className="run-timer-panel__time" role="timer">
          {time}
        </p>
        <div className="run-timer-panel__actions">
          {state === "running" ? (
            <button
              className="modal-btn modal-btn--primary"
              data-testid="run-timer-pause"
              onClick={() => pauseTimer()}
              type="button"
            >
              Pause
            </button>
          ) : (
            <button
              className="modal-btn modal-btn--primary"
              data-testid="run-timer-start"
              disabled={state === "finished"}
              onClick={() => startTimer()}
              type="button"
            >
              {state === "paused" ? "Resume" : "Start"}
            </button>
          )}
          <button
            className="modal-btn modal-btn--ghost"
            data-testid="run-timer-reset"
            disabled={state === "idle"}
            onClick={resetTimer}
            type="button"
          >
            Reset
          </button>
        </div>
        <div className="autotrack-option">
          <input
            checked={autoTimer}
            className="autotrack-option__input"
            data-testid="run-timer-auto"
            id={autoId}
            onChange={(event) => setAutoTimer(event.target.checked)}
            type="checkbox"
          />
          <label htmlFor={autoId}>Start and stop with the game</label>
        </div>
        {playTime !== undefined && (
          <p className="run-timer-panel__igt" data-testid="run-timer-igt">
            In-game time: {formatTime(playTime)}
          </p>
        )}
      </div>
      <span className="sr-only" data-testid="run-timer-status" role="status">
        {news}
      </span>
    </>
  );
};
