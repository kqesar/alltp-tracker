// When something was found, as the games that date their finds keep it:
// ALttPR's timeline (alttpr/logic/timeline.ts) and Super Metroid's locations
// found (sm/store.ts). Pure.

import * as z from "zod/mini";
import { isIdle, type RunTimer, timerMs } from "@/utils/runTimer";

/**
 * When something was found: the instant (epoch milliseconds), for the
 * order, and the run timer's reading then, null before the timer started.
 */
export interface Stamp {
  readonly at: number;
  readonly ms: number | null;
}

/** The stamp of a change at `at`, read off the run timer. */
export const stampOf = (timer: RunTimer, at: number): Stamp => ({
  at,
  ms: isIdle(timer) ? null : timerMs(timer, at),
});

const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Whether a saved value is a stamp. */
export const isStamp = (value: unknown): value is Stamp => {
  if (typeof value !== "object" || value === null) return false;
  const { at, ms } = value as Record<string, unknown>;
  return isTime(at) && (ms === null || isTime(ms));
};

/** A stamp as a schema, for a store whose save is one. */
export const stampSchema = z.custom<Stamp>(isStamp, "must be a time");
