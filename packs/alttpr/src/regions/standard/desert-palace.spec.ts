// The branches of Desert Palace that upstream's tests cannot reach: they run
// with no wild dungeon items. The contract covers the rest
// (test/contract.spec.ts).
import { type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../pack";
import { OPEN, settingsFromUpstream, UPSTREAM_TEST } from "../../settings";

const BOSS = "desert-palace/boss";
const PRIZE = "desert-palace/prize";
/** By the Book, the glove for the back door, the lamp for the torches. */
const KILL = {
  bigKeyP2: 1,
  bookOfMudora: 1,
  glove: 1,
  keyP2: 1,
  lamp: 1,
  rescueZelda: 1,
  sword: 1,
} as const;

describe("Desert Palace", () => {
  it("wants the map and compass with wild ones, which the boss may hold itself", () => {
    const mc = settingsFromUpstream("open", { dungeonItems: "mc" });
    const at = (state: State) => solve(compile(mc), state).location(BOSS);
    expect(at(KILL)).toBe("maybe");
    expect(at({ ...KILL, compassP2: 1 })).toBe("maybe");
    expect(at({ ...KILL, mapP2: 1 })).toBe("maybe");
    expect(at({ ...KILL, compassP2: 1, mapP2: 1 })).toBe("yes");
    expect(solve(compile(OPEN), KILL).location(BOSS)).toBe("yes");
  });

  it("gives its pendant exactly when its boss falls", () => {
    const states: State[] = [
      {},
      { rescueZelda: 1 },
      KILL,
      { ...KILL, glove: 0 },
      { ...KILL, fireRod: 1, lamp: 0 },
      { ...KILL, bigKeyP2: 0 },
    ];
    const mc = settingsFromUpstream("open", { dungeonItems: "mc" });
    for (const settings of [OPEN, UPSTREAM_TEST, mc]) {
      const world = compile(settings);
      for (const state of states) {
        const solution = solve(world, state);
        expect(solution.location(PRIZE)).toBe(solution.location(BOSS));
      }
    }
  });

  it("is entered with the Book once Zelda is rescued", () => {
    const world = compile(OPEN);
    expect(solve(world, { bookOfMudora: 1 }).region("desertPalace")).toBe("no");
    expect(
      solve(world, { bookOfMudora: 1, rescueZelda: 1 }).region("desertPalace"),
    ).toBe("yes");
  });
});
