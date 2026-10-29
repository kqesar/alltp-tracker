import { describe, expect, it } from "vitest";
import {
  BOTTLE_CONTENTS,
  BOTTLE_SLOTS,
  bottleAfter,
  bottleSlotOf,
  capacityAfter,
  crystalGoalAfter,
  defaultItemGrid,
  hasPieces,
  heartsAfter,
  heartsOf,
  heartsText,
  isHunt,
  isKeyCell,
  itemGridFor,
  itemLabels,
  items,
  itemsMax,
  itemsMin,
  prizesHeld,
  streamGridFor,
  TOGGLE_ITEMS,
  withBottleCount,
} from "@/games/alttpr/data/items";

const dungeonIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe("the pieces' cell", () => {
  it("shows for a Ganonhunt as for a Triforce Hunt, not while the goal is hidden", () => {
    expect(hasPieces({ goal: "ganonhunt" })).toBe(true);
    expect(hasPieces({ goal: "triforce-hunt" })).toBe(true);
    expect(hasPieces({ goal: "ganonhunt", hidden: ["goal"] })).toBe(false);
    expect(hasPieces({ goal: "ganon" })).toBe(false);
    // Only a Triforce Hunt is won by the count
    expect(isHunt({ goal: "ganonhunt" })).toBe(false);
    expect(itemGridFor({ goal: "ganonhunt", mode: "open" }).flat()).toContain(
      "triforce",
    );
  });
});

describe("item ranges", () => {
  it("starts every progressive item inside its own bounds", () => {
    Object.keys(itemsMin).forEach((name) => {
      const value = items[name] as number;

      expect(itemsMin[name]).toBeLessThanOrEqual(itemsMax[name]);
      expect(value).toBeGreaterThanOrEqual(itemsMin[name]);
      expect(value).toBeLessThanOrEqual(itemsMax[name]);
    });
  });

  it("bounds min and max to exactly the progressive items", () => {
    expect(Object.keys(itemsMin).sort()).toEqual(Object.keys(itemsMax).sort());

    Object.keys(itemsMin).forEach((name) => {
      expect(typeof items[name]).toBe("number");
    });
  });

  it("keeps the documented bounds for the progressive items", () => {
    expect([itemsMin.sword, itemsMax.sword]).toEqual([0, 4]);
    expect([itemsMin.glove, itemsMax.glove]).toEqual([0, 2]);
    expect([itemsMin.bow, itemsMax.bow]).toEqual([0, 3]);
    expect([itemsMin.bottle, itemsMax.bottle]).toEqual([0, 4]);
    // The tunic is never lost, so it starts at and never drops below 1.
    expect([itemsMin.tunic, itemsMax.tunic, items.tunic]).toEqual([1, 3, 1]);
  });

  it("starts each dungeon with its full chest count and a live boss", () => {
    const expectedChests = [3, 2, 2, 5, 6, 2, 4, 3, 2, 5];

    dungeonIndices.forEach((index) => {
      // Chest counters start full and are counted down.
      expect(items[`chest${index}`]).toBe(expectedChests[index]);
      expect(itemsMax[`chest${index}`]).toBe(expectedChests[index]);
      expect(itemsMin[`chest${index}`]).toBe(0);

      expect(items[`boss${index}`]).toBe(1);
      expect(items[`bigkey${index}`]).toBe(0);
      expect(items[`reward${index}`]).toBe(0);
    });
  });

  it("starts every non-progressive item unheld", () => {
    Object.entries(items)
      .filter(([, value]) => typeof value === "boolean")
      .forEach(([, value]) => {
        expect(value).toBe(false);
      });
  });
});

describe("the pieces' cell", () => {
  it("shows for a Ganonhunt as for a Triforce Hunt, not while the goal is hidden", () => {
    expect(hasPieces({ goal: "ganonhunt" })).toBe(true);
    expect(hasPieces({ goal: "triforce-hunt" })).toBe(true);
    expect(hasPieces({ goal: "ganonhunt", hidden: ["goal"] })).toBe(false);
    expect(hasPieces({ goal: "ganon" })).toBe(false);
    // Only a Triforce Hunt is won by the count
    expect(isHunt({ goal: "ganonhunt" })).toBe(false);
    expect(itemGridFor({ goal: "ganonhunt", mode: "open" }).flat()).toContain(
      "triforce",
    );
  });
});

