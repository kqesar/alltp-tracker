// app/Region/Inverted/LightWorld/NorthEast.php: the north east of the Light
// World, from Sahasrahla's village to Zora's waterfall, and Ganon, its
// prize, who moves here from the Dark World (19-22).
//
// Its initalize (30-231) replaces Standard's without calling it: a location
// it sets no rule for needs only its region (Location.php:96-111).
import type { RegionModule } from "../../../world";

/** Link and not a bunny: the pearl, or a glitch that does as much. */
const PEARL =
  "moonPearl | setting(canBunnyRevive) & @canBunnyRevive | setting(canOWYBA) & @hasABottle";

/** Each of Sahasrahla's Hut's chests (32-63), behind a bombable wall. */
const SAHASRAHLAS_HUT =
  "(moonPearl | setting(canOWYBA) & @hasABottle) & @canBombThings | setting(canSuperBunny) & pegasusBoots & (magicMirror | !setting(cantTakeDamage))";

/** King Zora (69-81), where Zora's Ledge is seen. */
const KING_ZORA =
  "(moonPearl | setting(canOWYBA) & @hasABottle) & (@canLiftRocks | setting(canFakeFlipper) | flippers | (setting(canBootsClip) | setting(canWaterWalk)) & pegasusBoots | setting(canSuperSpeed) & @canSpinSpeed & reach(eastDeathMountain)) | setting(canOneFrameClipOW)";

/** Both chests behind the waterfall (110-142). */
const WATERFALL_FAIRY = `(${PEARL}) & (setting(canFakeFlipper) | setting(canWaterWalk) & (pegasusBoots | moonPearl) | flippers | reach(eastDeathMountain) & (setting(canBootsClip) & pegasusBoots | setting(canSuperSpeed) & @canSpinSpeed | setting(canOneFrameClipOW)))`;

/**
 * Ganon (144-206). Each `return false` guard is its positive form, ANDed
 * in: the dungeons goal wants every pendant, crystal and Agahnim, and the
 * ganon and fast_ganon goals want crystals.ganon crystals. Then Link, not a
 * bunny (or, with Super Bunny, a beam stored in Ganon's Tower), Agahnim 2
 * (but for fast_ganon), silvers when the run wants a better bow, and a sword
 * or, swordless, the hammer, with the lamp or the Fire Rod and the magic for
 * it, less with the pearl.
 */
const GANON = [
  "(!setting(dungeonsGoal) | pendantOfCourage & pendantOfWisdom & pendantOfPower & defeatAgahnim & crystal1 & crystal2 & crystal3 & crystal4 & crystal5 & crystal6 & crystal7 & defeatAgahnim2)",
  "(!setting(ganonGoal) & !setting(fastGanonGoal) | count(crystal) >= setting(crystalsGanon))",
  `(${PEARL} | setting(canSuperBunny) & setting(canDungeonRevive) & reach(ganonsTower) & caneOfSomaria & magicMirror & @hasABottle)`,
  "(defeatAgahnim2 | setting(fastGanonGoal))",
  "(!setting(requireBetterBow) | @canShootArrows2)",
  "(setting(swordless) & hammer & (lamp >= setting(requireLamp) | fireRod & (@canExtendMagic & moonPearl | @canExtendMagic3)) | !setting(requireBetterSword) & @hasSword2 & (lamp >= setting(requireLamp) | fireRod & (@canExtendMagic3 & moonPearl | @canExtendMagic4)) | @hasSword3 & (lamp >= setting(requireLamp) | fireRod & (@canExtendMagic & moonPearl | @canExtendMagic3)))",
].join(" & ");

