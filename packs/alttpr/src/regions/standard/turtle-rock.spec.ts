// The branches of Turtle Rock that upstream's tests cannot reach: they run
// in a world with no item placement, the lamp rule on, no wild dungeon
// items and swords, and they place nothing in the dungeon. The contract
// covers the rest (test/contract.spec.ts).
//
// The dungeon is solved on its own, its ways in taken from stand-ins for
// the Death Mountain regions that are open from the start: what those need
// is their own modules' to test.
import {
  type CompiledWorld,
  compileWorld,
  loadRules,
  type Solution,
  type State,
  solve,
} from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { ITEMS } from "../../items";
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
import { TURTLE_ROCK } from "./turtle-rock";

const standIn = (file: string, id: string): RegionModule => ({
  file: `app/Region/Standard/${file}.php`,
  regions: [
    {
      entrances: [{ from: "start", req: "true", source: "game" }],
      id,
      locations: [],
    },
  ],
});

const NEIGHBOURS = [
  standIn("LightWorld/DeathMountain/West", "westDeathMountain"),
  standIn("LightWorld/DeathMountain/East", "eastDeathMountain"),
  standIn("DarkWorld/DeathMountain/East", "eastDarkWorldDeathMountain"),
];

const worlds = new Map<AlttprSettings, CompiledWorld>();
const solved = (settings: AlttprSettings, state: State): Solution => {
  let world = worlds.get(settings);
  if (world === undefined) {
    world = compileWorld(
      buildWorld([...NEIGHBOURS, TURTLE_ROCK]),
      loadRules(RULES),
      { items: STATE_NAMES, settings },
    );
    worlds.set(settings, world);
  }
  return solve(world, state);
};
const at = (settings: AlttprSettings, state: State, id: string) =>
  solved(settings, state).location(id);

const BASIC = settingsFromUpstream("open", { itemPlacement: "basic" });

/** In by the pad: the pegs hammered, the dark rock lifted, Quake and a sword. */
const IN = {
  ...medallionFacts({ turtleRock: "quake" }),
  caneOfSomaria: 1,
  glove: 2,
  hammer: 1,
  moonPearl: 1,
  quake: 1,
  rescueZelda: 1,
  sword: 1,
} as const;
/** The basic placement's health gate: a better sword, 12 hearts, armor. */
const HEALTHY = { armor: 1, heartContainer: 11, pieceOfHeart: 4, sword: 2 };
/** The eye bridge, from the upper way in. */
const BRIDGE = {
  ...IN,
  bigKeyD7: 1,
  keyD7: 3,
  lamp: 1,
} as const;
const KILL = {
  ...IN,
  bigKeyD7: 1,
  fireRod: 1,
  iceRod: 1,
  keyD7: 4,
  lamp: 1,
} as const;

const COMPASS = "turtle-rock/compass-chest";
const BOSS = "turtle-rock/boss";
const EYE_BRIDGE = [
  "turtle-rock/eye-bridge/bottom-left",
  "turtle-rock/eye-bridge/bottom-right",
  "turtle-rock/eye-bridge/top-left",
  "turtle-rock/eye-bridge/top-right",
];

