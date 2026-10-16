// pnpm vitest bench --run packages/engine
import { test } from "vitest";
import { solve } from "../src/solve";
import { compileWorld } from "../src/world";
import { syntheticGame } from "./synthetic";

const game = syntheticGame();
const options = { items: game.items };
const world = compileWorld(game.world, game.rules, options);
const early = game.randomState(0.25);
const mid = game.randomState(0.5);
const late = game.randomState(0.85);

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
  );
});
