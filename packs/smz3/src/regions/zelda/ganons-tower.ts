// Ganon's Tower: Randomizer.SMZ3/Regions/Zelda/GanonsTower.cs.
//
// Its key rules ask where the big key or a key sits (`ItemIs`): each asks a
// placement setting (settings.ts). Its CanEnter wants the crystals and boss
// tokens the run sets (World.CanAcquireAtLeast): a tracker counts the ones
// found (items.ts, rewards).
import { moduleOf, type RegionModule, regionId } from "../../world";

const gt = moduleOf("Randomizer.SMZ3/Regions/Zelda/GanonsTower.cs");

const CORNERS = ["Top Left", "Top Right", "Bottom Left", "Bottom Right"];

/** The placement setting of the big key at a corner of a room. */
const bigKeyAt = (room: string, corner: string) =>
  `setting(gt${room.replace(/ /g, "")}${corner.replace(/ /g, "")}BigKeyGT)`;

/**
 * LeftSide and RightSide (:116-122): what reaches the room, and four keys,
 * or three with the big key at one of the room's other corners.
 */
const side = (room: string, corner: string, reach: string) =>
  `${reach} & (keyGT >= 4 | (${CORNERS.filter((c) => c !== corner)
    .map((c) => bigKeyAt(room, c))
    .join(" | ")}) & keyGT >= 3)`;

/** The two ways through the tower's lower floor. */
const lowerFloor = "(hammer & hookshot | somaria & firerod)";

export const GANONS_TOWER: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/GanonsTower.cs",
  helpers: {
    // BigKeyRoom and CanBeatArmos (:124-140)
    gtBigKeyRoom: `keyGT >= 3 & ${lowerFloor} & (sword | hammer | bow | @canExtendMagic & (somaria | byrna) | @canExtendMagic4 & (firerod | icerod))`,
    // TowerAscend (:131-133)
    gtTowerAscend: "bigKeyGT & keyGT >= 3 & bow & @canLightTorches",
  },
  region: {
    entrances: [
      gt.enter(
        145,
        "moonPearl & count(crystalBlue, crystalRed) >= setting(towerCrystals) & count(tokenKraid, tokenPhantoon, tokenDraygon, tokenRidley) >= setting(gtBossTokens)",
        regionId("Dark World Death Mountain East"),
      ),
    ],
    id: regionId("Ganon's Tower"),
    locations: [
      gt.location("Ganon's Tower - Bob's Torch", 16, "boots"),
      ...CORNERS.map((corner, i) =>
        gt.location(
          `Ganon's Tower - DMs Room - ${corner}`,
          18 + 2 * i,
          "hammer & hookshot",
        ),
      ),
      gt.location(
        "Ganon's Tower - Map Chest",
        26,
        "hammer & (hookshot | boots) & (keyGT >= 4 | (setting(gtMapChestBigKeyGT) | setting(gtMapChestKeyGT)) & keyGT >= 3)",
      ),
      gt.location(
        "Ganon's Tower - Firesnake Room",
        30,
        `hammer & hookshot & (keyGT >= 3 | (${CORNERS.map((c) => bigKeyAt("Randomizer Room", c)).join(" | ")} | setting(gtFiresnakeRoomKeyGT)) & keyGT >= 2)`,
      ),
      ...CORNERS.map((corner, i) =>
        gt.location(
          `Ganon's Tower - Randomizer Room - ${corner}`,
          38 + 6 * i,
          side("Randomizer Room", corner, "hammer & hookshot"),
        ),
      ),
      gt.location("Ganon's Tower - Hope Room - Left", 62),
      gt.location("Ganon's Tower - Hope Room - Right", 63),
      gt.location("Ganon's Tower - Tile Room", 64, "somaria"),
      ...CORNERS.map((corner, i) =>
        gt.location(
          `Ganon's Tower - Compass Room - ${corner}`,
          66 + 6 * i,
          side("Compass Room", corner, "somaria & firerod"),
        ),
      ),
      gt.location(
        "Ganon's Tower - Bob's Chest",
        90,
        `keyGT >= 3 & ${lowerFloor}`,
      ),
      gt.location(
        "Ganon's Tower - Big Chest",
        94,
        `bigKeyGT & keyGT >= 3 & ${lowerFloor}`,
      ),
      gt.location("Ganon's Tower - Big Key Chest", 99, "@gtBigKeyRoom"),
      gt.location("Ganon's Tower - Big Key Room - Left", 100, "@gtBigKeyRoom"),
      gt.location("Ganon's Tower - Big Key Room - Right", 101, "@gtBigKeyRoom"),
      gt.location(
        "Ganon's Tower - Mini Helmasaur Room - Left",
        102,
        "@gtTowerAscend",
      ),
      gt.location(
        "Ganon's Tower - Mini Helmasaur Room - Right",
        104,
        "@gtTowerAscend",
      ),
      gt.location("Ganon's Tower - Pre-Moldorm Chest", 106, "@gtTowerAscend"),
      gt.location(
        "Ganon's Tower - Moldorm Chest",
        108,
        // CanBeatMoldorm
        "bigKeyGT & keyGT >= 4 & bow & @canLightTorches & (sword | hammer) & hookshot",
      ),
    ],
    name: "Ganon's Tower",
  },
};
