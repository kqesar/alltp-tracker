// app/Region/Open/HyruleCastleEscape.php: the escape of an Open world. It
// extends Standard's (14), so it has the same locations and dungeon items,
// but its initalize (22) replaces Standard's without calling it: only the
// rules it sets apply. The Sanctuary, the Map Chest, Link's Uncle, the
// Secret Passage and Zelda get none, so they are "true" at line 22, and the
// region has no can_enter: it is entered from anywhere.
//
// Not ported here: the fill rules of the Secret Passage (58-63) and Link's
// Uncle (65-71), which Location::canFill reads when the randomizer places an
// item; they wait for src/fill.ts.
import type { RegionModule } from "../../world";

/** The sewers' secret room (24-43): a rock to lift, or the dark sewers. */
const SECRET_ROOM =
  "@canLiftRocks | (lamp >= setting(requireLamp) | setting(advancedPlacement) & fireRod) & keyH2 & @canKillMostThings";

/** Behind the castle's locked door (50-56). */
const LOCKED_DOOR = "keyH2 & @canKillMostThings";

export const OPEN_HYRULE_CASTLE_ESCAPE = {
  file: "app/Region/Open/HyruleCastleEscape.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "true",
          source: "app/Region/Open/HyruleCastleEscape.php:22",
        },
      ],
      id: "escape",
      locations: [
        {
          id: "sanctuary",
          kind: "chest",
          name: "Sanctuary",
          req: "true",
          source: "app/Region/Open/HyruleCastleEscape.php:22",
        },
        {
          id: "sewers/secret-room/left",
          kind: "chest",
          name: "Sewers - Secret Room - Left",
          req: SECRET_ROOM,
          source: "app/Region/Open/HyruleCastleEscape.php:24",
        },
        {
          id: "sewers/secret-room/middle",
          kind: "chest",
          name: "Sewers - Secret Room - Middle",
          req: SECRET_ROOM,
          source: "app/Region/Open/HyruleCastleEscape.php:31",
        },
        {
          id: "sewers/secret-room/right",
          kind: "chest",
          name: "Sewers - Secret Room - Right",
          req: SECRET_ROOM,
          source: "app/Region/Open/HyruleCastleEscape.php:38",
        },
        {
          id: "sewers/dark-cross",
          kind: "chest",
          name: "Sewers - Dark Cross",
          req: "lamp >= setting(requireLamp) | setting(advancedPlacement) & fireRod",
          source: "app/Region/Open/HyruleCastleEscape.php:45",
        },
        {
          id: "hyrule-castle/boomerang-chest",
          kind: "chest",
          name: "Hyrule Castle - Boomerang Chest",
          req: LOCKED_DOOR,
          source: "app/Region/Open/HyruleCastleEscape.php:50",
        },
        {
          id: "hyrule-castle/map-chest",
          kind: "chest",
          name: "Hyrule Castle - Map Chest",
          req: "true",
          source: "app/Region/Open/HyruleCastleEscape.php:22",
        },
        {
          id: "hyrule-castle/zeldas-cell",
          kind: "chest",
          name: "Hyrule Castle - Zelda's Cell",
          req: LOCKED_DOOR,
          source: "app/Region/Open/HyruleCastleEscape.php:54",
        },
        {
          id: "links-uncle",
          kind: "npc",
          name: "Link's Uncle",
          req: "true",
          source: "app/Region/Open/HyruleCastleEscape.php:22",
        },
        {
          id: "secret-passage",
          kind: "chest",
          name: "Secret Passage",
          req: "true",
          source: "app/Region/Open/HyruleCastleEscape.php:22",
        },
        {
          // No can_complete: Region::canComplete is true (Region.php:201-207),
          // and Open gives RescueZelda at the start (Randomizer.php:133)
          id: "zelda",
          kind: "prize",
          name: "Zelda",
          req: "true",
          source: "app/Region/Open/HyruleCastleEscape.php:22",
        },
      ],
      name: "Escape",
      prize: "zelda",
      // Standard's $region_items (Standard/HyruleCastleEscape.php:18), which
      // this class inherits
      regionItems: {
        items: [
          "BigKey",
          "BigKeyH2",
          "Compass",
          "CompassH2",
          "Key",
          "KeyH2",
          "Map",
          "MapH2",
        ],
        source: "app/Region/Open/HyruleCastleEscape.php:14",
      },
    },
  ],
} as const satisfies RegionModule;
