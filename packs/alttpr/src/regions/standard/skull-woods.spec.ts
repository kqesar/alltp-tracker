// The branches of Skull Woods that upstream's tests cannot reach: they run
// in a world with no item placement, swords and no wild dungeon items. The
// contract covers the rest (test/contract.spec.ts).
//
// The woods are entered from North West Dark World, so their rules are read
// here as once inside: each one evaluated on its own.
import {
  evaluate,
  loadRules,
  parse,
  type State,
  type Tri,
} from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { RULES } from "../../rules";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../settings";
import { SKULL_WOODS } from "./skull-woods";

const rules = loadRules(RULES);
const [region] = SKULL_WOODS.regions;

const value = (req: string, settings: AlttprSettings, items: State): Tri =>
  evaluate(parse(req), items, rules, { settings });

function at(id: string, settings: AlttprSettings, items: State): Tri {
  const location = region.locations.find((l) => l.id === `skull-woods/${id}`);
  if (location === undefined) throw new RangeError(`No location ${id}`);
  return value(location.req, settings, items);
}

const [entrance] = region.entrances;

/** Through the back with the Fire Rod, past Mothula with the hammer. */
const BACK = { fireRod: 1, hammer: 1, keyD3: 3, moonPearl: 1 } as const;

describe("Skull Woods", () => {
  it("lets a swordless Link face Mothula without a sword", () => {
    const swordless = settingsFromUpstream("standard", {
      "mode.weapons": "swordless",
    });
    expect(at("boss", UPSTREAM_TEST, BACK)).toBe("no");
    expect(at("boss", UPSTREAM_TEST, { ...BACK, sword: 1 })).toBe("yes");
    expect(at("boss", swordless, BACK)).toBe("yes");
  });

  it("wants the map and compass with wild ones, which the boss may hold itself", () => {
    const mc = settingsFromUpstream("standard", { dungeonItems: "mc" });
    const kill = { ...BACK, sword: 1 };
    expect(at("boss", mc, kill)).toBe("maybe");
    expect(at("boss", mc, { ...kill, compassD3: 1 })).toBe("maybe");
    expect(at("boss", mc, { ...kill, compassD3: 1, mapD3: 1 })).toBe("yes");
  });

  it("wants the Moon Pearl at the back: the dungeon revive is a glitch", () => {
    const revive = { fireRod: 1, magicMirror: 1, pegasusBoots: 1 };
    expect(at("bridge-room", OPEN, revive)).toBe("no");
    expect(at("bridge-room", OPEN, { fireRod: 1, moonPearl: 1 })).toBe("yes");
  });

  it("is entered from North West Dark World as Link, armed and healthy with the basic placement", () => {
    expect(region.entrances.map((e) => e.from)).toEqual(["northWestDarkWorld"]);
    const pearl = { moonPearl: 1, rescueZelda: 1 };
    expect(value(entrance.req, UPSTREAM_TEST, { rescueZelda: 1 })).toBe("no");
    expect(value(entrance.req, UPSTREAM_TEST, pearl)).toBe("yes");
    const basic = settingsFromUpstream("standard", { itemPlacement: "basic" });
    const healthy = { ...pearl, bottle: 1, heartContainer: 7 };
    expect(value(entrance.req, basic, healthy)).toBe("no");
    expect(value(entrance.req, basic, { ...healthy, sword: 1 })).toBe("yes");
  });

  it("gives its crystal exactly when its boss falls", () => {
    const boss = region.locations.find((l) => l.id === "skull-woods/boss");
    const prize = region.locations.find((l) => l.id === region.prize);
    expect(prize?.kind).toBe("prize");
    expect(prize?.req).toBe(boss?.req);
  });
});
