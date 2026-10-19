// The pack, as the contract's subject: each fixture's world compiled once
// per placement set, as LogicTests.cs sets its world up (:17-31): no boss
// holds a reward, Misery Mire wants Ether and Turtle Rock Quake, and no
// crystal or boss token opens anything.
import { type CompiledWorld, solve } from "@alltp/engine";
import { stateFromUpstream } from "../src/items";
import { compile, toState } from "../src/pack";
import { placementSetting, type Smz3Settings } from "../src/settings";
import { locationId, regionId } from "../src/world";
import type { Subject } from "./contract";
import type { FixtureHeader } from "./fixtures";

const worlds = new Map<string, CompiledWorld>();

/** A fixture's settings: its logic and keysanity, every threshold at 0. */
export const settingsOf = (header: FixtureHeader): Smz3Settings => ({
  ganonCrystals: 0,
  keysanity: header.keysanity,
  smLogic: header.logic,
  tourianBosses: 0,
  towerCrystals: 0,
});

function worldOf(
  header: FixtureHeader,
  placed: ReadonlySet<string>,
  atStart: boolean,
): CompiledWorld {
  const key = [
    header.logic,
    header.keysanity,
    atStart,
    ...[...placed].sort(),
  ].join();
  let world = worlds.get(key);
  if (world === undefined) {
    world = compile(settingsOf(header), {
      locationsAtStart: atStart,
      placed,
      rewardsPlaced: false,
    });
    worlds.set(key, world);
  }
  return world;
}

export const PACK: Subject = (header, kind, name, { items, placed }) => {
  const settings = new Set(
    Object.entries(placed).map(([location, item]) =>
      placementSetting(location, item),
    ),
  );
  const world = worldOf(header, settings, kind === "location");
  const state = toState(
    stateFromUpstream(items),
    { mire: "ether", turtleRock: "quake" },
    header,
  );
  const solution = solve(world, state);
  return kind === "region"
    ? solution.region(regionId(name))
    : solution.location(locationId(name));
};
