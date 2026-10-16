// The branches of Misery Mire that upstream's tests cannot reach: they run
// in a world with no item placement, the lamp rule on, no wild dungeon
// items and swords, and they place nothing in the dungeon. The contract
// covers the rest (test/contract.spec.ts).
//
// The dungeon is solved on its own, entered from a stand-in for the Mire
// that is open from the start: what the Mire itself needs is
// DarkWorld/Mire.php's, and its module's to test.
import {
  type CompiledWorld,
  compileWorld,
  loadRules,
  type State,
  solve,
  type Tri,
} from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { medallionFacts } from "../../medallions";
import { STATE_NAMES } from "../../pack";
import { RULES } from "../../rules";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../settings";
import { buildWorld, type RegionModule } from "../../world";
import { MISERY_MIRE } from "./misery-mire";

const MIRE: RegionModule = {
  file: "app/Region/Standard/DarkWorld/Mire.php",
  regions: [
    {
      entrances: [{ from: "start", req: "true", source: "game" }],
      id: "mire",
      locations: [],
      name: "Mire",
    },
  ],
};

const worlds = new Map<AlttprSettings, CompiledWorld>();
const at = (settings: AlttprSettings, state: State, id: string): Tri => {
  let world = worlds.get(settings);
  if (world === undefined) {
    world = compileWorld(buildWorld([MIRE, MISERY_MIRE]), loadRules(RULES), {
      items: STATE_NAMES,
      settings,
    });
    worlds.set(settings, world);
  }
  return solve(world, state).location(id);
};

const BASIC = settingsFromUpstream("open", { itemPlacement: "basic" });
const SWORDLESS = settingsFromUpstream("open", { "mode.weapons": "swordless" });

const ETHER_PAD = medallionFacts({ mire: "ether" });
/** In, with the hookshot over the gap and the sword for the pad. */
const IN = {
  ...ETHER_PAD,
  ether: 1,
  hookshot: 1,
  moonPearl: 1,
  rescueZelda: 1,
  sword: 1,
} as const;
/** The basic placement's health gate: a better sword, 12 hearts, armor. */
const HEALTHY = { armor: 1, heartContainer: 11, pieceOfHeart: 4, sword: 2 };
const KILL = {
  ...IN,
  bigKeyD6: 1,
  caneOfSomaria: 1,
  lamp: 1,
} as const;

const BRIDGE = "misery-mire/bridge-chest";
const BOSS = "misery-mire/boss";

