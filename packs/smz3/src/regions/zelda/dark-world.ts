// The Dark World: Randomizer.SMZ3/Regions/Zelda/DarkWorld/{DeathMountain/
// West,DeathMountain/East,NorthWest,NorthEast,South,Mire}.cs.
import { moduleOf, OPEN, type RegionModule, regionId } from "../../world";

const dmWest = moduleOf(
  "Randomizer.SMZ3/Regions/Zelda/DarkWorld/DeathMountain/West.cs",
);

export const DARK_WORLD_DEATH_MOUNTAIN_WEST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/DarkWorld/DeathMountain/West.cs",
  region: {
    entrances: [OPEN],
    id: regionId("Dark World Death Mountain West"),
    locations: [
      dmWest.location(
        "Spike Cave",
        12,
        `moonPearl & hammer & @canLiftLight & (@canExtendMagic & cape | byrna) & reach(${regionId("Light World Death Mountain West")})`,
      ),
    ],
    name: "Dark World Death Mountain West",
  },
};

const dmEast = moduleOf(
  "Randomizer.SMZ3/Regions/Zelda/DarkWorld/DeathMountain/East.cs",
);

export const DARK_WORLD_DEATH_MOUNTAIN_EAST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/DarkWorld/DeathMountain/East.cs",
  region: {
    entrances: [
      dmEast.enter(
        27,
        "@canLiftHeavy",
        regionId("Light World Death Mountain East"),
      ),
    ],
    id: regionId("Dark World Death Mountain East"),
    locations: [
      ...["Top Right", "Top Left", "Bottom Left"].map((spot, i) =>
        dmEast.location(
          `Hookshot Cave - ${spot}`,
          12 + 2 * i,
          "moonPearl & hookshot",
        ),
      ),
      dmEast.location(
        "Hookshot Cave - Bottom Right",
        18,
        "moonPearl & (hookshot | boots)",
      ),
      dmEast.location("Superbunny Cave - Top", 20, "moonPearl"),
      dmEast.location("Superbunny Cave - Bottom", 22, "moonPearl"),
    ],
    name: "Dark World Death Mountain East",
  },
};

const northWest = moduleOf(
  "Randomizer.SMZ3/Regions/Zelda/DarkWorld/NorthWest.cs",
);

export const DARK_WORLD_NORTH_WEST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/DarkWorld/NorthWest.cs",
  region: {
    entrances: [
      northWest.enter(
        27,
        "moonPearl & ((@agahnim | @canAccessDarkWorldPortal & flippers) & hookshot & (flippers | @canLiftLight | hammer) | hammer & @canLiftLight | @canLiftHeavy)",
      ),
    ],
    id: regionId("Dark World North West"),
    locations: [
      northWest.location("Bumper Cave", 13, "@canLiftLight & cape"),
      northWest.location("Chest Game", 15),
      northWest.location("C-Shaped House", 16),
      northWest.location("Brewery", 17),
      northWest.location("Hammer Pegs", 18, "@canLiftHeavy & hammer"),
      northWest.location("Blacksmith", 20, "@canLiftHeavy"),
      northWest.location("Purple Chest", 22, "@canLiftHeavy"),
    ],
    name: "Dark World North West",
  },
};

const northEast = moduleOf(
  "Randomizer.SMZ3/Regions/Zelda/DarkWorld/NorthEast.cs",
);

export const DARK_WORLD_NORTH_EAST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/DarkWorld/NorthEast.cs",
  region: {
    entrances: [
      northEast.enter(
        25,
        "@agahnim | moonPearl & (hammer & @canLiftLight | @canLiftHeavy & flippers | @canAccessDarkWorldPortal & flippers)",
      ),
    ],
    id: regionId("Dark World North East"),
    locations: [
      northEast.location("Catfish", 13, "moonPearl & @canLiftLight"),
      northEast.location("Pyramid", 15),
      ...["Left", "Right"].map((side, i) =>
        northEast.location(
          `Pyramid Fairy - ${side}`,
          16 + 3 * i,
          `@redCrystals & moonPearl & reach(${regionId("Dark World South")}) & (hammer | mirror & @agahnim)`,
        ),
      ),
    ],
    name: "Dark World North East",
  },
};

const south = moduleOf("Randomizer.SMZ3/Regions/Zelda/DarkWorld/South.cs");

export const DARK_WORLD_SOUTH: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/DarkWorld/South.cs",
  region: {
    entrances: [
      south.enter(
        23,
        "moonPearl & ((@agahnim | @canAccessDarkWorldPortal & flippers) & (hammer | hookshot & (flippers | @canLiftLight)) | hammer & @canLiftLight | @canLiftHeavy)",
      ),
    ],
    id: regionId("Dark World South"),
    locations: [
      south.location("Digging Game", 13),
      south.location("Stumpy", 14),
      ...["Top", "Middle Right", "Middle Left", "Bottom", "NPC"].map(
        (spot, i) => south.location(`Hype Cave - ${spot}`, 15 + i),
      ),
    ],
    name: "Dark World South",
  },
};

const mire = moduleOf("Randomizer.SMZ3/Regions/Zelda/DarkWorld/Mire.cs");

export const DARK_WORLD_MIRE: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/DarkWorld/Mire.cs",
  region: {
    entrances: [
      mire.enter(19, "flute & @canLiftHeavy | @canAccessMiseryMirePortal"),
    ],
    id: regionId("Dark World Mire"),
    locations: [
      mire.location("Mire Shed - Left", 12, "moonPearl"),
      mire.location("Mire Shed - Right", 14, "moonPearl"),
    ],
    name: "Dark World Mire",
  },
};