describe("the half magic", () => {
  it("is a cell of the equipment row, between the tunic and the boots", () => {
    expect(defaultItemGrid[1]).toEqual([
      "bow",
      "lantern",
      "shield",
      "sword",
      "tunic",
      "magic",
      "boots",
    ]);
    // Agahnim heads Castle Tower's column, over its keys, in every run
    for (const grid of [defaultItemGrid, itemGridFor({ mode: "retro" })]) {
      expect(grid.flat().filter((id) => id === "agahnim")).toHaveLength(1);
      expect(grid[5]?.[3]).toBe("agahnim");
      expect(grid[6]?.[3]).toBe("keys11");
    }
  });

  it("counts a half and a quarter, a plain toggle on the board", () => {
    expect([itemsMin.magic, itemsMax.magic, items.magic]).toEqual([0, 2, 0]);
    expect(TOGGLE_ITEMS.has("magic")).toBe(true);
    expect(itemLabels("magic")).toBe("Half Magic");
  });
});

describe("the pieces' cell", () => {
  it("shows for a Ganonhunt as for a Triforce Hunt, not while the goal is hidden", () => {
    expect(hasPieces({ goal: "ganonhunt" })).toBe(true);
    expect(hasPieces({ goal: "triforce-hunt" })).toBe(true);
    expect(hasPieces({ goal: "ganonhunt", hidden: ["goal"] })).toBe(false);
    expect(hasPieces({ goal: "ganon" })).toBe(false);
    // Only a Triforce Hunt is won by the count
    expect(isHunt({ goal: "ganonhunt" })).toBe(false);
    expect(itemGridFor({ goal: "ganonhunt", mode: "open" }).flat()).toContain(
      "triforce",
    );
  });
});

describe("defaultItemGrid", () => {
  it("is 7 wide: 5 rows of items, then the dungeons by world, their keys under them", () => {
    expect(defaultItemGrid).toHaveLength(9);
    defaultItemGrid.forEach((row) => {
      expect(row).toHaveLength(7);
    });
    expect(defaultItemGrid[4]).toEqual([
      "bombcapacity",
      "bottlecontents1",
      "bottlecontents2",
      "bottlecontents3",
      "bottlecontents4",
      "goaltower",
      "goalganon",
    ]);
  });

  it("only places items the store knows about, key cells and the cells that only show", () => {
    const cells = new Set(["pendants", "crystals", "goaltower", "goalganon"]);
    defaultItemGrid
      .flat()
      // Ganon's Tower's boss cell steps Agahnim 2 (agahnim2)
      .filter(
        (id) =>
          id !== "" && !isKeyCell(id) && id !== "boss12" && !cells.has(id),
      )
      .forEach((item) => {
        expect(items).toHaveProperty(item);
      });
  });

  it("lays the Light World's dungeons and the seven crystals' each over its key cell", () => {
    const flat = defaultItemGrid.flat();
    dungeonIndices.forEach((index) => {
      expect(flat).toContain(`boss${index}`);
    });
    for (let index = 0; index < 13; index++) {
      expect(flat).toContain(`keys${index}`);
    }
    expect(defaultItemGrid.slice(5)).toEqual([
      ["boss0", "boss1", "boss2", "agahnim", "boss12", "pendants", "crystals"],
      ["keys0", "keys1", "keys2", "keys11", "keys12", "keylabel10", "keys10"],
      ["boss3", "boss4", "boss5", "boss6", "boss7", "boss8", "boss9"],
      ["keys3", "keys4", "keys5", "keys6", "keys7", "keys8", "keys9"],
    ]);
  });
});

describe("the pieces' cell", () => {
  it("shows for a Ganonhunt as for a Triforce Hunt, not while the goal is hidden", () => {
    expect(hasPieces({ goal: "ganonhunt" })).toBe(true);
    expect(hasPieces({ goal: "triforce-hunt" })).toBe(true);
    expect(hasPieces({ goal: "ganonhunt", hidden: ["goal"] })).toBe(false);
    expect(hasPieces({ goal: "ganon" })).toBe(false);
    // Only a Triforce Hunt is won by the count
    expect(isHunt({ goal: "ganonhunt" })).toBe(false);
    expect(itemGridFor({ goal: "ganonhunt", mode: "open" }).flat()).toContain(
      "triforce",
    );
  });
});

