// app/Region/Inverted/DarkWorld/NorthWest.php: North West Dark World,
// Village of Outcasts and its surroundings, where an Inverted run starts.
//
// Its initalize (18-79) replaces Standard's without calling it: it sets no
// can_enter, so the region is always entered (Region.php:217-224), an
// entrance from the start cited at the class; a location it sets no rule
// for needs only its region (Location.php:96-111).
//
// Not ported here: the Outcasts Shop's rule (20-22), as shops are not
// locations.
import type { RegionModule } from "../../../world";

export const INVERTED_DARK_WORLD_NORTH_WEST = {
  file: "app/Region/Inverted/DarkWorld/NorthWest.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/NorthWest.php:10",
        },
      ],
      id: "northWestDarkWorld",
      locations: [
        {
          id: "brewery",
          kind: "chest",
          name: "Brewery",
          req: "@canBombThings",
          source: "app/Region/Inverted/DarkWorld/NorthWest.php:24",
        },
        {
          id: "c-shaped-house",
          kind: "chest",
          name: "C-Shaped House",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/NorthWest.php:18",
        },
        {
          id: "chest-game",
          kind: "chest",
          name: "Chest Game",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/NorthWest.php:18",
        },
        {
          id: "hammer-pegs",
          kind: "standing",
          name: "Hammer Pegs",
          req: "hammer & (@canLiftDarkRocks | magicMirror & reach(northWestLightWorld) | setting(canBootsClip) & pegasusBoots | (setting(canFakeFlipper) | flippers) & (setting(canSuperSpeed) & @canSpinSpeed | setting(canOneFrameClipOW)))",
          source: "app/Region/Inverted/DarkWorld/NorthWest.php:28",
        },
        {
          id: "bumper-cave",
          kind: "standing",
          name: "Bumper Cave",
          req: "@canLiftRocks & cape & moonPearl & magicMirror & reach(northWestLightWorld) | setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW)",
          source: "app/Region/Inverted/DarkWorld/NorthWest.php:42",
          // Its ledge is in sight from the road below
          visible: { source: "game" },
        },
        {
          id: "blacksmith",
          kind: "npc",
          name: "Blacksmith",
          req: "(@canLiftDarkRocks | magicMirror | setting(canOWYBA) & @hasABottle & (setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots)) & reach(northWestLightWorld)",
          source: "app/Region/Inverted/DarkWorld/NorthWest.php:53",
        },
        {
          id: "purple-chest",
          kind: "npc",
          name: "Purple Chest",
          req: "(@canLiftDarkRocks | magicMirror | setting(canOWYBA) & @hasABottle & (setting(canFakeFlipper) | flippers) & (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW)) & reach(northWestLightWorld)) & reach(southLightWorld)",
          source: "app/Region/Inverted/DarkWorld/NorthWest.php:64",
        },
      ],
      name: "North West Dark World",
    },
  ],
} as const satisfies RegionModule;
