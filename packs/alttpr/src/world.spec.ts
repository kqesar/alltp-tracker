import { compileWorld, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { loadItemTable } from "../test/fixtures";
import { OPEN, settingsFromUpstream, UPSTREAM_TEST } from "./settings";
import {
  buildWorld,
  canFill,
  dungeonItemClass,
  extendModule,
  type RegionDef,
  type RegionModule,
  regionId,
  START,
} from "./world";

describe("regionId", () => {
  it.each([
    ["North East Light World", "northEastLightWorld"],
    ["Escape", "escape"],
    ["Tower of Hera", "towerOfHera"],
    ["East Dark World Death Mountain", "eastDarkWorldDeathMountain"],
    ["Ganons Tower", "ganonsTower"],
    ["Thieves Town", "thievesTown"],
  ])("%s is %s", (name, id) => {
    expect(regionId(name)).toBe(id);
  });
});

describe("buildWorld", () => {
  const ledge: RegionModule = {
    file: "app/Region/Standard/Ledge.php",
    regions: [
      {
        entrances: [
          {
            from: "field",
            req: "glove",
            source: "app/Region/Standard/Ledge.php:9",
          },
        ],
        id: "ledge",
        locations: [
          {
            id: "ledge/chest",
            kind: "chest",
            name: "Ledge - Chest",
            req: "true",
            source: "app/Region/Standard/Ledge.php:3",
            // Seen from below, where the field is
            visible: { from: "field", source: "game" },
          },
        ],
        name: "Ledge",
      },
    ],
  };
  const field: RegionModule = {
    file: "app/Region/Standard/Field.php",
    regions: [
      {
        entrances: [
          {
            from: START,
            req: "boots",
            source: "app/Region/Standard/Field.php:9",
          },
          {
            from: START,
            req: "flute",
            source: "app/Region/Standard/Field.php:9",
          },
        ],
        id: "field",
        locations: [
          {
            id: "field/stone",
            kind: "standing",
            name: "Field - Stone",
            req: "reach(ledge)",
            source: "app/Region/Standard/Field.php:5",
            visible: { req: "lamp", source: "game" },
          },
        ],
        name: "Field",
      },
    ],
  };

  it("puts the start first, and each entrance on the region it leaves", () => {
    expect(buildWorld([ledge, field])).toEqual({
      regions: [
        {
          exits: [
            { req: "boots", to: "field" },
            { req: "flute", to: "field" },
          ],
          id: START,
          locations: [],
        },
        {
          exits: [],
          id: "ledge",
          locations: [
            { id: "ledge/chest", req: "true", visible: { from: "field" } },
          ],
        },
        {
          exits: [{ req: "glove", to: "ledge" }],
          id: "field",
          locations: [
            {
              id: "field/stone",
              req: "reach(ledge)",
              visible: { req: "lamp" },
            },
          ],
        },
      ],
      start: START,
    });
  });

  it("solves as upstream's can_enter reads: an entrance needs its region and its rule", () => {
    const world = compileWorld(buildWorld([ledge, field]));
    expect(solve(world, { glove: 1 }).regions()).toEqual({
      field: "no",
      ledge: "no",
      start: "yes",
    });
    const flying = solve(world, { flute: 1 });
    expect(flying.region("field")).toBe("yes");
    expect(flying.location("field/stone")).toBe("no");
    expect(flying.visible("ledge/chest")).toBe("yes");
    expect(solve(world, { boots: 1, glove: 1 }).locations()).toEqual({
      "field/stone": "yes",
      "ledge/chest": "yes",
    });
  });
});

describe("extendModule", () => {
  const parent: RegionModule = {
    file: "app/Region/Standard/Cave.php",
    regions: [
      {
        entrances: [
          {
            from: START,
            req: "lamp",
            source: "app/Region/Standard/Cave.php:20",
          },
        ],
        id: "cave",
        locations: [
          {
            id: "cave/left",
            kind: "chest",
            name: "Cave - Left",
            req: "hammer",
            source: "app/Region/Standard/Cave.php:11",
            visible: { source: "game" },
          },
          {
            id: "cave/right",
            kind: "chest",
            name: "Cave - Right",
            req: "hookshot",
            source: "app/Region/Standard/Cave.php:14",
          },
        ],
        name: "Cave",
      },
      { entrances: [], id: "nook", locations: [], name: "Nook" },
    ],
  };
  const FILE = "app/Region/Inverted/Cave.php";

  it("keeps the parent's rules but those the class sets again", () => {
    const child = extendModule(parent, FILE, {
      cave: {
        entrances: [{ from: "nook", req: "true", source: `${FILE}:30` }],
        locations: {
          "cave/left": { req: "moonPearl & hammer", source: `${FILE}:24` },
        },
      },
    });
    expect(child.file).toBe(FILE);
    expect(child.regions[0]?.entrances).toEqual([
      { from: "nook", req: "true", source: `${FILE}:30` },
    ]);
    expect(child.regions[0]?.locations).toEqual([
      {
        ...parent.regions[0]?.locations[0],
        req: "moonPearl & hammer",
        source: `${FILE}:24`,
      },
      parent.regions[0]?.locations[1],
    ]);
    expect(child.regions[1]).toBe(parent.regions[1]);
  });

  it("keeps the parent's can_enter when the class sets none", () => {
    const child = extendModule(parent, FILE, {
      cave: {
        locations: { "cave/right": { req: "true", source: `${FILE}:9` } },
      },
    });
    expect(child.regions[0]?.entrances).toBe(parent.regions[0]?.entrances);
  });

  it("refuses a change for a region or a location the parent lacks", () => {
    expect(() => extendModule(parent, FILE, { attic: {} })).toThrow(
      `${FILE}: no region attic`,
    );
    expect(() =>
      extendModule(parent, FILE, {
        cave: {
          locations: { "cave/middle": { req: "true", source: `${FILE}:9` } },
        },
      }),
    ).toThrow(`${FILE}: no location cave/middle`);
  });
});

describe("dungeonItemClass", () => {
  it("is the class app/Item.php gives every dungeon item, and only those", () => {
    const CLASSES: Record<string, string> = {
      BigKey: "bigKey",
      Compass: "compass",
      Key: "key",
      Map: "map",
    };
    const items = loadItemTable().items;
    expect(items.length).toBeGreaterThan(150);
    for (const { class: kind, name } of items) {
      expect(dungeonItemClass(name), name).toBe(CLASSES[kind]);
    }
    expect(dungeonItemClass("ShopKey")).toBeUndefined();
    expect(dungeonItemClass("MagicMirror")).toBeUndefined();
  });
});

describe("canFill (Region.php:232-246)", () => {
  const dungeon: RegionDef = {
    entrances: [],
    id: "easternPalace",
    locations: [],
    name: "Eastern Palace",
    regionItems: {
      items: ["BigKey", "BigKeyP1", "Key", "KeyP1", "Map", "MapP1"],
      source: "app/Region/Standard/EasternPalace.php:24",
    },
  };
  const sewers: RegionDef = {
    entrances: [],
    id: "escape",
    locations: [],
    regionItems: {
      items: ["KeyH2"],
      source: "app/Region/Standard/HyruleCastleEscape.php:18",
    },
  };
  const overworld: RegionDef = { entrances: [], id: "field", locations: [] };
  const KEYSANITY = settingsFromUpstream("standard", { dungeonItems: "full" });
  const OPEN_KEYSANITY = settingsFromUpstream("open", { dungeonItems: "full" });

  it.each([
    // A region's own items
    [dungeon, "BigKeyP1", UPSTREAM_TEST, true],
    [dungeon, "MapP1", UPSTREAM_TEST, true],
    [sewers, "KeyH2", UPSTREAM_TEST, true],
    // Another dungeon's items stay out, unless their class is wild
    [dungeon, "KeyD1", UPSTREAM_TEST, false],
    [dungeon, "BigKeyD1", UPSTREAM_TEST, false],
    [dungeon, "MapD1", UPSTREAM_TEST, false],
    [dungeon, "CompassD1", UPSTREAM_TEST, false],
    [overworld, "KeyD1", UPSTREAM_TEST, false],
    [dungeon, "KeyD1", KEYSANITY, true],
    [dungeon, "BigKeyD1", KEYSANITY, true],
    [overworld, "MapD1", KEYSANITY, true],
    [overworld, "CompassD1", KEYSANITY, true],
    // The sewers key stays in a Standard escape, wild or not
    [dungeon, "KeyH2", KEYSANITY, false],
    [dungeon, "KeyH2", OPEN_KEYSANITY, true],
    [dungeon, "KeyH2", OPEN, false],
    // Anything else goes anywhere
    [dungeon, "Hammer", UPSTREAM_TEST, true],
    [overworld, "PendantOfWisdom", UPSTREAM_TEST, true],
  ] as const)("%#: %s <- %s", (region, item, settings, expected) => {
    expect(canFill(region, item, settings)).toBe(expected);
  });

  it("reads the wild flags one class at a time", () => {
    const maps = settingsFromUpstream("standard", { "region.wildMaps": true });
    expect(canFill(overworld, "MapP1", maps)).toBe(true);
    expect(canFill(overworld, "CompassP1", maps)).toBe(false);
    const compasses = settingsFromUpstream("standard", {
      "region.wildCompasses": true,
    });
    expect(canFill(overworld, "CompassP1", compasses)).toBe(true);
    expect(canFill(overworld, "MapP1", compasses)).toBe(false);
  });
});
