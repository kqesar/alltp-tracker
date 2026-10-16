// The branches of Palace of Darkness that upstream's tests cannot reach:
// they run in a world with no item placement, the lamp rule on and no wild
// dungeon items. The contract covers the rest (test/contract.spec.ts).
//
// The palace is entered from North East Dark World, so its rules are read
// here as once inside: each one evaluated with the facts its items derive.
import {
  evaluate,
  loadRules,
  parse,
  type State,
  type Tri,
} from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { derivedFacts } from "../../derived";
import { RULES } from "../../rules";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../settings";
import { PALACE_OF_DARKNESS } from "./palace-of-darkness";

const rules = loadRules(RULES);
const [region] = PALACE_OF_DARKNESS.regions;

const value = (req: string, settings: AlttprSettings, items: State): Tri =>
  evaluate(parse(req), { ...items, ...derivedFacts(items, settings) }, rules, {
    settings,
  });

function at(id: string, settings: AlttprSettings, items: State): Tri {
  const location = region.locations.find(
    (l) => l.id === `palace-of-darkness/${id}`,
  );
  if (location === undefined) throw new RangeError(`No location ${id}`);
  return value(location.req, settings, items);
}

function way(from: string, settings: AlttprSettings, items: State): Tri {
  const entrance = region.entrances.find((e) => e.from === from);
  if (entrance === undefined) throw new RangeError(`No way from ${from}`);
  return value(entrance.req, settings, items);
}

const ALL_THREE = { bow: 1, hammer: 1, lamp: 1 } as const;
const WILD_KEYS = settingsFromUpstream("standard", { "region.wildKeys": true });

