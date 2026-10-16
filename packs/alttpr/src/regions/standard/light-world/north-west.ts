// app/Region/Standard/LightWorld/NorthWest.php: the north west of the Light
// World, from the Lost Woods to Kakariko and the graveyard, and its
// locations.
//
// Not ported here: the shops (Kakariko Shop and the take-any caves, 56-71,
// and the Bomb Hut's rule, 82-84), which are not locations.
import type { RegionModule } from "../../../world";

export const LIGHT_WORLD_NORTH_WEST = {
  file: "app/Region/Standard/LightWorld/NorthWest.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "rescueZelda",
          source: "app/Region/Standard/LightWorld/NorthWest.php:141",
        },
      ],
      id: "northWestLightWorld",
      locations: [
        {
          id: "master-sword-pedestal",
          kind: "pedestal",
          name: "Master Sword Pedestal",
          req: "(!setting(basicPlacement) | bookOfMudora) & pendantOfPower & pendantOfWisdom & pendantOfCourage",
          source: "app/Region/Standard/LightWorld/NorthWest.php:86",
          // Its tablet, read with the Book, names the item
          visible: { req: "bookOfMudora", source: "game" },
        },
        {
          id: "kings-tomb",
          kind: "chest",
          name: "King's Tomb",
          req: "pegasusBoots & (setting(canBootsClip) | @canLiftDarkRocks | setting(canOneFrameClipOW) | setting(canSuperSpeed) & @canSpinSpeed | magicMirror & reach(northWestDarkWorld) & (moonPearl | @hasABottle & setting(canOWYBA) | setting(canBunnyRevive) & @canBunnyRevive))",
          source: "app/Region/Standard/LightWorld/NorthWest.php:93",
        },
        {
          id: "kakariko-tavern",
          kind: "chest",
          name: "Kakariko Tavern",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:34",
        },
        {
          id: "chicken-house",
          kind: "chest",
          name: "Chicken House",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:35",
        },
        {
          id: "kakariko-well/top",
          kind: "chest",
          name: "Kakariko Well - Top",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:36",
        },
        {
          id: "kakariko-well/left",
          kind: "chest",
          name: "Kakariko Well - Left",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:37",
        },
        {
          id: "kakariko-well/middle",
          kind: "chest",
          name: "Kakariko Well - Middle",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:38",
        },
        {
          id: "kakariko-well/right",
          kind: "chest",
          name: "Kakariko Well - Right",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:39",
        },
        {
          id: "kakariko-well/bottom",
          kind: "chest",
          name: "Kakariko Well - Bottom",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:40",
        },
        {
          id: "blinds-hideout/top",
          kind: "chest",
          name: "Blind's Hideout - Top",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:41",
        },
        {
          id: "blinds-hideout/left",
          kind: "chest",
          name: "Blind's Hideout - Left",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:42",
        },
        {
          id: "blinds-hideout/right",
          kind: "chest",
          name: "Blind's Hideout - Right",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:43",
        },
        {
          id: "blinds-hideout/far-left",
          kind: "chest",
          name: "Blind's Hideout - Far Left",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:44",
        },
        {
          id: "blinds-hideout/far-right",
          kind: "chest",
          name: "Blind's Hideout - Far Right",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:45",
        },
        {
          id: "pegasus-rocks",
          kind: "chest",
          name: "Pegasus Rocks",
          req: "pegasusBoots",
          source: "app/Region/Standard/LightWorld/NorthWest.php:104",
        },
        {
          id: "bottle-merchant",
          kind: "npc",
          name: "Bottle Merchant",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:47",
        },
        {
          id: "magic-bat",
          kind: "npc",
          name: "Magic Bat",
          req: "powder & (hammer | (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW)) & setting(canTransitionWrapped) & (flippers | setting(canFakeFlipper)) | magicMirror & (setting(canMirrorWrap) & reach(northWestDarkWorld) | (moonPearl | @hasABottle & setting(canOWYBA) | setting(canBunnyRevive) & @canBunnyRevive) & (@canLiftDarkRocks & reach(northWestDarkWorld) | setting(canSuperSpeed) & @canSpinSpeed & (flippers | setting(canFakeFlipper)) & reach(northEastDarkWorld))))",
          source: "app/Region/Standard/LightWorld/NorthWest.php:108",
        },
        {
          id: "sick-kid",
          kind: "npc",
          name: "Sick Kid",
          req: "@hasABottle",
          source: "app/Region/Standard/LightWorld/NorthWest.php:124",
        },
        {
          id: "lost-woods-hideout",
          kind: "standing",
          name: "Lost Woods Hideout",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:50",
        },
        {
          id: "lumberjack-tree",
          kind: "standing",
          name: "Lumberjack Tree",
          req: "defeatAgahnim & pegasusBoots",
          source: "app/Region/Standard/LightWorld/NorthWest.php:128",
        },
        {
          id: "graveyard-ledge",
          kind: "standing",
          name: "Graveyard Ledge",
          req: "setting(canBootsClip) & pegasusBoots | setting(canSuperSpeed) & @canSpinSpeed | setting(canOneFrameClipOW) | magicMirror & reach(northWestDarkWorld) & (moonPearl | @hasABottle & setting(canOWYBA) | setting(canBunnyRevive) & @canBunnyRevive)",
          source: "app/Region/Standard/LightWorld/NorthWest.php:132",
        },
        {
          id: "mushroom",
          kind: "standing",
          name: "Mushroom",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthWest.php:53",
        },
      ],
      name: "North West Light World",
    },
  ],
} as const satisfies RegionModule;
