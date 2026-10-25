import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useNow } from "@/hooks/useNow";
import { placeUnder } from "@/utils/popover";
import {
  formatTime,
  TIMER_WORDS,
  type RunTimer as Timer,
  type TimerClock,
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

/** The clock choice of a game that has a clock of its own. */
export type ClockChoice = {
  value: TimerClock;
  onChange: (clock: TimerClock) => void;
  /** Why game time cannot be used now (Race Mode), or null. */
  unavailable: string | null;
  /** Whether the game's clock sets the timer now: the game then drives it. */
  following: boolean;
  /**
   * What the hint says while Game time is chosen and the clock does not set
   * the timer yet. A game's own words where its clock needs more than being
   * read; the default is for one with a file to load.
   */
  waiting?: string;
};

const CLOCKS: readonly (readonly [TimerClock, string])[] = [
  ["real", "Real time"],
  ["game", "Game time"],
];

/** What the clock choice means right now, said under it. */
const clockHint = ({
  following,
  unavailable,
  value,
  waiting = "Counts real time until autotracking reads a game with a file loaded.",
}: ClockChoice): string => {
  if (unavailable !== null) return unavailable;
  if (value === "real") return "Counts real time, as races time.";
  return following ? "The timer follows the game's clock." : waiting;
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
  /**
   * Which clock the timer shows, for a game that has one: real time or the
   * game's. Omitted (Archipelago's board), no choice is offered.
   */
  clock?: ClockChoice;
  /** More in the panel, under the clock choice (ALttPR's in-game time). */
  children?: ReactNode;
};

/**
 * A run timer: real time, started and paused by the player, or on its own
 * (the game, the room's countdown) while `auto` is ticked, or set on the
 * game's own clock where the board offers one (`clock`). Its button shows
 * the time and the state's glyph and opens its controls. It redraws once a
 * second while running, and nothing else does. Every game's board that
 * keeps a timer draws this one, over its own store.
 */
export const RunTimer = ({
  auto,
  children,
  clock,
  onPause,
  onReset,
  onStart,
  timer,
}: RunTimerProps) => {
  const panelId = useId();
  const autoId = useId();
  const clockId = useId();
  const state = timerState(timer);
  const now = useNow(state === "running");
  const time = formatTime(timerMs(timer, now));
  // The game sets the time: starting, pausing and the game's own start and
  // stop have nothing left to do
  const driven = clock?.following === true && state !== "finished";

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
              disabled={driven}
              onClick={onPause}
              type="button"
            >
              Pause
            </button>
          ) : (
            <button
              className="modal-btn modal-btn--primary"
              data-testid="run-timer-start"
              disabled={state === "finished" || driven}
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
            disabled={driven}
            id={autoId}
            onChange={(event) => auto.onChange(event.target.checked)}
            type="checkbox"
          />
          <label htmlFor={autoId}>{auto.label}</label>
        </div>
        {clock && (
          <fieldset
            aria-describedby={`${clockId}-hint`}
            className="run-timer-clock"
            data-testid="run-timer-clock"
          >
            <legend className="run-timer-clock__legend">Clock</legend>
            <div className="run-timer-clock__choices">
              {CLOCKS.map(([choice, words]) => (
                <div className="check-option" key={choice}>
                  <input
                    checked={
                      (clock.unavailable === null ? clock.value : "real") ===
                      choice
                    }
                    className="check-option__input"
                    data-testid={`run-timer-clock-${choice}`}
                    disabled={choice === "game" && clock.unavailable !== null}
                    id={`${clockId}-${choice}`}
                    name={clockId}
                    onChange={() => clock.onChange(choice)}
                    type="radio"
                    value={choice}
                  />
                  <label htmlFor={`${clockId}-${choice}`}>{words}</label>
                </div>
              ))}
            </div>
            <p
              className="run-timer-clock__hint"
              data-testid="run-timer-clock-hint"
              id={`${clockId}-hint`}
            >
              {clockHint(clock)}
            </p>
          </fieldset>
        )}
        {children}
      </div>
      <span className="sr-only" data-testid="run-timer-status" role="status">
        {news}
      </span>
    </>
  );
};
