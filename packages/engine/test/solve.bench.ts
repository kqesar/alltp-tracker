// pnpm vitest bench --run packages/engine
import { test } from "vitest";
import { analyze } from "../src/analyze";
import type { State } from "../src/evaluate";
import { solve } from "../src/solve";
import { compileWorld } from "../src/world";
import { syntheticGame } from "./synthetic";

const game = syntheticGame();
const options = { items: game.items };
const world = compileWorld(game.world, game.rules, options);
const early = game.randomState(0.25);
const mid = game.randomState(0.5);
const late = game.randomState(0.85);

/** Blockers of every location, for both targets: a full "what next?" pass. */
const everything = (state: State) => {
  const analysis = analyze(world, state);
  for (const id of world.locationIds) {
    analysis.blockers(id, "yes");
    analysis.blockers(id, "maybe");
  }
};

test("300 regions, ~900 exits, 1000 locations, 20 helpers", async ({
  bench,
}) => {
  await bench.compare(
    bench("compileWorld (once per game/settings)", () => {
      compileWorld(game.world, game.rules, options);
    }),
    bench("solve: empty inventory", () => {
      solve(world, {});
    }),
    bench("solve: early game (25% of items)", () => {
      solve(world, early);
    }),
    bench("solve: mid game (50% of items)", () => {
      solve(world, mid);
    }),
    bench("solve: late game (85% of items)", () => {
      solve(world, late);
    }),
    bench("solve + locations() snapshot, mid game", () => {
      solve(world, mid).locations();
    }),
    bench("analyze: one location, mid game", () => {
      analyze(world, mid).blockers("l500", "yes");
    }),
    bench("analyze: every location, early game", () => {
      everything(early);
    }),
    bench("analyze: every location, mid game", () => {
      everything(mid);
    }),
    bench("analyze: every location, late game", () => {
      everything(late);
    }),
  );
});
