// The logic of a Door Randomizer run (doorLogic): DR's world built on DR's
// own data (the pack's `./door-world/dr` entry, DR_DATA), loaded on demand
// for such a run alone (hooks/useDoorLogic.ts), so no other run downloads
// DR's region graph and rules, an Overworld Randomizer run's included.
import { DR_DATA } from "@alltp/pack-alttpr/door-world/dr";
import { type DoorSolver, doorSolverOf } from "@/games/alttpr/logic/doorWorld";

/** The solver of Door Randomizer runs, in DR's own world. */
export const solver: DoorSolver = doorSolverOf(DR_DATA);

/** The world data the solver builds on, which the Doors tab reads too. */
export const data = DR_DATA;
