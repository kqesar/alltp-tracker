// The branches of Ice Palace that upstream's tests cannot reach: they run in
// a world with no item placement, Link able to take damage, and no wild
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

const BOSS = "ice-palace/boss";
const PRIZE = "ice-palace/prize";
const SPIKE_ROOM = "ice-palace/spike-room";

/** Swimming to the palace as Link, then melting the ice. */
const ENTER = {
  fireRod: 1,
  flippers: 1,
  glove: 2,
  moonPearl: 1,
  rescueZelda: 1,
} as const;
const KILL = { ...ENTER, bigKeyD5: 1, hammer: 1, keyD5: 2 } as const;

/**
 * What the basic placement asks for at the door (133-135): two swords, 12
 * hearts (the pool's 11 containers and 4 pieces) and armor.
 */
const HEALTHY = {
  armor: 1,
  heartContainer: 11,
  pieceOfHeart: 4,
  sword: 2,
} as const;

const BASIC = settingsFromUpstream("standard", { itemPlacement: "basic" });

const at = (settings: AlttprSettings, state: State, id: string) =>
  solve(compile(settings), state).location(id);

describe("Ice Palace", () => {
  it("may pass the Spike Room with a key alone, if the big key sits behind it", () => {
    expect(at(UPSTREAM_TEST, ENTER, SPIKE_ROOM)).toBe("no");
    expect(at(UPSTREAM_TEST, { ...ENTER, keyD5: 1 }, SPIKE_ROOM)).toBe("maybe");
    expect(at(UPSTREAM_TEST, { ...ENTER, hookshot: 1 }, SPIKE_ROOM)).toBe(
      "yes",
    );
    const behind = { ...ENTER, hammer: 1, keyD5: 1 };
    expect(at(UPSTREAM_TEST, behind, "ice-palace/big-key-chest")).toBe("maybe");
    expect(at(UPSTREAM_TEST, behind, "ice-palace/map-chest")).toBe("maybe");
  });

  it("wants a way past the spikes when Link cannot take damage", () => {
    const unhurt = settingsFromUpstream("standard", {
      "region.cantTakeDamage": true,
    });
    const key = { ...ENTER, keyD5: 1 };
    expect(at(unhurt, key, SPIKE_ROOM)).toBe("no");
    expect(at(unhurt, { ...key, cape: 1 }, SPIKE_ROOM)).toBe("maybe");
    expect(at(unhurt, { ...key, caneOfByrna: 1 }, SPIKE_ROOM)).toBe("maybe");
    expect(at(unhurt, { ...ENTER, hookshot: 1 }, SPIKE_ROOM)).toBe("yes");
    const hammer = { ...ENTER, hammer: 1, hookshot: 1 };
    expect(at(unhurt, hammer, "ice-palace/big-key-chest")).toBe("yes");
  });

  it("wants two keys for Kholdstare with the basic placement, even with the Cane of Somaria", () => {
    const somaria = { ...KILL, ...HEALTHY, caneOfSomaria: 1, keyD5: 1 };
    expect(at(OPEN, somaria, BOSS)).toBe("yes");
    expect(at(UPSTREAM_TEST, somaria, BOSS)).toBe("yes");
    expect(at(BASIC, somaria, BOSS)).toBe("no");
    expect(at(BASIC, { ...somaria, keyD5: 2 }, BOSS)).toBe("yes");
  });

  it("is entered armed and healthy with the basic placement", () => {
    const enter = (settings: AlttprSettings, state: State) =>
      solve(compile(settings), state).region("icePalace");
    expect(enter(BASIC, ENTER)).toBe("no");
    expect(enter(BASIC, { ...ENTER, ...HEALTHY })).toBe("yes");
    expect(enter(BASIC, { ...ENTER, ...HEALTHY, sword: 1 })).toBe("no");
    expect(enter(BASIC, { ...ENTER, ...HEALTHY, pieceOfHeart: 3 })).toBe("no");
    expect(enter(BASIC, { ...ENTER, ...HEALTHY, armor: 0, bottle: 2 })).toBe(
      "yes",
    );
    const swordless = settingsFromUpstream("standard", {
      itemPlacement: "basic",
      "mode.weapons": "swordless",
    });
    expect(enter(swordless, { ...ENTER, ...HEALTHY, sword: 0 })).toBe("yes");
    expect(enter(UPSTREAM_TEST, ENTER)).toBe("yes");
  });

  it("wants the map and compass with wild ones, which the boss may hold itself", () => {
    const mc = settingsFromUpstream("standard", { dungeonItems: "mc" });
    expect(at(mc, KILL, BOSS)).toBe("maybe");
    expect(at(mc, { ...KILL, compassD5: 1 }, BOSS)).toBe("maybe");
    expect(at(mc, { ...KILL, compassD5: 1, mapD5: 1 }, BOSS)).toBe("yes");
    expect(at(UPSTREAM_TEST, KILL, BOSS)).toBe("yes");
  });

  it("gives its crystal exactly when its boss falls", () => {
    const states: State[] = [
      {},
      ENTER,
      KILL,
      { ...KILL, keyD5: 1 },
      { ...KILL, caneOfSomaria: 1, keyD5: 1 },
      { ...KILL, ...HEALTHY },
    ];
    const mc = settingsFromUpstream("standard", { dungeonItems: "mc" });
    for (const settings of [OPEN, UPSTREAM_TEST, BASIC, mc]) {
      for (const state of states) {
        expect(at(settings, state, PRIZE)).toBe(at(settings, state, BOSS));
      }
    }
  });

  it("is entered from the start: its way through South Dark World is a glitch", () => {
    const world = compile(UPSTREAM_TEST);
    expect(solve(world, { rescueZelda: 1 }).region("icePalace")).toBe("no");
    const why = explain(world, ENTER, "ice-palace/compass-chest");
    expect(why.path.map((step) => step.region)).toEqual(["start", "icePalace"]);
  });
});
