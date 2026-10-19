import { solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { derivedFacts } from "./derived";
import { fromUpstream, ITEMS, stateFromUpstream } from "./items";
import { medallionFacts } from "./medallions";
import { compile, rules, toState, world } from "./pack";
import {
  DEFAULT_SETTINGS,
  engineSettings,
  PLACEMENT_LOCATIONS,
  placementSetting,
  type Smz3Settings,
} from "./settings";
import { buildWorld, ifKeysanity, locationId, pick, regionId } from "./world";

const NO_PADS = {};
const solved = (items: Record<string, number>, pads = NO_PADS) =>
  solve(compile(DEFAULT_SETTINGS), toState(items, pads, DEFAULT_SETTINGS));

describe("a run's world", () => {
  it("opens the start of both games and nothing beyond", () => {
    const solution = solved({});
    expect(solution.location(locationId("Link's House"))).toBe("yes");
    expect(solution.location(locationId("Morphing Ball"))).toBe("yes");
    expect(solution.location(locationId("Eastern Palace - Big Chest"))).toBe(
      "no",
    );
    expect(solution.region(regionId("Ganon's Tower"))).toBe("no");
  });

  it("reads a key placement it cannot know as maybe, and its key count surely", () => {
    // Palace of Darkness, its doors: one key opens the big key chest only
    // when that key sits in it
    const darkWorld = { flippers: 1, glove: 2, moonPearl: 1 };
    const chest = locationId("Palace of Darkness - Big Key Chest");
    expect(solved({ ...darkWorld, keyPD: 1 }).location(chest)).toBe("maybe");
    expect(solved({ ...darkWorld, keyPD: 5 }).location(chest)).toBe("yes");
  });

  it("wants the crystals and boss tokens found to open Ganon's Tower", () => {
    const tower = { glove: 2, hookshot: 1, lamp: 1, moonPearl: 1 };
    const rewards = {
      crystalBlue: 5,
      crystalRed: 2,
      tokenDraygon: 1,
      tokenKraid: 1,
      tokenPhantoon: 1,
      tokenRidley: 1,
    };
    expect(solved(tower).region(regionId("Ganon's Tower"))).toBe("no");
    expect(
      solved({ ...tower, ...rewards }).region(regionId("Ganon's Tower")),
    ).toBe("yes");
  });

  it("opens a medallion pad as far as the player knows what it wants", () => {
    const mire = {
      ether: 1,
      flute: 1,
      glove: 2,
      hookshot: 1,
      moonPearl: 1,
      sword: 1,
    };
    const id = regionId("Misery Mire");
    expect(solved(mire).region(id)).toBe("no");
    expect(solved(mire, { mire: "unknown" }).region(id)).toBe("maybe");
    expect(solved(mire, { mire: "ether" }).region(id)).toBe("yes");
    expect(solved(mire, { mire: "quake" }).region(id)).toBe("no");
  });

  it("takes Super Metroid's Hard rules under Hard logic", () => {
    const hard: Smz3Settings = { ...DEFAULT_SETTINGS, smLogic: "hard" };
    const terminatorGauntlet = locationId("Energy Tank, Gauntlet");
    const items = { bombs: 1, morph: 1 };
    const at = (settings: Smz3Settings) =>
      solve(compile(settings), toState(items, NO_PADS, settings)).location(
        terminatorGauntlet,
      );
    expect(at(DEFAULT_SETTINGS)).toBe("no");
    expect(at(hard)).toBe("yes");
    // With keysanity, the gauntlet's keycard is the player's to find
    expect(at({ ...hard, keysanity: true })).toBe("no");
    expect(rules(true)).toBeDefined();
    expect(world(hard).regions.length).toBe(41);
  });
});

describe("the state's facts", () => {
  it("derive Palace of Darkness's and Ice Palace's facts from the items", () => {
    expect(derivedFacts({})).toEqual({
      ipNoBigKey: 1,
      podNoHammerBow: 1,
      podNoHammerBowLamp: 1,
    });
    expect(derivedFacts({ bigKeyIP: 1, bow: 1, hammer: 1, lamp: 1 })).toEqual({
      ipNoBigKey: 0,
      podNoHammerBow: 0,
      podNoHammerBowLamp: 0,
    });
  });

  it("carry what the player knows of each pad", () => {
    expect(medallionFacts({ mire: "bombos", turtleRock: "unknown" })).toEqual({
      mireIsBombos: 1,
      turtleRockUnknown: 1,
    });
    expect(medallionFacts({})).toEqual({});
  });
});

describe("the items", () => {
  it("name upstream's types as the state does", () => {
    expect(fromUpstream("ProgressiveSword")).toBe("sword");
    expect(fromUpstream("MoonPearl")).toBe("moonPearl");
    expect(fromUpstream("ETank")).toBe("eTank");
    expect(fromUpstream("Bugnet")).toBeUndefined();
    expect(stateFromUpstream({ ETank: 20, Missile: 2 })).toEqual({
      eTank: 14,
      missile: 2,
    });
    expect(() => stateFromUpstream({ Bugnet: 1 })).toThrow(RangeError);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });
});

describe("the settings", () => {
  it("leave every placement unknown in a run, and set them as known", () => {
    const setting = placementSetting("Thieves' Town - Big Chest", "KeyTT");
    expect(engineSettings(DEFAULT_SETTINGS)[setting]).toEqual({
      unknown: true,
    });
    expect(
      engineSettings(DEFAULT_SETTINGS, { placed: new Set([setting]) })[setting],
    ).toBe(true);
    expect(() => placementSetting("Link's House", "KeyTT")).toThrow(RangeError);
    expect(
      PLACEMENT_LOCATIONS.has(locationId("Thieves' Town - Big Chest")),
    ).toBe(true);
  });

  it("take Ganon's Tower's boss tokens from its crystals, as upstream rounds them", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      tourianBosses: 3,
      towerCrystals: 5,
    };
    expect(engineSettings(settings).gtBossTokens).toBe(2);
  });
});

describe("the world model", () => {
  it("names regions and locations as upstream's names", () => {
    expect(regionId("Thieves' Town")).toBe("thievesTown");
    expect(locationId("Missile (Crateria gauntlet right)")).toBe(
      "missile-crateria-gauntlet-right",
    );
    expect(pick({ hard: "a", normal: "b" }, true)).toBe("a");
    expect(pick("c", false)).toBe("c");
    expect(ifKeysanity("x", "y")).toBe(
      "(setting(keysanity) & (x) | !setting(keysanity) & (y))",
    );
    expect(buildWorld([], { hard: false }).regions).toHaveLength(1);
  });
});