describe("itemGridFor", () => {
  it("adds a row under the grid with a retro run's shops, centred", () => {
    expect(itemGridFor({ mode: "open" })).toBe(defaultItemGrid);
    const retro = itemGridFor({ mode: "retro" });
    expect(retro.slice(0, -1)).toEqual(defaultItemGrid);
    expect(retro.at(-1)).toEqual(["", "", "shoparrow", "shopkey", "", "", ""]);
    expect(items).toMatchObject({ shoparrow: false, shopkey: false });
  });

  it("adds a triforce hunt's pieces under the grid, centred, in every world", () => {
    const hunt = itemGridFor({ goal: "triforce-hunt", mode: "open" });
    expect(hunt.slice(0, -1)).toEqual(defaultItemGrid);
    expect(hunt.at(-1)).toEqual(["", "", "", "triforce", "", "", ""]);
    // A retro hunt: the pieces between the shops, on the one row
    const retro = itemGridFor({ goal: "triforce-hunt", mode: "retro" });
    expect(retro.slice(0, -1)).toEqual(defaultItemGrid);
    expect(retro.at(-1)).toEqual([
      "",
      "",
      "shoparrow",
      "triforce",
      "shopkey",
      "",
      "",
    ]);
    expect(itemGridFor({ mode: "retro" })).toBe(itemGridFor({ mode: "retro" }));
    // The same arrays each time: the board selects them without re-rendering
    expect(itemGridFor({ goal: "triforce-hunt", mode: "open" })).toBe(hunt);
    // No other goal has the row
    expect(itemGridFor({ goal: "ganon", mode: "open" })).toBe(defaultItemGrid);
  });

  it("leaves the row out while a Mystery run's goal is hidden", () => {
    expect(
      itemGridFor({ goal: "triforce-hunt", hidden: ["goal"], mode: "open" }),
    ).toBe(defaultItemGrid);
    expect(isHunt({ goal: "triforce-hunt", hidden: ["goal"] })).toBe(false);
    expect(isHunt({ goal: "triforce-hunt" })).toBe(true);
  });

  it("counts the pieces found from none to a goal's most, and asks for 20 at first", () => {
    expect([itemsMin.triforce, itemsMax.triforce, items.triforce]).toEqual([
      0, 50, 0,
    ]);
    expect(items.goalpieces).toBe(20);
    expect(itemLabels("triforce")).toBe("Triforce pieces");
  });
});

describe("the pieces' cell", () => {
  it("shows for a Ganonhunt as for a Triforce Hunt, not while the goal is hidden", () => {
    expect(hasPieces({ goal: "ganonhunt" })).toBe(true);
    expect(hasPieces({ goal: "triforce-hunt" })).toBe(true);
    expect(hasPieces({ goal: "ganonhunt", hidden: ["goal"] })).toBe(false);
    expect(hasPieces({ goal: "ganon" })).toBe(false);
    // Only a Triforce Hunt is won by the count
    expect(isHunt({ goal: "ganonhunt" })).toBe(false);
    expect(itemGridFor({ goal: "ganonhunt", mode: "open" }).flat()).toContain(
      "triforce",
    );
  });
});

describe("the hearts counter", () => {
  const at = (hearts: number, quarters = 0) => ({ hearts, quarters });

  it("steps a quarter, the fourth making a heart, and back", () => {
    expect(heartsAfter(at(5, 2), "forward")).toEqual(at(5, 3));
    expect(heartsAfter(at(5, 3), "forward")).toEqual(at(6, 0));
    expect(heartsAfter(at(6, 0), "back")).toEqual(at(5, 3));
  });

  it("stops at not set and at 20 hearts, never wrapping round", () => {
    // From not set: the 3 hearts Link starts with, whole
    expect(heartsAfter(at(0), "forward")).toEqual(at(1));
    expect(heartsAfter(at(1), "back")).toEqual(at(0));
    expect(heartsAfter(at(0), "back")).toEqual(at(0));
    expect(heartsAfter(at(17, 3), "forward")).toEqual(at(18));
    expect(heartsAfter(at(18), "forward")).toEqual(at(18));
  });

  it("finds a whole heart, the quarters kept, or a piece; from not set the start and the find", () => {
    expect(heartsAfter(at(0), "heart")).toEqual(at(2));
    expect(heartsAfter(at(5, 2), "heart")).toEqual(at(6, 2));
    expect(heartsAfter(at(17, 2), "heart")).toEqual(at(18));
    expect(heartsAfter(at(0), "piece")).toEqual(at(1, 1));
    expect(heartsAfter(at(5, 3), "piece")).toEqual(at(6));
    expect(heartsAfter(at(18), "piece")).toEqual(at(18));
  });

  it("reads a run's quarters only beside hearts set and short of 20", () => {
    expect(heartsOf({ heartquarters: 2, hearts: 5 })).toEqual(at(5, 2));
    expect(heartsOf({ heartquarters: 2, hearts: 0 })).toEqual(at(0));
    expect(heartsOf({ heartquarters: 2, hearts: 18 })).toEqual(at(18));
    // A save from before the quarters: none
    expect(heartsOf({ hearts: 5 })).toEqual(at(5));
  });

  it("says the hearts and their quarters in words", () => {
    expect(heartsText(at(0))).toBeNull();
    expect(heartsText(at(11))).toBe("13");
    expect(heartsText(at(11, 1))).toBe("13 and 1 quarter");
    expect(heartsText(at(11, 2))).toBe("13 and 2 quarters");
  });
});

