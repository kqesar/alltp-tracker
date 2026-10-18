// app/Region/Inverted/LightWorld/NorthWest.php: the north west of the Light
// World, from the Lost Woods to Kakariko and the graveyard, and its
// locations.
//
// Its initalize (18-222) replaces Standard's without calling it: a location
// it sets no rule for needs only its region (Location.php:96-111).
//
// Not ported here: the shops (20-33), which are not locations.
import type { RegionModule } from "../../../world";

/** Link and not a bunny: the pearl, or a glitch that does as much. */
const PEARL =
  "moonPearl | setting(canBunnyRevive) & @canBunnyRevive | setting(canOWYBA) & @hasABottle";

/** Kakariko Well's chests below its entrance (86-116). */
const KAKARIKO_WELL = `${PEARL} | setting(canSuperBunny)`;

/** Blind's Hideout's chests below its entrance (126-156). */
const BLINDS_HIDEOUT = `${PEARL} | setting(canSuperBunny) & magicMirror`;

export const INVERTED_LIGHT_WORLD_NORTH_WEST = {
  file: "app/Region/Inverted/LightWorld/NorthWest.php",
  regions: [
    {
      // can_enter (217-219)
      entrances: [
        {
          from: "northEastLightWorld",
          req: "true",
          source: "app/Region/Inverted/LightWorld/NorthWest.php:218",
        },
      ],
      id: "northWestLightWorld",
      locations: [
        {
          id: "master-sword-pedestal",
          kind: "pedestal",
          name: "Master Sword Pedestal",
          req: "pendantOfPower & pendantOfWisdom & pendantOfCourage",
          source: "app/Region/Inverted/LightWorld/NorthWest.php:36",
          // Its tablet, read with the Book, names the item
          visible: { req: "bookOfMudora", source: "game" },
        },
        {
          id: "kings-tomb",
          kind: "chest",
          name: "King's Tomb",
          // hasABottle(2) takes no argument (ItemCollection.php:709): one
          // bottle does (59)
          req: `pegasusBoots & (${PEARL}) & (@canLiftDarkRocks | setting(canMirrorClip) & magicMirror & moonPearl & setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW) | reach(eastDeathMountain) & setting(canSuperSpeed) & @canSpinSpeed & (moonPearl | setting(canOWYBA) & @hasABottle))`,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:42",
        },
        {
          id: "kakariko-tavern",
          kind: "chest",
          name: "Kakariko Tavern",
          // 65 reads 'cantTakeDamage', a key no config sets (the setting is
          // region.cantTakeDamage): its negation is always true
          req: `${PEARL} | setting(canSuperBunny)`,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:62",
        },
        {
          id: "chicken-house",
          kind: "chest",
          name: "Chicken House",
          req: PEARL,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:71",
        },
        {
          id: "kakariko-well/top",
          kind: "chest",
          name: "Kakariko Well - Top",
          req: `@canBombThings & (${PEARL})`,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:78",
        },
        {
          id: "kakariko-well/left",
          kind: "chest",
          name: "Kakariko Well - Left",
          req: KAKARIKO_WELL,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:86",
        },
        {
          id: "kakariko-well/middle",
          kind: "chest",
          name: "Kakariko Well - Middle",
          req: KAKARIKO_WELL,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:94",
        },
        {
          id: "kakariko-well/right",
          kind: "chest",
          name: "Kakariko Well - Right",
          req: KAKARIKO_WELL,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:102",
        },
        {
          id: "kakariko-well/bottom",
          kind: "chest",
          name: "Kakariko Well - Bottom",
          req: KAKARIKO_WELL,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:110",
        },
        {
          id: "blinds-hideout/top",
          kind: "chest",
          name: "Blind's Hideout - Top",
          req: `@canBombThings & (${PEARL})`,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:118",
        },
        {
          id: "blinds-hideout/left",
          kind: "chest",
          name: "Blind's Hideout - Left",
          req: BLINDS_HIDEOUT,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:126",
        },
        {
          id: "blinds-hideout/right",
          kind: "chest",
          name: "Blind's Hideout - Right",
          req: BLINDS_HIDEOUT,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:134",
        },
        {
          id: "blinds-hideout/far-left",
          kind: "chest",
          name: "Blind's Hideout - Far Left",
          req: BLINDS_HIDEOUT,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:142",
        },
        {
          id: "blinds-hideout/far-right",
          kind: "chest",
          name: "Blind's Hideout - Far Right",
          req: BLINDS_HIDEOUT,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:150",
        },
        {
          id: "pegasus-rocks",
          kind: "chest",
          name: "Pegasus Rocks",
          req: `pegasusBoots & (${PEARL})`,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:158",
        },
        {
          id: "bottle-merchant",
          kind: "npc",
          name: "Bottle Merchant",
          req: "true",
          source: "app/Region/Inverted/LightWorld/NorthWest.php:18",
        },
        {
          id: "magic-bat",
          kind: "npc",
          name: "Magic Bat",
          req: `powder & (${PEARL}) & (hammer | (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW)) & (setting(canFakeFlipper) | flippers))`,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:166",
        },
        {
          id: "sick-kid",
          kind: "npc",
          name: "Sick Kid",
          req: "@hasABottle",
          source: "app/Region/Inverted/LightWorld/NorthWest.php:179",
        },
        {
          id: "lost-woods-hideout",
          kind: "standing",
          name: "Lost Woods Hideout",
          req: PEARL,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:210",
        },
        {
          id: "lumberjack-tree",
          kind: "standing",
          name: "Lumberjack Tree",
          req: `defeatAgahnim & (pegasusBoots & (${PEARL}) | setting(canOneFrameClipOW) | setting(canMirrorWrap) & magicMirror)`,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:183",
        },
        {
          id: "graveyard-ledge",
          kind: "standing",
          name: "Graveyard Ledge",
          req: `(${PEARL}) & @canBombThings`,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:195",
        },
        {
          id: "mushroom",
          kind: "standing",
          name: "Mushroom",
          req: PEARL,
          source: "app/Region/Inverted/LightWorld/NorthWest.php:203",
        },
      ],
      name: "North West Light World",
    },
  ],
} as const satisfies RegionModule;