describe("Palace of Darkness", () => {
  it("wants a key more once Link holds the hammer, a bow and the lamp", () => {
    const big = { bigKeyD1: 1, lamp: 1 };
    expect(at("big-chest", UPSTREAM_TEST, { ...big, keyD1: 5 })).toBe("yes");
    expect(
      at("big-chest", UPSTREAM_TEST, { ...big, hammer: 1, keyD1: 5 }),
    ).toBe("yes");
    const armed = { ...big, ...ALL_THREE };
    expect(at("big-chest", UPSTREAM_TEST, { ...armed, keyD1: 5 })).toBe("no");
    expect(at("big-chest", UPSTREAM_TEST, { ...armed, keyD1: 6 })).toBe("yes");
    expect(at("compass-chest", UPSTREAM_TEST, { keyD1: 3 })).toBe("yes");
    expect(at("compass-chest", UPSTREAM_TEST, { ...ALL_THREE, keyD1: 3 })).toBe(
      "no",
    );
    expect(at("compass-chest", UPSTREAM_TEST, { ...ALL_THREE, keyD1: 4 })).toBe(
      "yes",
    );
  });

  it("may open the Big Key Chest and Harmless Hellway with fewer keys, where a key may sit", () => {
    expect(at("big-key-chest", UPSTREAM_TEST, {})).toBe("no");
    expect(at("big-key-chest", UPSTREAM_TEST, { keyD1: 1 })).toBe("maybe");
    expect(at("big-key-chest", UPSTREAM_TEST, { keyD1: 5 })).toBe("yes");
    expect(at("big-key-chest", UPSTREAM_TEST, { ...ALL_THREE, keyD1: 5 })).toBe(
      "maybe",
    );
    expect(at("big-key-chest", UPSTREAM_TEST, { ...ALL_THREE, keyD1: 6 })).toBe(
      "yes",
    );
    expect(at("harmless-hellway", UPSTREAM_TEST, { keyD1: 2 })).toBe("no");
    expect(at("harmless-hellway", UPSTREAM_TEST, { keyD1: 3 })).toBe("maybe");
    expect(at("harmless-hellway", UPSTREAM_TEST, { keyD1: 5 })).toBe("yes");
    expect(
      at("harmless-hellway", UPSTREAM_TEST, { ...ALL_THREE, keyD1: 3 }),
    ).toBe("no");
    expect(
      at("harmless-hellway", UPSTREAM_TEST, { ...ALL_THREE, keyD1: 4 }),
    ).toBe("maybe");
  });

  it("wants the higher counts whatever Link holds with wild keys", () => {
    expect(at("compass-chest", WILD_KEYS, { keyD1: 3 })).toBe("no");
    expect(at("compass-chest", WILD_KEYS, { keyD1: 4 })).toBe("yes");
    const big = { bigKeyD1: 1, lamp: 1 };
    expect(at("big-chest", WILD_KEYS, { ...big, keyD1: 5 })).toBe("no");
    expect(at("big-chest", WILD_KEYS, { ...big, keyD1: 6 })).toBe("yes");
    expect(at("big-key-chest", WILD_KEYS, { keyD1: 5 })).toBe("maybe");
  });

  it("lights the Dark Basement with the Fire Rod in the advanced placement only", () => {
    const fireRod = { fireRod: 1, keyD1: 3 };
    expect(at("dark-basement/left", OPEN, fireRod)).toBe("yes");
    expect(at("dark-basement/right", OPEN, fireRod)).toBe("yes");
    expect(at("dark-basement/left", UPSTREAM_TEST, fireRod)).toBe("no");
    const basic = settingsFromUpstream("open", { itemPlacement: "basic" });
    expect(at("dark-basement/right", basic, fireRod)).toBe("no");
    expect(at("dark-basement/right", basic, { keyD1: 3, lamp: 1 })).toBe("yes");
  });

  it("asks for no lamp when the customizer drops the rule, and counts the keys without it", () => {
    const noLamp = settingsFromUpstream("open", { "item.require.Lamp": 0 });
    expect(at("dark-maze/top", noLamp, { keyD1: 5 })).toBe("yes");
    expect(at("dark-maze/top", OPEN, { keyD1: 5 })).toBe("no");
    const armed = { bow: 1, hammer: 1 };
    expect(at("dark-maze/bottom", noLamp, { ...armed, keyD1: 5 })).toBe("no");
    expect(at("dark-maze/bottom", noLamp, { ...armed, keyD1: 6 })).toBe("yes");
    expect(at("dark-maze/bottom", OPEN, { ...armed, keyD1: 5, lamp: 1 })).toBe(
      "no",
    );
  });

  it("wants the map and compass with wild ones, which the boss may hold itself", () => {
    const mc = settingsFromUpstream("standard", { dungeonItems: "mc" });
    const kill = { ...ALL_THREE, bigKeyD1: 1, keyD1: 6 };
    expect(at("boss", UPSTREAM_TEST, kill)).toBe("yes");
    expect(at("boss", mc, kill)).toBe("maybe");
    expect(at("boss", mc, { ...kill, compassD1: 1 })).toBe("maybe");
    expect(at("boss", mc, { ...kill, compassD1: 1, mapD1: 1 })).toBe("yes");
  });

  it("gives its crystal exactly when its boss falls", () => {
    const boss = region.locations.find(
      (l) => l.id === "palace-of-darkness/boss",
    );
    const prize = region.locations.find((l) => l.id === region.prize);
    expect(prize?.kind).toBe("prize");
    expect(prize?.req).toBe(boss?.req);
  });

  it("is entered as Link from North East Dark World, armed and healthy with the basic placement", () => {
    const basic = settingsFromUpstream("standard", { itemPlacement: "basic" });
    const pearl = { moonPearl: 1, rescueZelda: 1 };
    expect(way("northEastDarkWorld", UPSTREAM_TEST, { rescueZelda: 1 })).toBe(
      "no",
    );
    expect(way("northEastDarkWorld", UPSTREAM_TEST, pearl)).toBe("yes");
    expect(way("northEastDarkWorld", basic, pearl)).toBe("no");
    const healthy = { ...pearl, bottle: 1, heartContainer: 7 };
    expect(way("northEastDarkWorld", basic, healthy)).toBe("no");
    expect(way("northEastDarkWorld", basic, { ...healthy, sword: 1 })).toBe(
      "yes",
    );
    const swordless = settingsFromUpstream("standard", {
      itemPlacement: "basic",
      "mode.weapons": "swordless",
    });
    expect(way("northEastDarkWorld", swordless, healthy)).toBe("yes");
    // The one-frame clip from West Death Mountain is a glitch
    expect(way("westDeathMountain", OPEN, { ...healthy, sword: 4 })).toBe("no");
  });
});
