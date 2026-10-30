import { useEffect } from "react";
import type { Randomizer } from "@/games/alttpr/data/doorRando";
import { doorLogic, type RunSettings } from "@/games/alttpr/data/presets";
import type { DoorSolver } from "@/games/alttpr/logic/doorWorld";
import { doorSolverLoaded, setDoorSolver } from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** The generator whose world solves a run: DR's, or its Overworld fork's. */
const flavorOf = (run: RunSettings): Randomizer =>
  run.randomizer === "owr" ? "owr" : "dr";

/**
 * The solver of a run's generator, its chunk loaded: DR's world
 * (logic/doorWorld.ts) or the Overworld Randomizer's (logic/owrWorld.ts),
 * which adds the fork's data to DR's.
 */
export const loadDoorSolver = (run: RunSettings): Promise<DoorSolver> =>
  flavorOf(run) === "owr"
    ? import("@/games/alttpr/logic/owrWorld").then(({ solver }) => solver)
    : import("@/games/alttpr/logic/doorWorld").then(({ solver }) => solver);

/**
 * Loads the logic of a Door Randomizer run once the run is one DR's world
 * holds (doorLogic), its generator's, so no other run downloads DR's rules
 * (nor a DR run the fork's); the solution takes it up as it arrives.
 * Mounted by both views.
 */
export const useDoorLogic = () => {
  const wanted = useGameStore((state) =>
    doorLogic(state.settings) ? flavorOf(state.settings) : null,
  );
  useEffect(() => {
    if (wanted === null || doorSolverLoaded(wanted)) return;
    const run = useGameStore.getState().settings;
    void loadDoorSolver(run).then((solver) => setDoorSolver(solver, wanted));
  }, [wanted]);
};
