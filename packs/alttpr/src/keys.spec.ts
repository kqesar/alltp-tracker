// Where the dungeons' items can sit: golden cases read from the region files'
// rules, and the dungeon lock.
import { describe, expect, it } from "vitest";
import { filler } from "./fill";
import { ITEMS, STATE_MAX } from "./items";
import {
  everything,
  everythingBut,
  possibleLocations,
  withUntracked,
} from "./keys";
import { compile, regionModules } from "./pack";
import {
  type AlttprSettings,
  OPEN,
  STANDARD,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "./settings";

const fillers = new Map<AlttprSettings, ReturnType<typeof filler>>();
function fillerOf(settings: AlttprSettings) {
  let found = fillers.get(settings);
  if (found === undefined) {
    found = filler(compile(settings), settings);
    fillers.set(settings, found);
  }
  return found;
}
function where(item: string, settings: AlttprSettings = OPEN): string[] {
  return possibleLocations(fillerOf(settings), item);
}

describe("everything", () => {
  it("holds every item at its count in the pool, the pre-collected beside it, and opens both pads", () => {
    const all = everything(UPSTREAM_TEST);
    // No shop sells an arrow or a key outside the retro world
    const shop = (id: string) => id === "shopArrow" || id === "shopKey";
    for (const { id } of ITEMS)
      expect(all[id], id).toBe(shop(id) ? 0 : STATE_MAX.get(id));
    // Link's 3 starting hearts beside the pool's 11 (RandomAssumed.php:86)
    expect(all.heartContainer).toBe(14);
    expect(everything(settingsFromUpstream("retro"))).toMatchObject({
      shopArrow: 1,
      shopKey: 1,
    });
    expect(all).toMatchObject({ mireUnknown: 1, turtleRockUnknown: 1 });
    // With the hammer, a bow and the lamp, Palace of Darkness wants six keys
    expect(all.podFewerKeysSuffice).toBe(0);
  });

  it("loses one of an item, or a level, and redoes the facts", () => {
    expect(everythingBut("KeyD1", OPEN).keyD1).toBe(5);
    expect(everythingBut("BigKeyD1", OPEN).bigKeyD1).toBe(0);
    expect(everythingBut("TitansMitt", OPEN).glove).toBe(1);
    expect(everythingBut("ProgressiveGlove", OPEN).glove).toBe(1);
    expect(everythingBut("Hammer", OPEN).podFewerKeysSuffice).toBe(1);
    // An item no rule reads changes nothing
    expect(everythingBut("TwentyRupees", OPEN)).toEqual(everything(OPEN));
  });
});

describe("possibleLocations", () => {
  it("leaves out the locations that need the item itself", () => {
    // The Big Key Chest and Compass Chest are behind the one key door, the
    // boss's fill rules refuse the palace's key and big key
    expect(where("KeyP2")).toEqual([
      "desert-palace/big-chest",
      "desert-palace/map-chest",
      "desert-palace/torch",
    ]);
    expect(where("BigKeyP2")).toEqual([
      "desert-palace/map-chest",
      "desert-palace/torch",
      "desert-palace/big-key-chest",
      "desert-palace/compass-chest",
    ]);
  });

  it("keeps an always-allowed spot, though the item locks it", () => {
    expect(where("KeyP3")).toContain("tower-of-hera/big-key-chest");
    expect(where("BigKeyD2")).toContain("swamp-palace/big-chest");
    const strict = settingsFromUpstream("open", { accessibility: "locations" });
    expect(where("KeyP3", strict)).not.toContain("tower-of-hera/big-key-chest");
  });

  it("follows the fill rules: Swamp Palace's key sits at its entrance", () => {
    expect(where("KeyD2")).toEqual(["swamp-palace/entrance"]);
    expect(where("BigKeyD2")).not.toContain("swamp-palace/entrance");
    expect(where("KeyA2")).not.toContain("ganons-tower/moldorm-chest");
    expect(where("BigKeyA2")).not.toContain("ganons-tower/big-chest");
  });

  it("reads each world's escape: Standard keeps the sewers key past its door", () => {
    expect(where("KeyH2", STANDARD)).toEqual([
      "sewers/dark-cross",
      "hyrule-castle/boomerang-chest",
      "hyrule-castle/map-chest",
      "hyrule-castle/zeldas-cell",
    ]);
    expect(where("KeyH2", OPEN)).toEqual([
      "sanctuary",
      "sewers/secret-room/left",
      "sewers/secret-room/middle",
      "sewers/secret-room/right",
      "sewers/dark-cross",
      "hyrule-castle/map-chest",
    ]);
  });

  it("keeps a dungeon's items in it, and lets a wild class out", () => {
    const own = (settings: AlttprSettings, item: string) =>
      regionModules(settings)
        .flatMap((m) => m.regions)
        .filter((r) => r.regionItems?.items.includes(item))
        .flatMap((r) => r.locations.map((l) => l.id));
    for (const settings of [OPEN, STANDARD]) {
      for (const region of regionModules(settings).flatMap((m) => m.regions)) {
        for (const item of region.regionItems?.items ?? []) {
          if (!/^(Big)?Key[A-Z]/.test(item)) continue;
          const found = where(item, settings);
          expect(found.length, item).toBeGreaterThan(0);
          for (const location of found) {
            expect(own(settings, item), `${item} at ${location}`).toContain(
              location,
            );
          }
        }
      }
    }
    const wild = settingsFromUpstream("open", { dungeonItems: "full" });
    expect(where("KeyD1", wild)).toContain("kings-tomb");
    expect(where("BigKeyD1", wild)).toContain("kings-tomb");
  });
});

describe("withUntracked", () => {
  it("holds every key and big key the player does not track, at its count", () => {
    const held = withUntracked(fillerOf(OPEN), { hammer: 1, keyD1: 2 });
    expect(held).toMatchObject({
      bigKeyA2: 1,
      bigKeyD1: 1,
      hammer: 1,
      keyA2: 4,
      keyD1: 6,
      keyH2: 1,
    });
    // Maps and compasses stay in their dungeons and no rule wants them
    expect(held).not.toHaveProperty("mapD1");
  });

  it("adds nothing in keysanity, where the player tracks them all", () => {
    const wild = settingsFromUpstream("open", { dungeonItems: "full" });
    expect(withUntracked(fillerOf(wild), { keyD1: 2 })).toEqual({ keyD1: 2 });
  });
});
