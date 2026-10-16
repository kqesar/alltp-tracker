// The branches of Ganon's Tower that upstream's tests cannot reach: they run
// in a world with no item placement and seven crystals for the tower, and
// they place nothing in the dungeon. The contract covers the rest
// (test/contract.spec.ts).
//
// The tower is solved on its own, entered from a stand-in for East Dark
// World Death Mountain that is open from the start: what the mountain needs
// is its own module's to test.
import {
  type CompiledWorld,
  compileWorld,
  loadRules,
  type State,
  solve,
  type Tri,
} from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { ITEM_IDS } from "../../items";
import { MEDALLION_FACTS } from "../../medallions";
import { RULES } from "../../rules";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../../settings";
import { buildWorld, type RegionModule } from "../../world";
import { GANONS_TOWER } from "./ganons-tower";

const MOUNTAIN: RegionModule = {
  file: "app/Region/Standard/DarkWorld/DeathMountain/East.php",
  regions: [
    {
      entrances: [{ from: "start", req: "true", source: "game" }],
      id: "eastDarkWorldDeathMountain",
      locations: [],
      name: "East Dark World Death Mountain",
    },
  ],
};

const worlds = new Map<AlttprSettings, CompiledWorld>();
const at = (settings: AlttprSettings, state: State, id: string): Tri => {
  let world = worlds.get(settings);
  if (world === undefined) {
    world = compileWorld(
      buildWorld([MOUNTAIN, GANONS_TOWER]),
      loadRules(RULES),
      { items: [...ITEM_IDS, ...MEDALLION_FACTS], settings },
    );
    worlds.set(settings, world);
  }
  return solve(world, state).location(id);
};

const BASIC = settingsFromUpstream("open", { itemPlacement: "basic" });

const CRYSTALS = {
  crystal1: 1,
  crystal2: 1,
  crystal3: 1,
  crystal4: 1,
  crystal5: 1,
  crystal6: 1,
  crystal7: 1,
} as const;
const IN = { ...CRYSTALS, moonPearl: 1, rescueZelda: 1 } as const;
/** The basic placement's health gate: a better sword, 12 hearts, armor. */
const HEALTHY = { armor: 1, heartContainer: 11, pieceOfHeart: 4, sword: 2 };

const HOPE_ROOM = "ganons-tower/hope-room/left";

describe("Ganon's Tower", () => {
  it("opens with the crystals crystals.tower asks for", () => {
    expect(at(OPEN, IN, HOPE_ROOM)).toBe("yes");
    expect(at(OPEN, { ...IN, crystal7: 0 }, HOPE_ROOM)).toBe("no");
    expect(at(OPEN, { ...IN, moonPearl: 0 }, HOPE_ROOM)).toBe("no");
    const three = settingsFromUpstream("open", { "crystals.tower": 3 });
    const some = { crystal2: 1, crystal5: 1, moonPearl: 1, rescueZelda: 1 };
    expect(at(three, some, HOPE_ROOM)).toBe("no");
    expect(at(three, { ...some, crystal6: 1 }, HOPE_ROOM)).toBe("yes");
    const none = settingsFromUpstream("open", { "crystals.tower": 0 });
    expect(at(none, { moonPearl: 1, rescueZelda: 1 }, HOPE_ROOM)).toBe("yes");
  });

  it("asks the basic placement for a better sword, 12 hearts and armor or two bottles", () => {
    expect(at(BASIC, IN, HOPE_ROOM)).toBe("no");
    expect(at(BASIC, { ...IN, ...HEALTHY }, HOPE_ROOM)).toBe("yes");
    const bottles = { ...IN, ...HEALTHY, armor: 0, bottle: 2 };
    expect(at(BASIC, bottles, HOPE_ROOM)).toBe("yes");
    expect(at(BASIC, { ...IN, ...HEALTHY, sword: 1 }, HOPE_ROOM)).toBe("no");
    const swordless = settingsFromUpstream("open", {
      itemPlacement: "basic",
      "mode.weapons": "swordless",
    });
    expect(at(swordless, { ...IN, ...HEALTHY, sword: 0 }, HOPE_ROOM)).toBe(
      "yes",
    );
  });

  it("reaches the map chest with the boots instead of the hookshot, except in the basic placement", () => {
    const map = "ganons-tower/map-chest";
    const boots = { ...IN, ...HEALTHY, hammer: 1, keyA2: 4, pegasusBoots: 1 };
    expect(at(OPEN, boots, map)).toBe("yes");
    expect(at(UPSTREAM_TEST, boots, map)).toBe("yes");
    expect(at(BASIC, boots, map)).toBe("no");
    expect(at(BASIC, { ...boots, hookshot: 1 }, map)).toBe("yes");
  });

  it("asks the basic placement for the Fire Rod, or Ether and a sword, at Bob's Chest", () => {
    const bobs = "ganons-tower/bobs-chest";
    const there = { ...IN, ...HEALTHY, hammer: 1, hookshot: 1, keyA2: 3 };
    expect(at(OPEN, there, bobs)).toBe("yes");
    expect(at(BASIC, there, bobs)).toBe("no");
    expect(at(BASIC, { ...there, ether: 1 }, bobs)).toBe("yes");
    expect(at(BASIC, { ...there, fireRod: 1 }, bobs)).toBe("yes");
    expect(at(OPEN, { ...there, keyA2: 2 }, bobs)).toBe("no");
  });

  it("maybe opens a room with one key fewer, if the keys sit where it says", () => {
    const west = { ...IN, hammer: 1, hookshot: 1 };
    const east = { ...IN, caneOfSomaria: 1, fireRod: 1 };
    const rooms: [string, State, number][] = [
      ["ganons-tower/randomizer-room/top-left", west, 4],
      ["ganons-tower/randomizer-room/bottom-right", west, 4],
      ["ganons-tower/firesnake-room", west, 3],
      ["ganons-tower/map-chest", west, 4],
      ["ganons-tower/compass-room/top-left", east, 4],
      ["ganons-tower/compass-room/bottom-right", east, 4],
    ];
    for (const [id, state, keys] of rooms) {
      expect(at(OPEN, { ...state, keyA2: keys }, id), id).toBe("yes");
      expect(at(OPEN, { ...state, keyA2: keys - 1 }, id), id).toBe("maybe");
      expect(at(OPEN, { ...state, keyA2: keys - 2 }, id), id).toBe("no");
    }
  });

  it("falls to Agahnim 2 past the Moldorm Chest", () => {
    const top = {
      ...IN,
      bigKeyA2: 1,
      bow: 1,
      hookshot: 1,
      keyA2: 4,
      lamp: 1,
    } as const;
    const moldorm = "ganons-tower/moldorm-chest";
    // The bow beats Lanmolas, not Moldorm nor Agahnim 2
    expect(at(OPEN, top, moldorm)).toBe("no");
    expect(at(OPEN, top, "agahnim-2")).toBe("no");
    expect(at(OPEN, { ...top, hammer: 1 }, moldorm)).toBe("yes");
    expect(at(OPEN, { ...top, hammer: 1 }, "agahnim-2")).toBe("yes");
    expect(at(OPEN, { ...top, sword: 1 }, "agahnim-2")).toBe("yes");
    expect(at(OPEN, { ...top, hammer: 1, keyA2: 3 }, "agahnim-2")).toBe("no");
  });
});
