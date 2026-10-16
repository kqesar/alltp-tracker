// Timing for the performance tests, made robust to a busy machine: they time
// the CPU their own process spends, not the wall clock, and keep the fastest
// of several runs. Vitest runs each test file in a process of its own (the
// forks pool), so that CPU time is the operation's, whatever else runs.
import { isMainThread } from "node:worker_threads";
import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    /** Set by vitest.config.ts when the run instruments code for coverage. */
    coverage: boolean;
  }
}

/**
 * Vitest's timeout for a timing test. It bounds wall time, which load and
 * coverage instrumentation stretch many times over (a 6 s run once took
 * 44 s): it must never be what fails. The budget assertions measure CPU.
 */
export const TIMING_TIMEOUT_MS = 120_000;

/** Whether this run instruments code for coverage (see vitest.config.ts). */
export function underCoverage(): boolean {
  return inject("coverage");
}

/**
 * Milliseconds of this process's CPU time. In a worker thread (another
 * Vitest pool), the process also runs other test files: the wall clock is
 * the honest measure there.
 */
export function cpuNow(): number {
  if (!isMainThread) return performance.now();
  const { system, user } = process.cpuUsage();
  return (system + user) / 1000;
}

/** The CPU time of the fastest of `times` runs of `run`, in ms. */
export function fastest(run: () => void, times: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times; i++) {
    const start = cpuNow();
    run();
    best = Math.min(best, cpuNow() - start);
  }
  return best;
}
