// app/Region/Inverted/DarkWorld/South.php: South Dark World, from the Hype
// Cave to the Digging Game, and Link's House, which moves here (31).
//
// Its initalize (40-129) replaces Standard's without calling it: it sets no
// can_enter, so the region is always entered (Region.php:217-224), an
// entrance from the start cited at the class; a location it sets no rule
// for needs only its region (Location.php:96-111).
//
// Not ported here: the shops (26-29, 42-106), which are not locations.
import type { RegionModule } from "../../../world";

export const INVERTED_DARK_WORLD_SOUTH = {
  file: "app/Region/Inverted/DarkWorld/South.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/South.php:13",
        },
      ],
      id: "southDarkWorld",
      locations: [
        {
          id: "hype-cave/top",
          kind: "chest",
          name: "Hype Cave - Top",
          req: "@canBombThings",
          source: "app/Region/Inverted/DarkWorld/South.php:108",
        },
        {
          id: "hype-cave/middle-right",
          kind: "chest",
          name: "Hype Cave - Middle Right",
          req: "@canBombThings",
          source: "app/Region/Inverted/DarkWorld/South.php:112",
        },
        {
          id: "hype-cave/middle-left",
          kind: "chest",
          name: "Hype Cave - Middle Left",
          req: "@canBombThings",
          source: "app/Region/Inverted/DarkWorld/South.php:116",
        },
        {
          id: "hype-cave/bottom",
          kind: "chest",
          name: "Hype Cave - Bottom",
          req: "@canBombThings",
          source: "app/Region/Inverted/DarkWorld/South.php:120",
        },
        {
          id: "stumpy",
          kind: "npc",
          name: "Stumpy",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/South.php:40",
        },
        {
          id: "hype-cave/npc",
          kind: "npc",
          name: "Hype Cave - NPC",
          req: "@canBombThings",
          source: "app/Region/Inverted/DarkWorld/South.php:124",
        },
        {
          id: "digging-game",
          kind: "dig",
          name: "Digging Game",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/South.php:40",
        },
        {
          id: "links-house",
          kind: "chest",
          name: "Link's House",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/South.php:40",
        },
      ],
      name: "South Dark World",
    },
  ],
} as const satisfies RegionModule;
