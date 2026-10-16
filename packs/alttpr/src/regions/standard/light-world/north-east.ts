// app/Region/Standard/LightWorld/NorthEast.php: the north east of the Light
// World, from Sahasrahla's village to Zora's waterfall, and its locations.
//
// Not ported here: the shops (Long Fairy Cave and Lake Hylia Fairy, 43-46),
// which are not locations.
import type { RegionModule } from "../../../world";

/** The way to King Zora's waterfall (63-69), where Zora's Ledge is seen. */
const KING_ZORA =
  "setting(canFakeFlipper) | (setting(canWaterWalk) | setting(canBootsClip)) & pegasusBoots | setting(canOneFrameClipOW) | @canLiftRocks | flippers";

/** Both chests behind the waterfall (85-95). */
const WATERFALL_FAIRY =
  "flippers | setting(canWaterWalk) & (pegasusBoots | moonPearl & setting(canFakeFlipper))";

export const LIGHT_WORLD_NORTH_EAST = {
  file: "app/Region/Standard/LightWorld/NorthEast.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "rescueZelda",
          source: "app/Region/Standard/LightWorld/NorthEast.php:97",
        },
      ],
      id: "northEastLightWorld",
      locations: [
        {
          id: "sahasrahlas-hut/left",
          kind: "chest",
          name: "Sahasrahla's Hut - Left",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthEast.php:32",
        },
        {
          id: "sahasrahlas-hut/middle",
          kind: "chest",
          name: "Sahasrahla's Hut - Middle",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthEast.php:33",
        },
        {
          id: "sahasrahlas-hut/right",
          kind: "chest",
          name: "Sahasrahla's Hut - Right",
          req: "true",
          source: "app/Region/Standard/LightWorld/NorthEast.php:34",
        },
        {
          id: "sahasrahla",
          kind: "npc",
          name: "Sahasrahla",
          req: "pendantOfCourage",
          source: "app/Region/Standard/LightWorld/NorthEast.php:59",
        },
        {
          id: "king-zora",
          kind: "npc",
          name: "King Zora",
          req: KING_ZORA,
          source: "app/Region/Standard/LightWorld/NorthEast.php:63",
        },
        {
          id: "potion-shop",
          kind: "npc",
          name: "Potion Shop",
          req: "mushroom",
          source: "app/Region/Standard/LightWorld/NorthEast.php:71",
        },
        {
          id: "zoras-ledge",
          kind: "standing",
          name: "Zora's Ledge",
          req: "flippers | pegasusBoots & setting(canWaterWalk) & (setting(canFakeFlipper) | setting(canSuperSpeed) & @canSpinSpeed | setting(canBootsClip) | setting(canOneFrameClipOW))",
          source: "app/Region/Standard/LightWorld/NorthEast.php:75",
          // Seen from the waterfall's shore, which King Zora's way leads to
          visible: { req: KING_ZORA, source: "game" },
        },
        {
          id: "waterfall-fairy/left",
          kind: "chest",
          name: "Waterfall Fairy - Left",
          req: WATERFALL_FAIRY,
          source: "app/Region/Standard/LightWorld/NorthEast.php:85",
        },
        {
          id: "waterfall-fairy/right",
          kind: "chest",
          name: "Waterfall Fairy - Right",
          req: WATERFALL_FAIRY,
          source: "app/Region/Standard/LightWorld/NorthEast.php:91",
        },
      ],
      name: "North East Light World",
    },
  ],
} as const satisfies RegionModule;