describe("the pieces' cell", () => {
  it("shows for a Ganonhunt as for a Triforce Hunt, not while the goal is hidden", () => {
    expect(hasPieces({ goal: "ganonhunt" })).toBe(true);
    expect(hasPieces({ goal: "triforce-hunt" })).toBe(true);
    expect(hasPieces({ goal: "ganonhunt", hidden: ["goal"] })).toBe(false);
    expect(hasPieces({ goal: "ganon" })).toBe(false);
    // Only a Triforce Hunt is won by the count
    expect(isHunt({ goal: "ganonhunt" })).toBe(false);
    expect(itemGridFor({ goal: "ganonhunt", mode: "open" }).flat()).toContain(
      "triforce",
    );
  });
});

describe("itemLabels", () => {
  it("spells out ids that are not just capitalised", () => {
    expect(itemLabels("moonpearl")).toBe("Moon Pearl");
    expect(itemLabels("book")).toBe("Book of Mudora");
  });

  it("capitalises anything else", () => {
    expect(itemLabels("hookshot")).toBe("Hookshot");
  });

  it("names bosses rather than their index", () => {
    expect(itemLabels("boss0")).toBe("Armos Knights");
    expect(itemLabels("boss9")).toBe("Trinexx");
  });

  it("describes empty slots", () => {
    expect(itemLabels("blank")).toBe("Empty slot");
    expect(itemLabels("")).toBe("Empty slot");
  });
});

describe("the bottles", () => {
  it("keeps the count, and reads a save made before the contents as empty bottles", () => {
    expect([itemsMin.bottle, itemsMax.bottle, items.bottle]).toEqual([0, 4, 0]);
    for (const slot of BOTTLE_SLOTS) {
      expect([itemsMin[slot], itemsMax[slot], items[slot]]).toEqual([0, 7, 0]);
    }
    expect(BOTTLE_CONTENTS[0]).toBe("empty");
    expect(bottleSlotOf("bottlecontents3")).toBe(3);
    expect(bottleSlotOf("bottle")).toBeNull();
  });

  it("finds the bottles up to the one clicked, then steps what it holds, round to empty", () => {
    // Every bottle found empty, whatever a slot past the count still held
    expect(bottleAfter({ bottle: 1, bottlecontents2: 4 }, 3, 1)).toEqual({
      bottle: 3,
      bottlecontents2: 0,
      bottlecontents3: 0,
    });
    expect(bottleAfter({ bottle: 2, bottlecontents2: 0 }, 2, 1)).toEqual({
      bottlecontents2: 1,
    });
    expect(bottleAfter({ bottle: 2, bottlecontents2: 7 }, 2, 1)).toEqual({
      bottlecontents2: 0,
    });
  });

  it("steps back what a bottle holds, and from empty loses it and those after it", () => {
    expect(bottleAfter({ bottle: 2, bottlecontents2: 3 }, 2, -1)).toEqual({
      bottlecontents2: 2,
    });
    expect(
      bottleAfter({ bottle: 3, bottlecontents2: 0, bottlecontents3: 4 }, 2, -1),
    ).toEqual({ bottle: 1, bottlecontents3: 0 });
    // Back on a bottle not found changes nothing
    expect(bottleAfter({ bottle: 1 }, 3, -1)).toBeNull();
  });

  it("clears what the bottles beyond a lower count held", () => {
    expect(
      withBottleCount({ bottlecontents1: 2, bottlecontents2: 5 }, 1),
    ).toEqual({ bottle: 1, bottlecontents2: 0 });
    expect(withBottleCount({ bottlecontents1: 2 }, 4)).toEqual({ bottle: 4 });
  });
});

