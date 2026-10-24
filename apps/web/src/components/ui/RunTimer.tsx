import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useNow } from "@/hooks/useNow";
import { placeUnder } from "@/utils/popover";
import {
  formatTime,
  TIMER_WORDS,
  type RunTimer as Timer,
  type TimerState,
  timerMs,
  timerState,
} from "@/utils/runTimer";

/** Each state's glyph on the button. */
const GLYPHS: Record<TimerState, string> = {
  finished: "✓",
  idle: "▷",
  paused: "❚❚",
  running: "▶",
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

export type RunTimerProps = {
  timer: Timer;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  /** What may start (and stop) the timer on its own, as a checkbox. */
  auto: {
    checked: boolean;
    label: string;
    onChange: (checked: boolean) => void;
  };
  /** More in the panel, under the checkbox (ALttPR's in-game time). */
  children?: ReactNode;
};

/**
 * A run timer: real time, started and paused by the player, or on its own
 * (the game, the room's countdown) while `auto` is ticked. Its button shows
 * the time and the state's glyph and opens its controls. It redraws once a
 * second while running, and nothing else does. Every game's board that
 * keeps a timer draws this one, over its own store.
 */
export const RunTimer = ({
  auto,
  children,
  onPause,
  onReset,
  onStart,
  timer,
}: RunTimerProps) => {
  const panelId = useId();
  const autoId = useId();
  const state = timerState(timer);
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

  return (
    <>
      <button
        aria-label={`Run timer: ${time}, ${TIMER_WORDS[state]}`}
        className={`run-timer run-timer--${state}`}
        data-testid="run-timer"
        onClick={(event) => placeUnder(event, panelId)}
        popoverTarget={panelId}
        title="Run timer"
        type="button"
      >
        <span aria-hidden="true" className="run-timer__glyph">
          {GLYPHS[state]}
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
              onClick={onPause}
              type="button"
            >
              Pause
            </button>
          ) : (
            <button
              className="modal-btn modal-btn--primary"
              data-testid="run-timer-start"
              disabled={state === "finished"}
              onClick={onStart}
              type="button"
            >
              {state === "paused" ? "Resume" : "Start"}
            </button>
          )}
          <button
            className="modal-btn modal-btn--ghost"
            data-testid="run-timer-reset"
            disabled={state === "idle"}
            onClick={onReset}
            type="button"
          >
            Reset
          </button>
        </div>
        <div className="check-option">
          <input
            checked={auto.checked}
            className="check-option__input"
            data-testid="run-timer-auto"
            id={autoId}
            onChange={(event) => auto.onChange(event.target.checked)}
            type="checkbox"
          />
          <label htmlFor={autoId}>{auto.label}</label>
        </div>
        {children}
      </div>
      <span className="sr-only" data-testid="run-timer-status" role="status">
        {news}
      </span>
    </>
  );
};
