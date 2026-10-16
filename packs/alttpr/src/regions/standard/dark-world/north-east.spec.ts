// The branches of North East Dark World that upstream's tests cannot reach:
// they never beat Ganon, and run with the default goal, no item placement,
// the lamp rule on and swords in the pool. The contract covers the rest
// (test/contract.spec.ts).
import { type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../../pack";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../../settings";

const GANON = "ganon";

const CRYSTALS = {
  crystal1: 1,
  crystal2: 1,
  crystal3: 1,
  crystal4: 1,
  crystal5: 1,
  crystal6: 1,
  crystal7: 1,
} as const;

/** In the Dark World by Agahnim, with the Master Sword and the lamp. */
const READY = {
  ...CRYSTALS,
  defeatAgahnim: 1,
  defeatAgahnim2: 1,
  lamp: 1,
  moonPearl: 1,
  rescueZelda: 1,
  sword: 2,
} as const;

const at = (settings: AlttprSettings, state: State, id: string) =>
  solve(compile(settings), state).location(id);

const open = (config: Readonly<Record<string, unknown>>) =>
  settingsFromUpstream("open", config);

describe("Ganon", () => {
  it("falls to the Master Sword and the lamp once the crystals and Agahnim 2 are in", () => {
    expect(at(UPSTREAM_TEST, READY, GANON)).toBe("yes");
    expect(at(OPEN, READY, GANON)).toBe("yes");
    expect(at(OPEN, { ...READY, crystal7: 0 }, GANON)).toBe("no");
    expect(at(OPEN, { ...READY, defeatAgahnim2: 0 }, GANON)).toBe("no");
    expect(at(OPEN, { ...READY, moonPearl: 0 }, GANON)).toBe("no");
    expect(at(OPEN, { ...READY, sword: 1 }, GANON)).toBe("no");
  });

  it("asks for crystals.ganon crystals in the ganon goals only", () => {
    const five = { ...READY, crystal6: 0, crystal7: 0 };
    expect(at(open({ "crystals.ganon": 5 }), five, GANON)).toBe("yes");
    expect(at(open({ "crystals.ganon": 6 }), five, GANON)).toBe("no");
    const none = {
      ...READY,
      ...Object.fromEntries(Object.keys(CRYSTALS).map((c) => [c, 0])),
    };
    expect(at(open({ goal: "fast_ganon" }), none, GANON)).toBe("no");
    expect(at(open({ goal: "pedestal" }), none, GANON)).toBe("yes");
  });

  it("needs no Agahnim 2 in fast_ganon", () => {
    const fast = open({ goal: "fast_ganon" });
    expect(at(fast, { ...READY, defeatAgahnim2: 0 }, GANON)).toBe("yes");
    expect(at(OPEN, { ...READY, defeatAgahnim2: 0 }, GANON)).toBe("no");
  });

  it("wants every pendant, crystal and Agahnim in the dungeons goal", () => {
    const dungeons = open({ goal: "dungeons" });
    const pendants = {
      pendantOfCourage: 1,
      pendantOfPower: 1,
      pendantOfWisdom: 1,
    };
    expect(at(dungeons, READY, GANON)).toBe("no");
    expect(at(dungeons, { ...READY, ...pendants }, GANON)).toBe("yes");
    expect(at(dungeons, { ...READY, ...pendants, crystal1: 0 }, GANON)).toBe(
      "no",
    );
  });

  it("wants silvers and the Tempered Sword with the basic placement", () => {
    const basic = open({ itemPlacement: "basic" });
    expect(at(basic, { ...READY, bow: 2 }, GANON)).toBe("no");
    expect(at(basic, { ...READY, sword: 3 }, GANON)).toBe("no");
    expect(at(basic, { ...READY, bow: 2, sword: 3 }, GANON)).toBe("yes");
    expect(
      at(basic, { ...READY, bow: 1, silverArrowUpgrade: 1, sword: 3 }, GANON),
    ).toBe("yes");
  });

  it("falls to the hammer and silvers when swordless", () => {
    const swordless = open({ "mode.weapons": "swordless" });
    const hammer = { ...READY, bow: 2, hammer: 1, sword: 0 };
    expect(at(swordless, hammer, GANON)).toBe("yes");
    expect(at(swordless, { ...hammer, bow: 1 }, GANON)).toBe("no");
    expect(at(swordless, { ...hammer, fireRod: 1, lamp: 0 }, GANON)).toBe(
      "yes",
    );
    expect(at(OPEN, hammer, GANON)).toBe("no");
  });

  it("has the Fire Rod light the torches with the magic it needs", () => {
    const rod = { ...READY, fireRod: 1, lamp: 0 };
    // The Master Sword wants three bars, the Tempered Sword two
    expect(at(OPEN, { ...rod, magic: 1 }, GANON)).toBe("no");
    expect(at(OPEN, { ...rod, magic: 2 }, GANON)).toBe("yes");
    expect(at(OPEN, { ...rod, bottle: 2 }, GANON)).toBe("yes");
    expect(at(OPEN, { ...rod, sword: 3 }, GANON)).toBe("no");
    expect(at(OPEN, { ...rod, magic: 1, sword: 3 }, GANON)).toBe("yes");
    expect(at(OPEN, { ...rod, bottle: 1, sword: 3 }, GANON)).toBe("yes");
  });

  it("needs no lamp when the customizer drops the rule", () => {
    const dark = { ...READY, lamp: 0 };
    expect(at(open({ "item.require.Lamp": 0 }), dark, GANON)).toBe("yes");
    expect(at(OPEN, dark, GANON)).toBe("no");
  });
});

describe("the Pyramid Fairy", () => {
  const FAIRY = {
    bow: 1,
    crystal5: 1,
    crystal6: 1,
    defeatAgahnim: 1,
    hammer: 1,
    moonPearl: 1,
    rescueZelda: 1,
    sword: 1,
  } as const;

  it("has its two chests only with swords in the pool", () => {
    const noSwords = open({ "region.swordsInPool": false });
    for (const chest of ["pyramid-fairy/left", "pyramid-fairy/right"]) {
      expect(at(OPEN, FAIRY, chest)).toBe("yes");
      expect(at(noSwords, FAIRY, chest)).toBe("no");
    }
    expect(at(noSwords, FAIRY, "pyramid-fairy/sword")).toBe("yes");
    expect(at(noSwords, FAIRY, "pyramid-fairy/bow")).toBe("yes");
  });
});
