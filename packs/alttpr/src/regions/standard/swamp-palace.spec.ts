// The branches of Swamp Palace that upstream's tests cannot reach: they run
// in a world with no item placement and no wild dungeon items. The contract
// covers the rest (test/contract.spec.ts).
//
// The palace is entered from South Dark World, so its rules are read here as
// once inside: each one evaluated on its own.
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
import { SWAMP_PALACE } from "./swamp-palace";

const rules = loadRules(RULES);
const [region] = SWAMP_PALACE.regions;

const value = (req: string, settings: AlttprSettings, items: State): Tri =>
  evaluate(parse(req), items, rules, { settings });

function at(id: string, settings: AlttprSettings, items: State): Tri {
  const location = region.locations.find((l) => l.id === `swamp-palace/${id}`);
  if (location === undefined) throw new RangeError(`No location ${id}`);
  return value(location.req, settings, items);
}

const [entrance] = region.entrances;

describe("Swamp Palace", () => {
  it("is drained from South Dark World with the mirror, armed and healthy with the basic placement", () => {
    const drain = {
      flippers: 1,
      magicMirror: 1,
      moonPearl: 1,
      rescueZelda: 1,
    };
    expect(region.entrances.map((e) => e.from)).toEqual(["southDarkWorld"]);
    expect(value(entrance.req, UPSTREAM_TEST, drain)).toBe("yes");
    expect(
      value(entrance.req, UPSTREAM_TEST, { ...drain, magicMirror: 0 }),
    ).toBe("no");
    const basic = settingsFromUpstream("standard", { itemPlacement: "basic" });
    const healthy = { ...drain, bottle: 1, heartContainer: 7 };
    expect(value(entrance.req, basic, healthy)).toBe("no");
    expect(value(entrance.req, basic, { ...healthy, sword: 1 })).toBe("yes");
  });

  it("wants the map and compass with wild ones, which the boss may hold itself", () => {
    const mc = settingsFromUpstream("standard", { dungeonItems: "mc" });
    const kill = { hammer: 1, hookshot: 1, keyD2: 1 };
    expect(at("boss", UPSTREAM_TEST, kill)).toBe("yes");
    expect(at("boss", mc, kill)).toBe("maybe");
    expect(at("boss", mc, { ...kill, mapD2: 1 })).toBe("maybe");
    expect(at("boss", mc, { ...kill, compassD2: 1, mapD2: 1 })).toBe("yes");
  });

  it("wants its own key and the hammer: the clips in from Misery Mire and Tower of Hera are glitches", () => {
    const clip = { bigKeyD6: 1, bigKeyP3: 1, keyD6: 3 };
    expect(at("big-chest", OPEN, { ...clip, bigKeyD2: 1, hammer: 1 })).toBe(
      "no",
    );
    expect(at("big-chest", OPEN, { bigKeyD2: 1, hammer: 1, keyD2: 1 })).toBe(
      "yes",
    );
    expect(at("map-chest", OPEN, clip)).toBe("no");
    expect(at("map-chest", OPEN, { keyD2: 1 })).toBe("yes");
  });

  it("gives its crystal exactly when its boss falls", () => {
    const boss = region.locations.find((l) => l.id === "swamp-palace/boss");
    const prize = region.locations.find((l) => l.id === region.prize);
    expect(prize?.kind).toBe("prize");
    expect(prize?.req).toBe(boss?.req);
  });
});
