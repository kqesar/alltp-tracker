// The logic of an Overworld Randomizer run (doorLogic): DR's world built on
// the fork's own data (the pack's `./door-world/owr` entry, OWR_DATA),
// loaded on demand for such a run alone (hooks/useDoorLogic.ts), so no
// other run downloads the fork's region graph and rules.
import { OWR_DATA } from "@alltp/pack-alttpr/door-world/owr";
import { type DoorSolver, doorSolverOf } from "@/games/alttpr/logic/doorWorld";

/** The solver of Overworld Randomizer runs, in the fork's own world. */
export const solver: DoorSolver = doorSolverOf(OWR_DATA);
