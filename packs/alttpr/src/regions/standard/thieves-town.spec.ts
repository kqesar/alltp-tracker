// The branches of Thieves' Town that upstream's tests cannot reach: they run
// in a world with no item placement and no wild dungeon items. The contract
// covers the rest (test/contract.spec.ts).
//
// The town is entered from North West Dark World, so its rules are read
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
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../settings";
import { THIEVES_TOWN } from "./thieves-town";

const rules = loadRules(RULES);
const [region] = THIEVES_TOWN.regions;

const value = (req: string, settings: AlttprSettings, items: State): Tri =>
  evaluate(parse(req), items, rules, { settings });

function at(id: string, settings: AlttprSettings, items: State): Tri {
  const location = region.locations.find((l) => l.id === `thieves-town/${id}`);
  if (location === undefined) throw new RangeError(`No location ${id}`);
  return value(location.req, settings, items);
}

const [entrance] = region.entrances;
const BASIC = settingsFromUpstream("standard", { itemPlacement: "basic" });

describe("Thieves' Town", () => {
  it("may open the Big Chest without the key, which may sit in it", () => {
    const smash = { bigKeyD4: 1, hammer: 1 };
    expect(at("big-chest", UPSTREAM_TEST, { bigKeyD4: 1, keyD4: 1 })).toBe(
      "no",
    );
    expect(at("big-chest", UPSTREAM_TEST, smash)).toBe("maybe");
    expect(at("big-chest", UPSTREAM_TEST, { ...smash, keyD4: 1 })).toBe("yes");
  });

  it("wants a sword and the cape or the Cane of Byrna against Blind with the basic placement", () => {
    const kill = { bigKeyD4: 1, hammer: 1, keyD4: 1 };
    expect(at("boss", UPSTREAM_TEST, kill)).toBe("yes");
    expect(at("boss", BASIC, kill)).toBe("no");
    expect(at("boss", BASIC, { ...kill, sword: 1 })).toBe("no");
    expect(at("boss", BASIC, { ...kill, cape: 1, sword: 1 })).toBe("yes");
  });

  it("wants the map and compass with wild ones, which the boss may hold itself", () => {
    const mc = settingsFromUpstream("standard", { dungeonItems: "mc" });
    const kill = { bigKeyD4: 1, hammer: 1, keyD4: 1 };
    expect(at("boss", mc, kill)).toBe("maybe");
    expect(at("boss", mc, { ...kill, mapD4: 1 })).toBe("maybe");
    expect(at("boss", mc, { ...kill, compassD4: 1, mapD4: 1 })).toBe("yes");
  });

  it("is entered from North West Dark World as Link, armed and healthy with the basic placement", () => {
    expect(region.entrances.map((e) => e.from)).toEqual(["northWestDarkWorld"]);
    const pearl = { moonPearl: 1, rescueZelda: 1 };
    expect(value(entrance.req, UPSTREAM_TEST, { rescueZelda: 1 })).toBe("no");
    expect(value(entrance.req, UPSTREAM_TEST, pearl)).toBe("yes");
    const healthy = { ...pearl, bottle: 1, heartContainer: 7 };
    expect(value(entrance.req, BASIC, healthy)).toBe("no");
    expect(value(entrance.req, BASIC, { ...healthy, sword: 1 })).toBe("yes");
  });

  it("gives its crystal exactly when its boss falls", () => {
    const boss = region.locations.find((l) => l.id === "thieves-town/boss");
    const prize = region.locations.find((l) => l.id === region.prize);
    expect(prize?.kind).toBe("prize");
    expect(prize?.req).toBe(boss?.req);
  });
});
