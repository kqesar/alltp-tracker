// Location::canFill beyond the upstream fill cases, which all hold every
// item but the one placed (test/contract.spec.ts runs those): each part of
// the rule on its own, with fewer items and other settings.
import type { State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { loadLocationIndex } from "../test/fixtures";
import { derivedFacts } from "./derived";
import { EVENT_LOCATIONS, filler, matches, PRIZE_ITEMS } from "./fill";
import { UPSTREAM_ITEMS } from "./items";
import { everything } from "./keys";
import { locationId } from "./location";
import { compile } from "./pack";
import {
  type AlttprSettings,
  OPEN,
  STANDARD,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "./settings";

/** Everything, with some counts changed and the derived facts redone. */
function held(settings: AlttprSettings, changes: State = {}): State {
  const items = { ...everything(settings), ...changes };
  return { ...items, ...derivedFacts(items, settings) };
}

const fill = (settings: AlttprSettings) =>
  filler(compile(settings), settings).canFill;

const LOCATIONS_ACCESSIBILITY = settingsFromUpstream("standard", {
  accessibility: "locations",
});
const WILD_KEYS = settingsFromUpstream("standard", { "region.wildKeys": true });
const NO_BOSS_ITEMS = settingsFromUpstream("standard", {
  "region.bossNormalLocation": false,
});
const BASIC = settingsFromUpstream("open", { itemPlacement: "basic" });

describe("canFill", () => {
  const canFill = fill(UPSTREAM_TEST);

  it("lets a prize or a medallion pad hold only what setItem takes", () => {
    const all = held(UPSTREAM_TEST);
    expect(canFill("eastern-palace/prize", "Crystal5", all)).toBe("yes");
    expect(canFill("eastern-palace/prize", "PendantOfPower", all)).toBe("yes");
    expect(canFill("eastern-palace/prize", "BigKeyP1", all)).toBe("no");
    expect(canFill("eastern-palace/prize", "RescueZelda", all)).toBe("no");
    expect(canFill("agahnim", "DefeatAgahnim", all)).toBe("yes");
    expect(canFill("agahnim", "Crystal1", all)).toBe("no");
    expect(canFill("misery-mire-medallion", "Ether", all)).toBe("yes");
    expect(canFill("misery-mire-medallion", "Hammer", all)).toBe("no");
  });

  it("keeps a dungeon's items in it, unless their class is wild", () => {
    const all = held(UPSTREAM_TEST, { keyD1: 5 });
    expect(canFill("palace-of-darkness/shooter-room", "KeyD1", all)).toBe(
      "yes",
    );
    expect(canFill("kings-tomb", "KeyD1", all)).toBe("no");
    expect(canFill("eastern-palace/map-chest", "KeyD1", all)).toBe("no");
    expect(fill(WILD_KEYS)("kings-tomb", "KeyD1", held(WILD_KEYS))).toBe("yes");
  });

  it("asks that Link reach the location with the item in it", () => {
    const noBook = held(UPSTREAM_TEST, { bookOfMudora: 0, magicMirror: 0 });
    expect(canFill("desert-palace/map-chest", "Hammer", noBook)).toBe("no");
    expect(
      canFill("desert-palace/map-chest", "Hammer", held(UPSTREAM_TEST)),
    ).toBe("yes");
    // A dungeon item, beside its region's rule, wants the access too
    const noKey = held(UPSTREAM_TEST, { keyP2: 0 });
    expect(canFill("desert-palace/compass-chest", "BigKeyP2", noKey)).toBe(
      "no",
    );
  });

  it("lets an always-allowed item past the lock and the access", () => {
    // Tower of Hera's key may lock itself in the Big Key Chest, which it opens
    const noKey = held(UPSTREAM_TEST, { keyP3: 0 });
    expect(canFill("tower-of-hera/big-key-chest", "KeyP3", noKey)).toBe("yes");
    expect(canFill("tower-of-hera/big-key-chest", "Lamp", noKey)).toBe("no");
    // Unless every location must be reachable: then it is refused
    expect(
      fill(LOCATIONS_ACCESSIBILITY)(
        "tower-of-hera/big-key-chest",
        "KeyP3",
        held(LOCATIONS_ACCESSIBILITY, { keyP3: 0 }),
      ),
    ).toBe("no");
    // Thieves' Town's key, in its Big Chest, once the hammer is held
    const noTownKey = held(UPSTREAM_TEST, { keyD4: 0 });
    expect(canFill("thieves-town/big-chest", "KeyD4", noTownKey)).toBe("yes");
    expect(
      canFill("thieves-town/big-chest", "KeyD4", { ...noTownKey, hammer: 0 }),
    ).toBe("no");
  });

  it("refuses what the fill rules refuse, under their settings", () => {
    const all = held(UPSTREAM_TEST);
    // Desert Palace's boss never holds the palace's own key or big key
    expect(canFill("desert-palace/boss", "KeyP2", all)).toBe("no");
    expect(canFill("desert-palace/boss", "MapP2", all)).toBe("yes");
    // A boss holds no dungeon item without region.bossNormalLocation, and
    // its compass and map are not always allowed then
    expect(canFill("eastern-palace/boss", "BigKeyP1", all)).toBe("yes");
    const plain = fill(NO_BOSS_ITEMS);
    const noBossItems = held(NO_BOSS_ITEMS);
    expect(plain("eastern-palace/boss", "BigKeyP1", noBossItems)).toBe("no");
    expect(plain("eastern-palace/boss", "CompassP1", noBossItems)).toBe("no");
    expect(plain("eastern-palace/boss", "Hammer", noBossItems)).toBe("yes");
    // Swamp Palace's entrance takes its key only, unless keys are wild
    expect(canFill("swamp-palace/entrance", "KeyD2", all)).toBe("yes");
    expect(canFill("swamp-palace/entrance", "Hookshot", all)).toBe("no");
    expect(fill(WILD_KEYS)("swamp-palace/entrance", "Hookshot", all)).toBe(
      "yes",
    );
    // The basic placement forces Skull Woods' key in the Pinball Room
    const basic = held(BASIC);
    expect(fill(BASIC)("skull-woods/pinball-room", "KeyD3", basic)).toBe("yes");
    expect(fill(BASIC)("skull-woods/pinball-room", "Hammer", basic)).toBe("no");
    expect(canFill("skull-woods/pinball-room", "Hammer", all)).toBe("yes");
  });

  it("reads a location's own item once it is placed there", () => {
    // Palace of Darkness's Big Key Chest: one key if it holds a key, else
    // six with the hammer, a bow and the lamp; never maybe once placed
    const fiveKeys = held(UPSTREAM_TEST, { keyD1: 5 });
    expect(
      canFill("palace-of-darkness/big-key-chest", "BigKeyD1", fiveKeys),
    ).toBe("no");
    expect(
      canFill("palace-of-darkness/big-key-chest", "BigKeyD1", {
        ...fiveKeys,
        keyD1: 6,
      }),
    ).toBe("yes");
    // Turtle Rock's Big Key Chest with wild keys: two if it holds the big
    // key, three a key, four anything else
    const wild = fill(WILD_KEYS);
    const two = held(WILD_KEYS, { keyD7: 2 });
    expect(wild("turtle-rock/big-key-chest", "BigKeyD7", two)).toBe("yes");
    expect(wild("turtle-rock/big-key-chest", "Hammer", two)).toBe("no");
    expect(
      wild("turtle-rock/big-key-chest", "Hammer", { ...two, keyD7: 4 }),
    ).toBe("yes");
    // Ice Palace's Spike Room without the hookshot: a key, the big key there
    const noHookshot = held(UPSTREAM_TEST, { hookshot: 0, keyD5: 1 });
    expect(canFill("ice-palace/spike-room", "BigKeyD5", noHookshot)).toBe(
      "yes",
    );
    // Elsewhere, the big key may sit in the Big Key Chest or the Map Chest
    expect(canFill("ice-palace/spike-room", "Hammer", noHookshot)).toBe(
      "maybe",
    );
  });

  it("reads what a tracker cannot know as maybe", () => {
    // Link's Uncle waits for the Sanctuary, by the order of the fill
    expect(fill(OPEN)("links-uncle", "Hammer", held(OPEN))).toBe("maybe");
    expect(fill(OPEN)("links-uncle", "KeyH2", held(OPEN))).toBe("no");
    expect(fill(STANDARD)("secret-passage", "Hammer", held(STANDARD))).toBe(
      "yes",
    );
    expect(fill(STANDARD)("secret-passage", "MapH2", held(STANDARD))).toBe(
      "no",
    );
  });

  it("takes a solution of the state, and names a location it lacks", () => {
    const world = compile(UPSTREAM_TEST);
    const f = filler(world, UPSTREAM_TEST);
    expect(f.locations).toContain("kings-tomb");
    expect(f.world).toBe(world);
    expect(() => f.canFill("nowhere", "Hammer", {})).toThrow(
      /No location "nowhere"/,
    );
  });
});

describe("matches", () => {
  it.each([
    [{ items: ["KeyD1"] }, "KeyD1", true],
    [{ items: ["KeyD1"] }, "KeyD2", false],
    [{ allBut: ["KeyD2"] }, "KeyD2", false],
    [{ allBut: ["KeyD2"] }, "Hammer", true],
    [{ classes: ["key"] }, "KeyD1", true],
    [{ classes: ["key"] }, "Key", true],
    [{ classes: ["key"] }, "BigKeyD1", false],
    [{ classes: ["bigKey", "map"] }, "MapP1", true],
    [{ classes: ["compass"] }, "Hammer", false],
  ] as const)("%j names %s: %s", (match, item, named) => {
    expect(matches(match, item)).toBe(named);
  });
});

describe("the item classes setItem takes", () => {
  it("are upstream items", () => {
    for (const item of Object.values(PRIZE_ITEMS).flat()) {
      expect(UPSTREAM_ITEMS.has(item), item).toBe(true);
    }
  });

  it("name upstream's Location\\Prize\\Event locations", () => {
    const events = loadLocationIndex()
      .locations.filter((l) => l.kind === "Prize\\Event")
      .map((l) => locationId(l.name));
    // Inverted builds Ganon again, in its own file
    expect([...EVENT_LOCATIONS].sort()).toEqual([...new Set(events)].sort());
  });
});
