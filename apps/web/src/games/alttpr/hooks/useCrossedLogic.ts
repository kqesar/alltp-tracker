import { useEffect } from "react";
import { crossedLogic } from "@/games/alttpr/data/presets";
import {
  crossedSolverLoaded,
  setCrossedSolver,
} from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/**
 * Loads the logic of a run with shuffled entrances (logic/crossed.ts) once
 * the run is one, so no other run downloads the entrance randomizer's
 * rules; the solution takes it up as it arrives. Mounted by both views.
 */
export const useCrossedLogic = () => {
  const wanted = useGameStore((state) => crossedLogic(state.settings));
  useEffect(() => {
    if (!wanted || crossedSolverLoaded()) return;
    void import("@/games/alttpr/logic/crossed").then(({ solver }) =>
      setCrossedSolver(solver),
    );
  }, [wanted]);
};
