import { useEffect } from "react";
import { doorLogic } from "@/games/alttpr/data/presets";
import { doorSolverLoaded, setDoorSolver } from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/**
 * Loads the logic of a Door Randomizer run (logic/doorWorld.ts) once the
 * run is one DR's world holds (doorLogic), so no other run downloads DR's
 * rules; the solution takes it up as it arrives. Mounted by both views.
 */
export const useDoorLogic = () => {
  const wanted = useGameStore((state) => doorLogic(state.settings));
  useEffect(() => {
    if (!wanted || doorSolverLoaded()) return;
    void import("@/games/alttpr/logic/doorWorld").then(({ solver }) =>
      setDoorSolver(solver),
    );
  }, [wanted]);
};
