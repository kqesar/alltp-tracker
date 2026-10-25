import { useEffect } from "react";
import {
  analyzeRun,
  type Missing,
  type RunAnalysis,
} from "@/games/alttpr/logic/missing";
import type { Ways } from "@/games/alttpr/logic/needs";
import {
  type Solution,
  solutionOf,
  type TrickSolution,
  trickSolutionOf,
} from "@/games/alttpr/logic/solution";
import { useAnalysisStore } from "@/games/alttpr/stores/analysisStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** The longest the analysis waits for an idle moment on a busy page. */
const IDLE_TIMEOUT_MS = 500;

/** Run `task` when the browser is idle; returns what cancels it. */
export const whenIdle = (task: () => void): (() => void) => {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
    return () => cancelIdleCallback(handle);
  }
  // Safari has no idle callback: right after the click's frame instead
  const handle = setTimeout(task, 0);
  return () => clearTimeout(handle);
};

/**
 * Whether an analysis is for this solution and these tricks: it says which
 * tricks open a check, so another list of tricks, or none, makes it stale.
 */
const isCurrent = (
  analysis: RunAnalysis | null | undefined,
  solution: Solution,
  tricks: TrickSolution | undefined,
): analysis is RunAnalysis =>
  analysis?.solution === solution && analysis.tricks === tricks?.techniques;

/**
 * Work the run's analysis out now, for the run as it stands, unless it is
 * done already for its solution.
 */
export const analyzeNow = () => {
  const state = useGameStore.getState();
  const solution = solutionOf(state);
  const tricks = trickSolutionOf(state);
  if (isCurrent(useAnalysisStore.getState().analysis, solution, tricks)) return;
  useAnalysisStore.setState({
    analysis: analyzeRun(solution, state.settings, tricks),
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
      const state = useGameStore.getState();
      if (
        isCurrent(
          useAnalysisStore.getState().analysis,
          solutionOf(state),
          trickSolutionOf(state),
        )
      ) {
        return;
      }
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
  const tricks = useGameStore(trickSolutionOf);
  const analysis = useAnalysisStore((state) => state.analysis);
  return isCurrent(analysis, solution, tricks) ? analysis : undefined;
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
