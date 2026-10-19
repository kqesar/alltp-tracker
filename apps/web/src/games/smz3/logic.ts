// The SMZ3 run read by the pack's logic: the world of the run's settings,
// compiled once per settings, solved once per change of what the player
// holds or knows, and each map marker's state from it.
//
// A marker hook returns a string, so a click re-renders only the markers it
// changed, as ALttPR's (games/alttpr/logic/solution.ts).

import {
  type CompiledWorld,
  type Solution,
  solve,
  type Tri,
} from "@alltp/engine";
import { markerStatus } from "@alltp/pack-alttpr";
import { compile, type Smz3Settings, toState } from "@alltp/pack-smz3";
import { type Smz3Progress, useSmz3Store } from "@/games/smz3/store";

const worlds = new Map<string, CompiledWorld>();

/** The run's world, compiled once per distinct settings. */
const worldOf = (settings: Smz3Settings): CompiledWorld => {
  const key = JSON.stringify(settings);
  let world = worlds.get(key);
  if (world === undefined) {
    world = compile(settings);
    worlds.set(key, world);
  }
  return world;
};

let last:
  | {
      items: Smz3Progress["items"];
      pads: Smz3Progress["pads"];
      settings: Smz3Settings;
      solution: Solution;
    }
  | undefined;

/** The run's solution, solved again only when its items, pads or settings change. */
export const solutionOf = ({
  items,
  pads,
  settings,
}: Pick<Smz3Progress, "items" | "pads" | "settings">): Solution => {
  if (
    last?.items === items &&
    last.pads === pads &&
    last.settings === settings
  ) {
    return last.solution;
  }
  const solution = solve(
    worldOf(settings),
    toState(
      Object.fromEntries(
        Object.entries(items).map(([id, count]) => [id, count ?? 0]),
      ),
      pads,
      settings,
    ),
  );
  last = { items, pads, settings, solution };
  return solution;
};

/** A marker's state: opened once all its locations are checked. */
export type MarkerState = "available" | "possible" | "unavailable" | "opened";

/** Each state in words, for a marker's accessible name. */
export const STATE_LABELS: Readonly<Record<MarkerState, string>> = {
  available: "available",
  opened: "checked",
  possible: "maybe, or only some",
  unavailable: "out of logic",
};

let checkedSet:
  | { from: readonly string[]; set: ReadonlySet<string> }
  | undefined;

/** The locations checked, as a set, built again only when they change. */
const checkedOf = (checked: readonly string[]): ReadonlySet<string> => {
  if (checkedSet?.from !== checked) {
    checkedSet = { from: checked, set: new Set(checked) };
  }
  return checkedSet.set;
};

/** The state of a marker standing for `locations`, in a run. */
export const markerState = (
  run: Smz3Progress,
  locations: readonly string[],
): MarkerState => {
  const checked = checkedOf(run.checked);
  const open = locations.filter((id) => !checked.has(id));
  if (open.length === 0) return "opened";
  const solution = solutionOf(run);
  return markerStatus(open.map((id): Tri => solution.location(id)));
};

/** A marker's state, re-rendering only when it changes. */
export const useMarkerState = (locations: readonly string[]): MarkerState =>
  useSmz3Store((state) => markerState(state, locations));
