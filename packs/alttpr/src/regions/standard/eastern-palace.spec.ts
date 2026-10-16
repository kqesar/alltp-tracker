// The branches of Eastern Palace that upstream's tests cannot reach: they
// run in a world with no item placement, the lamp rule on and no wild
// dungeon items. The contract covers the rest (test/contract.spec.ts).
import { explain, type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../pack";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../settings";

const BOSS = "eastern-palace/boss";
const PRIZE = "eastern-palace/prize";
const KILL = { bigKeyP1: 1, bow: 1, rescueZelda: 1 } as const;

const at = (settings: AlttprSettings, state: State, id: string) =>
  solve(compile(settings), state).location(id);

describe("Eastern Palace", () => {
  it("lights the boss's room with the Fire Rod in the advanced placement only", () => {
    const fireRod = { ...KILL, fireRod: 1 };
    expect(at(OPEN, fireRod, BOSS)).toBe("yes");
    expect(at(UPSTREAM_TEST, fireRod, BOSS)).toBe("no");
    const basic = settingsFromUpstream("open", { itemPlacement: "basic" });
    expect(at(basic, fireRod, BOSS)).toBe("no");
    expect(at(basic, { ...KILL, lamp: 1 }, BOSS)).toBe("yes");
  });

  it("asks for no lamp when the customizer drops the rule", () => {
    const noLamp = settingsFromUpstream("open", { "item.require.Lamp": 0 });
    const state = { rescueZelda: 1 };
    expect(at(noLamp, state, "eastern-palace/big-key-chest")).toBe("yes");
    expect(at(OPEN, state, "eastern-palace/big-key-chest")).toBe("no");
    expect(at(noLamp, KILL, BOSS)).toBe("yes");
  });

  it("wants the map and compass with wild ones, which the boss may hold itself", () => {
    const mc = settingsFromUpstream("open", { dungeonItems: "mc" });
    const lit = { ...KILL, lamp: 1 };
    expect(at(mc, lit, BOSS)).toBe("maybe");
    expect(at(mc, { ...lit, compassP1: 1 }, BOSS)).toBe("maybe");
    expect(at(mc, { ...lit, compassP1: 1, mapP1: 1 }, BOSS)).toBe("yes");
    expect(at(OPEN, lit, BOSS)).toBe("yes");
  });

  it("gives its pendant exactly when its boss falls", () => {
    const states: State[] = [
      {},
      { rescueZelda: 1 },
      KILL,
      { ...KILL, lamp: 1 },
      { ...KILL, fireRod: 1 },
      { ...KILL, bow: 0, hammer: 1, lamp: 1 },
    ];
    const mc = settingsFromUpstream("open", { dungeonItems: "mc" });
    for (const settings of [OPEN, UPSTREAM_TEST, mc]) {
      for (const state of states) {
        expect(at(settings, state, PRIZE)).toBe(at(settings, state, BOSS));
      }
    }
  });

  it("is entered from the start once Zelda is rescued", () => {
    const world = compile(UPSTREAM_TEST);
    expect(solve(world, {}).region("easternPalace")).toBe("no");
    const why = explain(world, { rescueZelda: 1 }, "eastern-palace/map-chest");
    expect(why.path).toEqual([
      { region: "start" },
      {
        exit: { from: "start", req: "rescueZelda", value: "yes" },
        region: "easternPalace",
      },
    ]);
  });
});
