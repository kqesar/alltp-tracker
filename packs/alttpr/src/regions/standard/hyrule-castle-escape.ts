// app/Region/Standard/HyruleCastleEscape.php: the escape of a Standard
// world, from Link's Uncle to the Sanctuary, its locations and its prize,
// Zelda. Open's escape builds the same locations under other rules
// (regions/open/hyrule-castle-escape.ts).
//
// Not ported here: the fill rules of the Secret Passage (101-106) and Link's
// Uncle (108-114), which Location::canFill reads when the randomizer places
// an item; they wait for src/fill.ts.
import type { RegionModule } from "../../world";

/**
 * The Sanctuary (67-69), whose rule is the prize's too: can_complete is the
 * Sanctuary's canAccess (116-120), Zelda led there through the sewers.
 */
const SANCTUARY = "@canKillEscapeThings & keyH2";

export const HYRULE_CASTLE_ESCAPE = {
  file: "app/Region/Standard/HyruleCastleEscape.php",
  regions: [
    {
      // No can_enter (initalize, 65, sets none): entered from anywhere
      entrances: [
        {
          from: "start",
          req: "true",
          source: "app/Region/Standard/HyruleCastleEscape.php:65",
        },
      ],
      id: "escape",
      locations: [
        {
          id: "sanctuary",
          kind: "chest",
          name: "Sanctuary",
          req: SANCTUARY,
          source: "app/Region/Standard/HyruleCastleEscape.php:67",
        },
        {
          id: "sewers/secret-room/left",
          kind: "chest",
          name: "Sewers - Secret Room - Left",
          req: "@canKillEscapeThings & keyH2",
          source: "app/Region/Standard/HyruleCastleEscape.php:71",
        },
        {
          id: "sewers/secret-room/middle",
          kind: "chest",
          name: "Sewers - Secret Room - Middle",
          req: "@canKillEscapeThings & keyH2",
          source: "app/Region/Standard/HyruleCastleEscape.php:75",
        },
        {
          id: "sewers/secret-room/right",
          kind: "chest",
          name: "Sewers - Secret Room - Right",
          req: "@canKillEscapeThings & keyH2",
          source: "app/Region/Standard/HyruleCastleEscape.php:79",
        },
        {
          id: "sewers/dark-cross",
          kind: "chest",
          name: "Sewers - Dark Cross",
          req: "@canKillEscapeThings",
          source: "app/Region/Standard/HyruleCastleEscape.php:83",
        },
        {
          id: "hyrule-castle/boomerang-chest",
          kind: "chest",
          name: "Hyrule Castle - Boomerang Chest",
          req: "@canKillEscapeThings",
          source: "app/Region/Standard/HyruleCastleEscape.php:87",
        },
        {
          id: "hyrule-castle/map-chest",
          kind: "chest",
          name: "Hyrule Castle - Map Chest",
          req: "@canKillEscapeThings",
          source: "app/Region/Standard/HyruleCastleEscape.php:91",
        },
        {
          id: "hyrule-castle/zeldas-cell",
          kind: "chest",
          name: "Hyrule Castle - Zelda's Cell",
          req: "@canKillEscapeThings",
          source: "app/Region/Standard/HyruleCastleEscape.php:95",
        },
        {
          id: "links-uncle",
          kind: "npc",
          name: "Link's Uncle",
          req: "true",
          source: "app/Region/Standard/HyruleCastleEscape.php:49",
        },
        {
          id: "secret-passage",
          kind: "chest",
          name: "Secret Passage",
          req: "@canKillEscapeThings",
          source: "app/Region/Standard/HyruleCastleEscape.php:99",
        },
        {
          id: "zelda",
          kind: "prize",
          name: "Zelda",
          req: SANCTUARY,
          source: "app/Region/Standard/HyruleCastleEscape.php:116",
        },
      ],
      name: "Escape",
      prize: "zelda",
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
        source: "app/Region/Standard/HyruleCastleEscape.php:18",
      },
    },
  ],
} as const satisfies RegionModule;