describe("Turtle Rock", () => {
  it("is entered by the pad, with its medallion and a sword", () => {
    expect(at(OPEN, IN, COMPASS)).toBe("yes");
    expect(at(OPEN, { ...IN, hammer: 0 }, COMPASS)).toBe("no");
    expect(at(OPEN, { ...IN, glove: 1 }, COMPASS)).toBe("no");
    expect(at(OPEN, { ...IN, bombos: 1, quake: 0 }, COMPASS)).toBe("no");
    const unknown = {
      ...IN,
      ...medallionFacts({ turtleRock: "unknown" }),
      turtleRockIsQuake: 0,
    };
    expect(at(OPEN, unknown, COMPASS)).toBe("maybe");
    expect(at(OPEN, { ...IN, sword: 0 }, COMPASS)).toBe("no");
    const swordless = settingsFromUpstream("open", {
      "mode.weapons": "swordless",
    });
    expect(at(swordless, { ...IN, sword: 0 }, COMPASS)).toBe("yes");
  });

  it("asks the basic placement for a better sword, 12 hearts and armor or two bottles", () => {
    expect(at(BASIC, IN, COMPASS)).toBe("no");
    expect(at(BASIC, { ...IN, ...HEALTHY }, COMPASS)).toBe("yes");
    const bottles = { ...IN, ...HEALTHY, armor: 0, bottle: 2 };
    expect(at(BASIC, bottles, COMPASS)).toBe("yes");
    expect(at(BASIC, { ...IN, ...HEALTHY, sword: 1 }, COMPASS)).toBe("no");
    const swordless = settingsFromUpstream("open", {
      itemPlacement: "basic",
      "mode.weapons": "swordless",
    });
    expect(at(swordless, { ...IN, ...HEALTHY, sword: 0 }, COMPASS)).toBe("yes");
  });

  it("has no NoGlitches middle or lower way in", () => {
    const everything: State = {
      ...Object.fromEntries(ITEMS.map(({ id, max }) => [id, max])),
      ...medallionFacts({ turtleRock: "quake" }),
    };
    for (const settings of [OPEN, UPSTREAM_TEST, BASIC]) {
      const solution = solved(settings, everything);
      expect(solution.region("turtleRockUpper")).toBe("yes");
      expect(solution.region("turtleRockMiddle")).toBe("no");
      expect(solution.region("turtleRockLower")).toBe("no");
      expect(solution.region("turtleRock")).toBe("yes");
    }
  });

  it("wants four small keys at the big key chest with wild keys, unless it holds a key", () => {
    const bigKeyChest = "turtle-rock/big-key-chest";
    const wild = settingsFromUpstream("open", { dungeonItems: "full" });
    expect(at(OPEN, { ...IN, keyD7: 2 }, bigKeyChest)).toBe("yes");
    expect(at(OPEN, { ...IN, keyD7: 1 }, bigKeyChest)).toBe("no");
    expect(at(wild, { ...IN, keyD7: 2 }, bigKeyChest)).toBe("maybe");
    expect(at(wild, { ...IN, keyD7: 3 }, bigKeyChest)).toBe("maybe");
    expect(at(wild, { ...IN, keyD7: 4 }, bigKeyChest)).toBe("yes");
    expect(at(wild, { ...IN, keyD7: 1 }, bigKeyChest)).toBe("no");
  });

  it("asks the basic placement for a guard against the eye bridge's lasers", () => {
    const healthy = { ...BRIDGE, ...HEALTHY };
    const noMirrorShield = settingsFromUpstream("open", {
      "item.overflow.count.Shield": 2,
      itemPlacement: "basic",
    });
    for (const id of EYE_BRIDGE) {
      expect(at(OPEN, BRIDGE, id)).toBe("yes");
      expect(at(UPSTREAM_TEST, BRIDGE, id)).toBe("yes");
      expect(at(BASIC, healthy, id)).toBe("no");
      expect(at(BASIC, { ...healthy, cape: 1 }, id)).toBe("yes");
      expect(at(BASIC, { ...healthy, caneOfByrna: 1 }, id)).toBe("yes");
      expect(at(BASIC, { ...healthy, shield: 3 }, id)).toBe("yes");
      expect(at(BASIC, { ...healthy, shield: 2 }, id)).toBe("no");
      expect(at(noMirrorShield, { ...healthy, shield: 3 }, id)).toBe("no");
      expect(at(OPEN, { ...BRIDGE, keyD7: 2 }, id)).toBe("no");
    }
  });

  it("asks for no lamp at the boss and the bridge when the customizer drops the rule", () => {
    const noLamp = settingsFromUpstream("open", { "item.require.Lamp": 0 });
    expect(at(noLamp, { ...KILL, lamp: 0 }, BOSS)).toBe("yes");
    expect(at(OPEN, { ...KILL, lamp: 0 }, BOSS)).toBe("no");
    expect(at(OPEN, KILL, BOSS)).toBe("yes");
    for (const id of EYE_BRIDGE) {
      expect(at(noLamp, { ...BRIDGE, lamp: 0 }, id)).toBe("yes");
      expect(at(OPEN, { ...BRIDGE, lamp: 0 }, id)).toBe("no");
    }
  });

  it("wants the map and compass with wild ones, which the boss may hold itself", () => {
    const mc = settingsFromUpstream("open", { dungeonItems: "mc" });
    expect(at(mc, KILL, BOSS)).toBe("maybe");
    expect(at(mc, { ...KILL, compassD7: 1 }, BOSS)).toBe("maybe");
    expect(at(mc, { ...KILL, compassD7: 1, mapD7: 1 }, BOSS)).toBe("yes");
  });

  it("gives its crystal exactly when its boss falls", () => {
    const states: State[] = [
      {},
      IN,
      KILL,
      { ...KILL, keyD7: 3 },
      { ...KILL, lamp: 0 },
      { ...KILL, compassD7: 1, mapD7: 1 },
    ];
    const mc = settingsFromUpstream("open", { dungeonItems: "mc" });
    for (const settings of [OPEN, UPSTREAM_TEST, BASIC, mc]) {
      for (const state of states) {
        expect(at(settings, state, "turtle-rock/prize")).toBe(
          at(settings, state, BOSS),
        );
      }
    }
  });
});
