// The sweep of a review (sweep.ts), run on the main thread in slices so the
// page keeps drawing (about 200 solves of under a millisecond each for a
// six-hour run), and kept per review: the Run tab mounting again, or another
// tab coming back to it, finds it done.

import type { AlttprSpoilerLog } from "@alltp/pack-alttpr";
import { useEffect, useState } from "react";
import type {
  ReviewComparison,
  ReviewedRun,
} from "@/games/alttpr/review/adapter";
import { type Sweep, sweepRun } from "@/games/alttpr/review/sweep";
import type { Loaded } from "@/review/store";

/** How long one slice may run before the page gets a frame. */
const SLICE_MS = 8;

interface Done {
  readonly run: ReviewedRun;
  readonly endMs: number;
  readonly sweep: Sweep;
}

const done = new WeakMap<Loaded, Done>();

/** The sweep kept for this review, if it was for this run as it stands. */
const keptFor = (
  review: Loaded,
  run: ReviewedRun,
  endMs: number,
): Sweep | null => {
  const kept = done.get(review);
  if (kept === undefined || kept.endMs !== endMs) return null;
  const same = (Object.keys(run) as (keyof ReviewedRun)[]).every(
    (key) => kept.run[key] === run[key],
  );
  return same ? kept.sweep : null;
};

/**
 * The sweep of a review's run, null while it is worked out (or when `skip`:
 * a run whose waits are not shown never runs one).
 * @param run - The run's slices, as the store holds them (compared by identity)
 * @param endMs - The run timer's reading at the end
 */
export const useSweep = (
  review: Loaded,
  run: ReviewedRun,
  comparison: ReviewComparison,
  endMs: number,
  skip: boolean,
): Sweep | null => {
  const [worked, setWorked] = useState<Done | null>(null);
  useEffect(() => {
    if (skip || keptFor(review, run, endMs) !== null) return;
    const work = sweepRun(
      review.log as AlttprSpoilerLog,
      run,
      comparison,
      endMs,
    );
    let handle: ReturnType<typeof setTimeout> | undefined;
    const slice = () => {
      const until = performance.now() + SLICE_MS;
      for (;;) {
        const next = work.next();
        if (next.done === true) {
          const result = { endMs, run, sweep: next.value };
          done.set(review, result);
          setWorked(result);
          return;
        }
        if (performance.now() >= until) break;
      }
      handle = setTimeout(slice, 0);
    };
    handle = setTimeout(slice, 0);
    return () => clearTimeout(handle);
  }, [review, run, comparison, endMs, skip]);
  if (skip) return null;
  return (
    keptFor(review, run, endMs) ??
    (worked?.run === run && worked.endMs === endMs ? worked.sweep : null)
  );
};
