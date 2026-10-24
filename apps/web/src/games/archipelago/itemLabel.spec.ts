import { describe, expect, it } from "vitest";
import { worldNames } from "@/games/archipelago/fixtures";
import { itemLabel, wordsOf } from "@/games/archipelago/itemLabel";

/** AP 0.6.8's item names of a world, from the pinned name data. */
const itemsOf = (game: string) => [...worldNames(game).itemIds.keys()];

describe("an item's name as shown", () => {
  it("puts every SMZ3 name in words", () => {
    const names = itemsOf("SMZ3");
    expect(names).toHaveLength(151);
    for (const name of names) {
      const label = itemLabel("SMZ3", name);
      // Words: no lowercase letter runs into a capital or a digit
      expect(label, name).toMatch(/^[A-Z0-9][A-Za-z0-9]*( [A-Za-z0-9]+)*$/);
      expect(label, name).not.toMatch(/[a-z][A-Z0-9]/);
      // Nothing lost but the spaces put in
      expect(label.replaceAll(" ", ""), name).toBe(name);
    }
    expect(
      [
        "HeartPiece",
        "ThreeBombs",
        "TwentyRupees2",
        "BombUpgrade5",
        "ProgressiveSword",
        "XRay",
        "ETank",
        "BigKeyGT",
        "CardNorfairL1",
        "SmMapLowerNorfair",
        "Nothing",
      ].map((name) => itemLabel("SMZ3", name)),
    ).toEqual([
      "Heart Piece",
      "Three Bombs",
      "Twenty Rupees 2",
      "Bomb Upgrade 5",
      "Progressive Sword",
      "X Ray",
      "E Tank",
      "Big Key GT",
      "Card Norfair L1",
      "Sm Map Lower Norfair",
      "Nothing",
    ]);
  });

  it("leaves names that read as text already as AP gives them", () => {
    for (const game of ["A Link to the Past", "Super Metroid", "APQuest"]) {
      for (const name of itemsOf(game)) {
        expect(itemLabel(game, name), name).toBe(name);
      }
    }
    // Their names are text: splitting them would change some
    expect(wordsOf("Hi-Jump Boots")).toBe("Hi-Jump Boots");
    expect(itemLabel(undefined, "HeartPiece")).toBe("HeartPiece");
  });
});
