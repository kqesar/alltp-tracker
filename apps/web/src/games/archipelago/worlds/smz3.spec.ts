import { describe, expect, it } from "vitest";
import {
  NO_PROBLEM,
  skinProblems,
  worldNames,
} from "@/games/archipelago/fixtures";
import {
  countsOf,
  type ItemCell,
  rowsOf,
} from "@/games/archipelago/worlds/skin";
import { SMZ3_SKIN } from "@/games/archipelago/worlds/smz3";

const DUNGEONS = ["EP", "DP", "TH", "PD", "SP", "SW", "TT", "IP", "MM", "TR"];

/**
 * SMZ3's progression items, as AP 0.6.8's worlds/smz3/__init__.py (commit
 * 54803be0) classes them in `create_items`: the progression pool
 * (TotalSMZ3/Item.py, `CreateProgressionPool`) and the dungeon pool in
 * either key mode (`CreateDungeonPool`: keys, maps, compasses), then under
 * keysanity the keycards (`CreateKeycards`) and Super Metroid's maps
 * (`CreateSmMaps`).
 */
const PROGRESSION = [
  ...["ProgressiveShield", "ProgressiveSword", "Bow", "Hookshot", "Mushroom"],
  ...["Powder", "Firerod", "Icerod", "Bombos", "Ether", "Quake", "Lamp"],
  ...["Hammer", "Shovel", "Flute", "Bugnet", "Book", "Bottle", "Somaria"],
  ...["Byrna", "Cape", "Mirror", "Boots", "ProgressiveGlove", "Flippers"],
  ...["MoonPearl", "HalfMagic"],
  ...["Grapple", "Charge", "Ice", "Wave", "Plasma", "Varia", "Gravity"],
  ...["Morph", "Bombs", "SpringBall", "ScrewAttack", "HiJump", "SpaceJump"],
  ...["SpeedBooster", "Missile", "Super", "PowerBomb", "ETank"],
  "ReserveTank",
  ...["BigKeyGT", "KeyGT", "MapGT", "CompassGT"],
  ...DUNGEONS.map((short) => `BigKey${short}`),
  ...["HC", "CT", ...DUNGEONS.filter((d) => d !== "EP")].map((s) => `Key${s}`),
  ...DUNGEONS.map((short) => `Map${short}`),
  "MapHC",
  ...DUNGEONS.map((short) => `Compass${short}`),
  ...["Crateria", "Brinstar", "Norfair", "Maridia"].flatMap((area) =>
    ["L1", "L2", "Boss"].map((level) => `Card${area}${level}`),
  ),
  ...["WreckedShip", "LowerNorfair"].flatMap((area) =>
    ["L1", "Boss"].map((level) => `Card${area}${level}`),
  ),
  ...["Brinstar", "WreckedShip", "Maridia", "LowerNorfair"].map(
    (area) => `SmMap${area}`,
  ),
];

const names = worldNames("SMZ3");

/** Counts of these items. */
const holding = (held: Record<string, number>) =>
  countsOf(
    Object.entries(held).map(([name, count]) => ({ count, flags: 1, name })),
  );

/** A cell's level, words and sprite, holding these items. */
const levelOf = (id: string, held: Record<string, number>) => {
  const found = SMZ3_SKIN.cells.find(
    (c): c is ItemCell => c.id === id && c.kind === "item",
  );
  if (found === undefined) throw new Error(`No cell ${id}`);
  const level = found.level(holding(held));
  return [level, found.describe(level), found.sprite(level)];
};

describe("the SMZ3 skin, against AP 0.6.8's name data", () => {
  it("maps TotalSMZ3's names, every progression item a cell or an exclusion", () => {
    expect(names.checksum).toBe("12f632000dfc0e2bb4404146d4c9121e830b9b8f");
    expect(PROGRESSION).toHaveLength(112);
    expect(skinProblems(SMZ3_SKIN, names, PROGRESSION)).toEqual(NO_PROBLEM);
    // Only the dungeons' maps and compasses are left to the list
    expect(Object.keys(SMZ3_SKIN.excluded)).toHaveLength(23);
  });

  it("lays A Link to the Past's six rows, Super Metroid's three", () => {
    const ids = rowsOf(SMZ3_SKIN).map((row) => row.map((cell) => cell.id));
    expect(ids).toHaveLength(9);
    expect(ids[0]).toEqual([
      "flute",
      "hookshot",
      "hammer",
      "firerod",
      "icerod",
      "boomerang",
      "net",
    ]);
    expect(ids[6]?.[0]).toBe("charge");
  });

  it("adds the keycards' row once the slot holds a card or a map", () => {
    expect(rowsOf(SMZ3_SKIN, holding({ KeyGT: 2 }))).toHaveLength(9);
    const rows = rowsOf(SMZ3_SKIN, holding({ CardNorfairBoss: 1 }));
    expect(rows).toHaveLength(10);
    expect(rows[9]?.map((cell) => cell.id)).toEqual([
      "cards-cr",
      "cards-br",
      "cards-no",
      "cards-ma",
      "cards-ws",
      "cards-ln",
      "smmaps",
    ]);
    expect(rowsOf(SMZ3_SKIN, holding({ SmMapMaridia: 1 }))).toHaveLength(10);
    const ws = SMZ3_SKIN.cells.find((cell) => cell.id === "cards-ws");
    expect(ws?.kind === "cards" && ws.cards.map((card) => card.name)).toEqual([
      "CardWreckedShipL1",
      "CardWreckedShipBoss",
    ]);
  });

  it("keys each dungeon as its pool holds them", () => {
    const keys = (id: string) => SMZ3_SKIN.cells.find((cell) => cell.id === id);
    expect(keys("keys-ep")).toMatchObject({ big: "BigKeyEP" });
    expect(keys("keys-ep")).not.toHaveProperty("small");
    expect(keys("keys-hc")).toMatchObject({ small: "KeyHC" });
    expect(keys("keys-hc")).not.toHaveProperty("big");
    expect(keys("keys-gt")).toMatchObject({ big: "BigKeyGT", small: "KeyGT" });
  });

  it("puts every location in one of TotalSMZ3's regions", () => {
    const groups = SMZ3_SKIN.groups ?? {};
    expect(Object.keys(groups)).toHaveLength(40);
    expect(groups["Castle Tower"]).toEqual([
      "Castle Tower - Foyer",
      "Castle Tower - Dark Maze",
    ]);
  });
});

describe("an SMZ3 cell", () => {
  it("levels both games' items by AP's names", () => {
    expect(levelOf("sword", { ProgressiveSword: 3 })).toEqual([
      3,
      "Tempered Sword",
      "sword3.png",
    ]);
    expect(levelOf("mail", {})).toEqual([0, "Green Mail", "tunic1.png"]);
    expect(levelOf("bow", { SilverArrows: 1 })[1]).toBe("Silver Arrows only");
    expect(levelOf("bottle", { Bottle: 1, BottleWithBee: 2 })[0]).toBe(3);
    expect(levelOf("etank", { ETank: 4 })).toEqual([
      4,
      "4 received",
      { frame: 0 },
    ]);
    expect(levelOf("smmaps", { SmMapBrinstar: 1 })[2]).toBe("dungeonmap.png");
  });
});
