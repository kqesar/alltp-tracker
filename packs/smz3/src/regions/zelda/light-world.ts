// The Light World: Randomizer.SMZ3/Regions/Zelda/LightWorld/{DeathMountain/
// West,DeathMountain/East,NorthWest,NorthEast,South}.cs.
import { moduleOf, OPEN, type RegionModule, regionId } from "../../world";

const DARK_WORLD_NORTH_WEST = regionId("Dark World North West");
const DARK_WORLD_SOUTH = regionId("Dark World South");

const dmWest = moduleOf(
  "Randomizer.SMZ3/Regions/Zelda/LightWorld/DeathMountain/West.cs",
);

export const LIGHT_WORLD_DEATH_MOUNTAIN_WEST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/LightWorld/DeathMountain/West.cs",
  region: {
    entrances: [
      dmWest.enter(
        22,
        "flute | @canLiftLight & lamp | @canAccessDeathMountainPortal",
      ),
    ],
    id: regionId("Light World Death Mountain West"),
    locations: [
      dmWest.location(
        "Ether Tablet",
        12,
        "book & sword >= 2 & (mirror | hammer & hookshot)",
      ),
      dmWest.location("Spectacle Rock", 14, "mirror"),
      dmWest.location("Spectacle Rock Cave", 16),
      dmWest.location("Old Man", 17, "lamp"),
    ],
    name: "Light World Death Mountain West",
  },
};

const dmEast = moduleOf(
  "Randomizer.SMZ3/Regions/Zelda/LightWorld/DeathMountain/East.cs",
);

export const LIGHT_WORLD_DEATH_MOUNTAIN_EAST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/LightWorld/DeathMountain/East.cs",
  region: {
    entrances: [
      dmEast.enter(
        27,
        "hammer & mirror | hookshot",
        regionId("Light World Death Mountain West"),
      ),
    ],
    id: regionId("Light World Death Mountain East"),
    locations: [
      dmEast.location(
        "Floating Island",
        12,
        "mirror & moonPearl & @canLiftHeavy",
      ),
      dmEast.location("Spiral Cave", 14),
      ...[
        "Paradox Cave Upper - Left",
        "Paradox Cave Upper - Right",
        "Paradox Cave Lower - Far Left",
        "Paradox Cave Lower - Left",
        "Paradox Cave Lower - Middle",
        "Paradox Cave Lower - Right",
        "Paradox Cave Lower - Far Right",
      ].map((name, i) => dmEast.location(name, 15 + i)),
      dmEast.location(
        "Mimic Cave",
        22,
        `mirror & keyTR >= 2 & reach(${regionId("Turtle Rock")})`,
      ),
    ],
    name: "Light World Death Mountain East",
  },
};

const northWest = moduleOf(
  "Randomizer.SMZ3/Regions/Zelda/LightWorld/NorthWest.cs",
);

export const LIGHT_WORLD_NORTH_WEST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/LightWorld/NorthWest.cs",
  region: {
    entrances: [OPEN],
    id: regionId("Light World North West"),
    locations: [
      northWest.location("Master Sword Pedestal", 14, "@allPendants"),
      northWest.location("Mushroom", 16),
      northWest.location("Lost Woods Hideout", 17),
      northWest.location("Lumberjack Tree", 18, "@agahnim & boots"),
      northWest.location("Pegasus Rocks", 20, "boots"),
      northWest.location(
        "Graveyard Ledge",
        22,
        `mirror & moonPearl & reach(${DARK_WORLD_NORTH_WEST})`,
      ),
      northWest.location(
        "King's Tomb",
        24,
        `boots & (@canLiftHeavy | mirror & moonPearl & reach(${DARK_WORLD_NORTH_WEST}))`,
      ),
      ...["Top", "Left", "Middle", "Right", "Bottom"].map((spot, i) =>
        northWest.location(`Kakariko Well - ${spot}`, 28 + i),
      ),
      ...["Top", "Far Left", "Left", "Right", "Far Right"].map((spot, i) =>
        northWest.location(`Blind's Hideout - ${spot}`, 33 + i),
      ),
      northWest.location("Bottle Merchant", 38),
      northWest.location("Chicken House", 39),
      northWest.location("Sick Kid", 40, "bottle"),
      northWest.location("Kakariko Tavern", 42),
      northWest.location(
        "Magic Bat",
        43,
        "powder & (hammer | moonPearl & mirror & @canLiftHeavy)",
      ),
    ],
    name: "Light World North West",
  },
};

const northEast = moduleOf(
  "Randomizer.SMZ3/Regions/Zelda/LightWorld/NorthEast.cs",
);

export const LIGHT_WORLD_NORTH_EAST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/LightWorld/NorthEast.cs",
  region: {
    entrances: [OPEN],
    id: regionId("Light World North East"),
    locations: [
      northEast.location("King Zora", 14, "@canLiftLight | flippers"),
      northEast.location("Zora's Ledge", 16, "flippers"),
      northEast.location("Waterfall Fairy - Left", 18, "flippers"),
      northEast.location("Waterfall Fairy - Right", 20, "flippers"),
      northEast.location("Potion Shop", 22, "mushroom"),
      ...["Left", "Middle", "Right"].map((spot, i) =>
        northEast.location(`Sahasrahla's Hut - ${spot}`, 24 + i),
      ),
      northEast.location("Sahasrahla", 27, "@greenPendant"),
    ],
    name: "Light World North East",
  },
};

const south = moduleOf("Randomizer.SMZ3/Regions/Zelda/LightWorld/South.cs");

export const LIGHT_WORLD_SOUTH: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/LightWorld/South.cs",
  region: {
    entrances: [OPEN],
    id: regionId("Light World South"),
    locations: [
      south.location("Maze Race", 13),
      south.location("Library", 14, "boots"),
      south.location("Flute Spot", 16, "shovel"),
      south.location(
        "South of Grove",
        18,
        `mirror & reach(${DARK_WORLD_SOUTH})`,
      ),
      south.location("Link's House", 20),
      south.location("Aginah's Cave", 21),
      ...["Far Left", "Left", "NPC", "Right", "Far Right"].map((spot, i) =>
        south.location(`Mini Moldorm Cave - ${spot}`, 22 + i),
      ),
      south.location("Desert Ledge", 27, `reach(${regionId("Desert Palace")})`),
      south.location(
        "Checkerboard Cave",
        29,
        "mirror & (flute & @canLiftHeavy | @canAccessMiseryMirePortal) & @canLiftLight",
      ),
      south.location(
        "Bombos Tablet",
        34,
        `book & sword >= 2 & mirror & reach(${DARK_WORLD_SOUTH})`,
      ),
      south.location("Floodgate Chest", 36),
      south.location("Sunken Treasure", 37),
      south.location(
        "Lake Hylia Island",
        38,
        `flippers & moonPearl & mirror & (reach(${DARK_WORLD_SOUTH}) | reach(${regionId("Dark World North East")}))`,
      ),
      south.location("Hobo", 42, "flippers"),
      south.location("Ice Rod Cave", 44),
    ],
    name: "Light World South",
  },
};
