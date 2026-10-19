import { useEffect } from "react";
import { analyzeRun, type Missing } from "@/games/alttpr/logic/missing";
import type { Ways } from "@/games/alttpr/logic/needs";
import { type Solution, solutionOf } from "@/games/alttpr/logic/solution";
import { useAnalysisStore } from "@/games/alttpr/stores/analysisStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** The longest the analysis waits for an idle moment on a busy page. */
const IDLE_TIMEOUT_MS = 500;

/** Run `task` when the browser is idle; returns what cancels it. */
const whenIdle = (task: () => void): (() => void) => {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
    return () => cancelIdleCallback(handle);
  }
  // Safari has no idle callback: right after the click's frame instead
  const handle = setTimeout(task, 0);
  return () => clearTimeout(handle);
};

/**
 * Work the run's analysis out now, for the run as it stands, unless it is
 * done already for its solution.
 */
export const analyzeNow = () => {
  const state = useGameStore.getState();
  const solution = solutionOf(state);
  if (useAnalysisStore.getState().analysis?.solution === solution) return;
  useAnalysisStore.setState({
    analysis: analyzeRun(solution, state.settings),
  });
};

/**
 * Keeps the run's analysis (what every check and the go mode are missing)
 * in step with the run, off the critical path of a click: each change that
 * moves the solution schedules it for the browser's next idle moment, which
 * a later change replaces. Mounted once, by the App.
 */
export const useRunAnalysis = () => {
  useEffect(() => {
    let cancel: (() => void) | undefined;
    const schedule = () => {
      const solution = solutionOf(useGameStore.getState());
      if (useAnalysisStore.getState().analysis?.solution === solution) return;
      cancel?.();
      cancel = whenIdle(() => {
        cancel = undefined;
        analyzeNow();
      });
    };
    schedule();
    const unsubscribe = useGameStore.subscribe(schedule);
    return () => {
      unsubscribe();
      cancel?.();
    };
  }, []);
};

/** The analysis, if it is for the solution on screen. */
export const useCurrentAnalysis = () => {
  const solution: Solution = useGameStore(solutionOf);
  const analysis = useAnalysisStore((state) => state.analysis);
  return analysis?.solution === solution ? analysis : undefined;
};

/**
 * What a location is missing: undefined while the analysis is pending,
 * null once it is in logic.
 */
export const useMissing = (id: string): Missing | null | undefined => {
  const analysis = useCurrentAnalysis();
  return analysis === undefined
    ? undefined
    : (analysis.missing.get(id) ?? null);
};

/**
 * What the go mode is missing: undefined while the analysis is pending or
 * for a goal without one.
 */
export const useGoModeMissing = (): Ways | undefined =>
  useCurrentAnalysis()?.goMode;