describe("Misery Mire", () => {
  it("opens with the medallion its pad wants, as far as the player knows it", () => {
    expect(at(OPEN, IN, BRIDGE)).toBe("yes");
    expect(at(OPEN, { ...IN, bombos: 1, ether: 0 }, BRIDGE)).toBe("no");
    const unknown = { ...IN, ...medallionFacts({ mire: "unknown" }) };
    expect(at(OPEN, { ...unknown, mireIsEther: 0 }, BRIDGE)).toBe("maybe");
    expect(at(OPEN, { ...IN, mireIsEther: 0 }, BRIDGE)).toBe("no");
  });

  it("wants a sword at the pad, unless the run is swordless", () => {
    const noSword = { ...IN, hammer: 1, sword: 0 };
    expect(at(OPEN, noSword, BRIDGE)).toBe("no");
    expect(at(SWORDLESS, noSword, BRIDGE)).toBe("yes");
  });

  it("crosses the gap with the boots, except in the basic placement", () => {
    const boots = { ...IN, ...HEALTHY, hookshot: 0, pegasusBoots: 1 };
    expect(at(OPEN, boots, BRIDGE)).toBe("yes");
    expect(at(UPSTREAM_TEST, boots, BRIDGE)).toBe("yes");
    expect(at(BASIC, boots, BRIDGE)).toBe("no");
    expect(at(BASIC, { ...boots, hookshot: 1 }, BRIDGE)).toBe("yes");
  });

  it("asks the basic placement for a better sword, 12 hearts and armor or two bottles", () => {
    expect(at(BASIC, IN, BRIDGE)).toBe("no");
    expect(at(BASIC, { ...IN, ...HEALTHY }, BRIDGE)).toBe("yes");
    const bottles = { ...IN, ...HEALTHY, armor: 0, bottle: 2 };
    expect(at(BASIC, bottles, BRIDGE)).toBe("yes");
    expect(at(BASIC, { ...bottles, bottle: 1 }, BRIDGE)).toBe("no");
    expect(at(BASIC, { ...IN, ...HEALTHY, sword: 1 }, BRIDGE)).toBe("no");
    expect(at(BASIC, { ...IN, ...HEALTHY, pieceOfHeart: 3 }, BRIDGE)).toBe(
      "no",
    );
    // Swordless, the hearts and armor are enough
    const swordless = settingsFromUpstream("open", {
      itemPlacement: "basic",
      "mode.weapons": "swordless",
    });
    const noSword = { ...IN, ...HEALTHY, hammer: 1, sword: 0 };
    expect(at(swordless, noSword, BRIDGE)).toBe("yes");
  });

  it("opens the torch rooms with three keys, or maybe two if the big key is behind them", () => {
    for (const id of [
      "misery-mire/big-key-chest",
      "misery-mire/compass-chest",
    ]) {
      expect(at(OPEN, { ...IN, keyD6: 3, lamp: 1 }, id)).toBe("yes");
      expect(at(OPEN, { ...IN, fireRod: 1, keyD6: 3 }, id)).toBe("yes");
      expect(at(OPEN, { ...IN, keyD6: 2, lamp: 1 }, id)).toBe("maybe");
      expect(at(OPEN, { ...IN, keyD6: 1, lamp: 1 }, id)).toBe("no");
      expect(at(OPEN, { ...IN, keyD6: 3 }, id)).toBe("no");
    }
  });

  it("guards the spike chest only when the run cannot take damage", () => {
    const spike = "misery-mire/spike-chest";
    const careful = settingsFromUpstream("open", {
      "region.cantTakeDamage": true,
    });
    expect(at(OPEN, IN, spike)).toBe("yes");
    expect(at(careful, IN, spike)).toBe("no");
    expect(at(careful, { ...IN, cape: 1 }, spike)).toBe("yes");
    expect(at(careful, { ...IN, caneOfByrna: 1 }, spike)).toBe("yes");
  });

  it("asks for no lamp at the boss when the customizer drops the rule", () => {
    const noLamp = settingsFromUpstream("open", { "item.require.Lamp": 0 });
    expect(at(noLamp, { ...KILL, lamp: 0 }, BOSS)).toBe("yes");
    expect(at(OPEN, { ...KILL, lamp: 0 }, BOSS)).toBe("no");
    expect(at(OPEN, KILL, BOSS)).toBe("yes");
  });

  it("wants the map and compass with wild ones, which the boss may hold itself", () => {
    const mc = settingsFromUpstream("open", { dungeonItems: "mc" });
    expect(at(mc, KILL, BOSS)).toBe("maybe");
    expect(at(mc, { ...KILL, compassD6: 1 }, BOSS)).toBe("maybe");
    expect(at(mc, { ...KILL, compassD6: 1, mapD6: 1 }, BOSS)).toBe("yes");
  });

  it("gives its crystal exactly when its boss falls", () => {
    const states: State[] = [
      {},
      IN,
      KILL,
      { ...KILL, lamp: 0 },
      { ...KILL, compassD6: 1, mapD6: 1 },
      { ...KILL, bow: 1, sword: 0 },
    ];
    const mc = settingsFromUpstream("open", { dungeonItems: "mc" });
    for (const settings of [OPEN, UPSTREAM_TEST, BASIC, mc]) {
      for (const state of states) {
        expect(at(settings, state, "misery-mire/prize")).toBe(
          at(settings, state, BOSS),
        );
      }
    }
  });
});
