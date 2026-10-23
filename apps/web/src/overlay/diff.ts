import type {
  OverlayEvent,
  OverlayReading,
  OverlayTimer,
  OverlayTimerAction,
} from "@/overlay/protocol";

/** The run time a timer shows at `now`, or null while it has not started. */
export const timerReadingAt = (
  timer: OverlayTimer | null,
  now: number,
): number | null => {
  if (timer === null || timer.state === "idle") return null;
  const running =
    timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt);
  return timer.elapsedMs + running;
};

/** What the timer's move from one state to another is, if it is one. */
const timerAction = (
  before: OverlayTimer,
  after: OverlayTimer,
): OverlayTimerAction | null => {
  if (before.state === after.state) return null;
  switch (after.state) {
    case "running":
      return before.state === "paused" ? "resume" : "start";
    case "paused":
      return before.state === "running" ? "pause" : null;
    case "finished":
      return "finish";
    case "idle":
      return "reset";
  }
};

/**
 * The events that took a run from `prev` to `next`, in a fixed order: each
 * item that changed (in the state's order), then each objective, the timer,
 * the go mode.
 *
 * - Nothing on the first reading, nor when the game changed: there is no
 *   before to compare with, and the state says it all.
 * - One `reset` and nothing else when the run falls back to its start
 *   (`next.fresh`) in one publication, with more than one thing changed: a
 *   new game, not a hundred losses. A single thing undone is its own event. A
 *   run type that starts with items never reads as fresh, so a new game on it
 *   is a loss per item.
 * - An item or objective only in one of the two states is not compared.
 * @param prev - The reading before, or null for the first
 * @param next - The reading now
 * @param now - The app's clock (ms), which dates the items found while the
 * timer runs
 */
export const diffOverlay = (
  prev: OverlayReading | null,
  next: OverlayReading,
  now: number,
): OverlayEvent[] => {
  if (prev === null || prev.state.game !== next.state.game) return [];
  const before = prev.state;
  const after = next.state;
  const ms = timerReadingAt(after.timer, now);
  const events: OverlayEvent[] = [];

  const known = new Map(before.items.map((item) => [item.id, item]));
  for (const item of after.items) {
    const was = known.get(item.id);
    if (was && was.level !== item.level) {
      events.push({
        id: item.id,
        level: item.level,
        ms,
        name: item.name,
        previous: was.level,
        type: "item",
      });
    }
  }

  const objectives = new Map(before.objectives.map((o) => [o.id, o]));
  for (const objective of after.objectives) {
    const was = objectives.get(objective.id);
    if (was && was.done !== objective.done) {
      events.push({
        done: objective.done,
        id: objective.id,
        ms: objective.ms ?? (objective.done ? ms : null),
        name: objective.name,
        type: "objective",
      });
    }
  }

  if (before.timer && after.timer) {
    const action = timerAction(before.timer, after.timer);
    if (action) events.push({ action, type: "timer" });
  }

  if (before.goMode !== after.goMode) {
    events.push({
      goMode: after.goMode,
      previous: before.goMode,
      type: "goMode",
    });
  }

  if (next.fresh && !prev.fresh && events.length > 1)
    return [{ type: "reset" }];
  return events;
};