export const INVERTED_LIGHT_WORLD_NORTH_EAST = {
  file: "app/Region/Inverted/LightWorld/NorthEast.php",
  regions: [
    {
      // can_enter (208-228)
      entrances: [
        {
          from: "start",
          req: "defeatAgahnim",
          source: "app/Region/Inverted/LightWorld/NorthEast.php:210",
        },
        {
          from: "start",
          req: "moonPearl & (hammer & @canLiftRocks | @canLiftDarkRocks)",
          source: "app/Region/Inverted/LightWorld/NorthEast.php:211",
        },
        {
          from: "start",
          req: "@canFly & @canLiftDarkRocks",
          source: "app/Region/Inverted/LightWorld/NorthEast.php:215",
        },
        // hasABottle(2) takes no argument (ItemCollection.php:709): one
        // bottle does, with or without the lamp (218-220)
        {
          from: "start",
          req: "setting(canOWYBA) & @hasABottle",
          source: "app/Region/Inverted/LightWorld/NorthEast.php:217",
        },
        {
          from: "westDeathMountain",
          req: "(moonPearl | magicMirror) & (setting(canSuperSpeed) & @canSpinSpeed | setting(canBootsClip) & pegasusBoots)",
          source: "app/Region/Inverted/LightWorld/NorthEast.php:221",
        },
        {
          from: "start",
          req: "setting(canOneFrameClipOW)",
          source: "app/Region/Inverted/LightWorld/NorthEast.php:227",
        },
      ],
      id: "northEastLightWorld",
      locations: [
        {
          id: "sahasrahlas-hut/left",
          kind: "chest",
          name: "Sahasrahla's Hut - Left",
          req: SAHASRAHLAS_HUT,
          source: "app/Region/Inverted/LightWorld/NorthEast.php:32",
        },
        {
          id: "sahasrahlas-hut/middle",
          kind: "chest",
          name: "Sahasrahla's Hut - Middle",
          req: SAHASRAHLAS_HUT,
          source: "app/Region/Inverted/LightWorld/NorthEast.php:43",
        },
        {
          id: "sahasrahlas-hut/right",
          kind: "chest",
          name: "Sahasrahla's Hut - Right",
          req: SAHASRAHLAS_HUT,
          source: "app/Region/Inverted/LightWorld/NorthEast.php:54",
        },
        {
          id: "sahasrahla",
          kind: "npc",
          name: "Sahasrahla",
          req: "pendantOfCourage",
          source: "app/Region/Inverted/LightWorld/NorthEast.php:65",
        },
        {
          id: "king-zora",
          kind: "npc",
          name: "King Zora",
          req: KING_ZORA,
          source: "app/Region/Inverted/LightWorld/NorthEast.php:69",
        },
        {
          id: "potion-shop",
          kind: "npc",
          name: "Potion Shop",
          req: `(${PEARL} | setting(canOneFrameClipOW)) & mushroom`,
          source: "app/Region/Inverted/LightWorld/NorthEast.php:83",
        },
        {
          id: "zoras-ledge",
          kind: "standing",
          name: "Zora's Ledge",
          req: `(${PEARL}) & (flippers | setting(canWaterWalk) & (setting(canFakeFlipper) & moonPearl & setting(canOneFrameClipOW) | (setting(canBootsClip) | setting(canOneFrameClipOW) | setting(canSuperSpeed) & @canSpinSpeed) & pegasusBoots))`,
          source: "app/Region/Inverted/LightWorld/NorthEast.php:93",
          // Seen from the waterfall's shore, which King Zora's way leads to
          visible: { req: KING_ZORA, source: "game" },
        },
        {
          id: "waterfall-fairy/left",
          kind: "chest",
          name: "Waterfall Fairy - Left",
          req: WATERFALL_FAIRY,
          source: "app/Region/Inverted/LightWorld/NorthEast.php:110",
        },
        {
          id: "waterfall-fairy/right",
          kind: "chest",
          name: "Waterfall Fairy - Right",
          req: WATERFALL_FAIRY,
          source: "app/Region/Inverted/LightWorld/NorthEast.php:127",
        },
        {
          id: "ganon",
          kind: "prize",
          name: "Ganon",
          req: GANON,
          source: "app/Region/Inverted/LightWorld/NorthEast.php:144",
        },
      ],
      name: "North East Light World",
      prize: "ganon",
    },
  ],
} as const satisfies RegionModule;
