// The branches of Tower of Hera that upstream's tests cannot reach: they
// run with no wild dungeon items. The contract covers the rest
// (test/contract.spec.ts).
import { explain, type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../pack";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../settings";

const BOSS = "tower-of-hera/boss";
const PRIZE = "tower-of-hera/prize";
/** In the tower by the flute and the mirror, with what beats Moldorm. */
const KILL = {
  bigKeyP3: 1,
  flute: 1,
  magicMirror: 1,
  rescueZelda: 1,
  sword: 1,
} as const;

const at = (settings: AlttprSettings, state: State, id: string) =>
  solve(compile(settings), state).location(id);

describe("Tower of Hera", () => {
  it("wants the map and compass with wild ones, which the boss may hold itself", () => {
    const mc = settingsFromUpstream("open", { dungeonItems: "mc" });
    expect(at(mc, KILL, BOSS)).toBe("maybe");
    expect(at(mc, { ...KILL, compassP3: 1 }, BOSS)).toBe("maybe");
    expect(at(mc, { ...KILL, compassP3: 1, mapP3: 1 }, BOSS)).toBe("yes");
    expect(at(OPEN, KILL, BOSS)).toBe("yes");
  });

  it("gives its pendant exactly when its boss falls", () => {
    const states: State[] = [
      {},
      { rescueZelda: 1 },
      KILL,
      { ...KILL, bigKeyP3: 0 },
      { ...KILL, hammer: 1, sword: 0 },
      { ...KILL, hookshot: 1, magicMirror: 0 },
      { ...KILL, hammer: 1, hookshot: 1, magicMirror: 0 },
    ];
    const mc = settingsFromUpstream("open", { dungeonItems: "mc" });
    for (const settings of [OPEN, UPSTREAM_TEST, mc]) {
      for (const state of states) {
        expect(at(settings, state, PRIZE)).toBe(at(settings, state, BOSS));
      }
    }
  });

  it("is entered from West Death Mountain through its main way", () => {
    const why = explain(compile(OPEN), KILL, "tower-of-hera/map-chest");
    expect(why.path.map((step) => step.region)).toEqual([
      "start",
      "westDeathMountain",
      "towerOfHeraMain",
      "towerOfHera",
    ]);
  });
});
