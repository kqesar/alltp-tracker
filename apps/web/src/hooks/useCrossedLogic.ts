import { useEffect } from "react";
import { crossedLogic } from "@/data/presets";
import { crossedSolverLoaded, setCrossedSolver } from "@/logic/solution";
import { useGameStore } from "@/stores/gameStore";

/**
 * Loads the logic of a run with shuffled entrances (logic/crossed.ts) once
 * the run is one, so no other run downloads the entrance randomizer's
 * rules; the solution takes it up as it arrives. Mounted by both views.
 */
export const useCrossedLogic = () => {
  const wanted = useGameStore((state) => crossedLogic(state.settings));
  useEffect(() => {
    if (!wanted || crossedSolverLoaded()) return;
    void import("@/logic/crossed").then(({ solver }) =>
      setCrossedSolver(solver),
    );
  }, [wanted]);
};
