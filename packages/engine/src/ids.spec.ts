import { describe, expect, it } from "vitest";
import { locationId } from "./ids";

describe("locationId", () => {
  // Ids are save keys: each of these is one a player's save holds, in the
  // game packs' own names. A row that changes is a save migration.
  it.each([
    ["Tower of Hera - Big Key Chest", "tower-of-hera/big-key-chest"],
    ["King's Tomb", "kings-tomb"],
    ["Sewers - Secret Room - Left", "sewers/secret-room/left"],
    ["Hyrule Castle - Zelda's Cell", "hyrule-castle/zeldas-cell"],
    ["Thieves' Town - Blind's Cell", "thieves-town/blinds-cell"],
    ["Link's House", "links-house"],
    ["Eastern Palace - Big Chest", "eastern-palace/big-chest"],
    ["Palace of Darkness - Big Key Chest", "palace-of-darkness/big-key-chest"],
    ["Energy Tank, Gauntlet", "energy-tank-gauntlet"],
    ["Missile (Crateria gauntlet right)", "missile-crateria-gauntlet-right"],
    ["Morphing Ball", "morphing-ball"],
    ["Ganon’s Tower - Big Key Room - Left", "ganons-tower/big-key-room/left"],
    ["  Odd -- Name! ", "odd-name"],
    ["", ""],
  ])("%j is %j", (name, id) => {
    expect(locationId(name)).toBe(id);
  });

  it("is the same id however it is run twice", () => {
    expect(locationId(locationId("King's Tomb"))).toBe("kings-tomb");
  });
});
