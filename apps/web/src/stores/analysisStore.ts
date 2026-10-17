import { create } from "zustand";
import type { RunAnalysis } from "@/logic/missing";

type AnalysisState = {
  /**
   * What the run is missing, worked out for one of its solutions when the
   * browser was idle (hooks/useRunAnalysis.ts); null before the first.
   */
  analysis: RunAnalysis | null;
};

/**
 * The run's analysis, kept apart from the game store as the tooltip is:
 * derived, transient, never saved or undone. A component reads it only for
 * the solution on screen, so a stale one is never shown.
 */
export const useAnalysisStore = create<AnalysisState>()(() => ({
  analysis: null,
}));