describe("the capacities", () => {
  it("start where a run starts: 10 bombs and 30 arrows", () => {
    expect(items.bombcapacity).toBe(10);
    expect(items.arrowcapacity).toBe(30);
  });

  it("step 5 up to the most a seed gives, round to the start, and back", () => {
    expect(capacityAfter("bombcapacity", 10, 1)).toBe(15);
    expect(capacityAfter("bombcapacity", 50, 1)).toBe(10);
    expect(capacityAfter("bombcapacity", 10, -1)).toBe(50);
    expect(capacityAfter("arrowcapacity", 70, 1)).toBe(30);
    expect(capacityAfter("arrowcapacity", 35, -1)).toBe(30);
    // A value off the steps (a customized seed's) steps from the nearest
    expect(capacityAfter("bombcapacity", 99, -1)).toBe(45);
    expect(capacityAfter("bombcapacity", 0, 1)).toBe(15);
  });
});

describe("the crystal goals", () => {
  it("step the crystals asked for round from 7 to 0, from none when not known", () => {
    expect(crystalGoalAfter(7, 1)).toBe(0);
    expect(crystalGoalAfter(0, -1)).toBe(7);
    expect(crystalGoalAfter(4, 1)).toBe(5);
    expect(crystalGoalAfter(null, 1)).toBe(0);
    expect(crystalGoalAfter(null, -1)).toBe(7);
  });

  it("count the prizes held from the beaten bosses' prizes, or what the game read", () => {
    expect(
      prizesHeld({
        boss0: 2,
        boss1: 2,
        boss3: 2,
        boss4: 1,
        boss5: 2,
        reward0: 1,
        reward1: 2,
        reward3: 3,
        reward4: 3,
        reward5: 4,
      }),
    ).toEqual({ crystals: 2, green: 1, pendants: 1 });
    // A prize not marked is not counted; autotracking's count says more
    expect(prizesHeld({ boss0: 2, heldcrystals: 5 })).toEqual({
      crystals: 5,
      green: 0,
      pendants: 0,
    });
  });
});

describe("streamGridFor", () => {
  it("lays a band twelve wide, the dungeons from Castle Tower to Ganon's Tower", () => {
    const band = streamGridFor({ mode: "open" }, false);
    expect(band.map((row) => row.length)).toEqual([12, 12, 12, 12, 12]);
    expect(band[3]).toEqual([
      "agahnim",
      "boss0",
      "boss1",
      "boss2",
      "boss3",
      "boss4",
      "boss5",
      "boss6",
      "boss7",
      "boss8",
      "boss9",
      "boss12",
    ]);
    // Every item cell of the app's grid is in the band, but the pendants
    const app = new Set(defaultItemGrid.flat());
    const stream = new Set(band.flat());
    expect([...app].filter((id) => !stream.has(id))).toEqual([
      "pendants",
      "keylabel10",
      "keys10",
    ]);
  });

  it("adds Hyrule Castle's key cell at the end while the key cells show", () => {
    const band = streamGridFor({ mode: "open" }, true);
    expect(band[3]?.at(-1)).toBe("keylabel10");
    expect(band[4]?.at(-1)).toBe("keys10");
    expect(band.slice(0, 3).every((row) => row.length === 13)).toBe(true);
  });

  it("folds in two halves of six on a page taller than wide, keys under their dungeons", () => {
    const band = streamGridFor(
      { goal: "triforce-hunt", mode: "retro" },
      false,
      true,
    );
    expect(band.slice(0, 6).every((row) => row.length === 6)).toBe(true);
    expect(band[6]?.[0]).toBe("agahnim");
    expect(band[7]?.[0]).toBe("keys11");
    expect(band[8]?.[0]).toBe("boss5");
    expect(band.at(-1)).toEqual([
      "",
      "shoparrow",
      "triforce",
      "shopkey",
      "",
      "",
    ]);
  });
});
