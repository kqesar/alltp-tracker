// app/Region/Standard/DarkWorld/NorthEast.php: North East Dark World, the
// pyramid and its fairy, and Ganon, its prize.
//
// Not ported here: the shops (44-55, 74-93), which are not locations; the
// fixed items of the fairy's sword and bow (59-60), which the fill reads.
import type { RegionModule } from "../../../world";

/**
 * Getting into the Pyramid Fairy's cave, which each of its four rules
 * holds (103-153): both crystals, South Dark World, and the pearl and the
 * hammer, or the mirror once Agahnim fell; or a mirror clip.
 */
const FAIRY =
  "crystal5 & crystal6 & reach(southDarkWorld) & (moonPearl & hammer | setting(canOWYBA) & @hasABottle | magicMirror & defeatAgahnim) | setting(canMirrorClip) & magicMirror & (setting(canSuperSpeed) & @canSpinSpeed | setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots)";

/** Ways to cross to the pyramid after the dark rocks (179-183). */
const CROSS =
  "hammer | flippers | magicMirror & setting(canMirrorWrap) & @canLiftRocks | setting(canBunnyRevive) & @canBunnyRevive | setting(canWaterWalk) & pegasusBoots | setting(canFakeFlipper) & !setting(cantTakeDamage)";

/**
 * Ganon (186-234). Each `return false` guard is its positive form, ANDed
 * in: the ganonhunt goal wants the pieces it asks for (187-192), the
 * dungeons goal every pendant, crystal and Agahnim, and the ganon and
 * fast_ganon goals crystals.ganon crystals. Then the pearl, Agahnim 2 (but
 * for fast_ganon and ganonhunt), silvers when the run wants a better bow,
 * and a sword or, swordless, the hammer, with the lamp or the Fire Rod and
 * the magic for it.
 */
const GANON = [
  "(!setting(ganonhuntGoal) | ganonhuntPieces)",
  "(!setting(dungeonsGoal) | pendantOfCourage & pendantOfWisdom & pendantOfPower & defeatAgahnim & crystal1 & crystal2 & crystal3 & crystal4 & crystal5 & crystal6 & crystal7 & defeatAgahnim2)",
  "(!setting(ganonGoal) & !setting(fastGanonGoal) | count(crystal) >= setting(crystalsGanon))",
  "(moonPearl | setting(canOWYBA) & @hasABottle)",
  "(defeatAgahnim2 | setting(fastGanonGoal) | setting(ganonhuntGoal))",
  "(!setting(requireBetterBow) | @canShootArrows2)",
  "(setting(swordless) & hammer & (lamp >= setting(requireLamp) | fireRod & @canExtendMagic1) | !setting(requireBetterSword) & @hasSword2 & (lamp >= setting(requireLamp) | fireRod & @canExtendMagic3) | @hasSword3 & (lamp >= setting(requireLamp) | fireRod & @canExtendMagic))",
].join(" & ");

export const DARK_WORLD_NORTH_EAST = {
  file: "app/Region/Standard/DarkWorld/NorthEast.php",
  regions: [
    {
      // can_enter (156-184): RescueZelda, and one of its branches
      entrances: [
        {
          from: "start",
          req: "rescueZelda & setting(canOWYBA) & @hasABottle",
          source: "app/Region/Standard/DarkWorld/NorthEast.php:158",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canOneFrameClipOW)",
          source: "app/Region/Standard/DarkWorld/NorthEast.php:159",
        },
        {
          from: "start",
          req: "rescueZelda & moonPearl & setting(canBootsClip) & pegasusBoots",
          source: "app/Region/Standard/DarkWorld/NorthEast.php:160",
        },
        {
          from: "westDeathMountain",
          req: "rescueZelda & magicMirror & setting(canMirrorClip) & (setting(canBootsClip) & pegasusBoots | setting(canBunnyRevive) & @canBunnyRevive | setting(canSuperSpeed) & @canSpinSpeed | moonPearl & setting(canFakeFlipper))",
          source: "app/Region/Standard/DarkWorld/NorthEast.php:161",
        },
        {
          from: "start",
          req: "rescueZelda & defeatAgahnim",
          source: "app/Region/Standard/DarkWorld/NorthEast.php:167",
        },
        {
          from: "westDeathMountain",
          req: "rescueZelda & magicMirror & setting(canMirrorWrap) & setting(canBunnyRevive) & @canBunnyRevive & (setting(canSuperSpeed) & @canSpinSpeed | setting(canBootsClip) & pegasusBoots | setting(canMirrorClip))",
          source: "app/Region/Standard/DarkWorld/NorthEast.php:168",
        },
        {
          from: "start",
          req: "rescueZelda & hammer & @canLiftRocks & moonPearl",
          source: "app/Region/Standard/DarkWorld/NorthEast.php:174",
        },
        // 175-183: the dark rocks, or a clip down from West Death Mountain,
        // then the pearl and a way across
        {
          from: "start",
          req: `rescueZelda & @canLiftDarkRocks & moonPearl & (${CROSS})`,
          source: "app/Region/Standard/DarkWorld/NorthEast.php:175",
        },
        {
          from: "westDeathMountain",
          req: `rescueZelda & (setting(canSuperSpeed) & @canSpinSpeed | magicMirror & setting(canMirrorClip)) & moonPearl & (${CROSS})`,
          source: "app/Region/Standard/DarkWorld/NorthEast.php:175",
        },
      ],
      id: "northEastDarkWorld",
      locations: [
        {
          id: "catfish",
          kind: "standing",
          name: "Catfish",
          req: "(setting(canBunnyRevive) & @canBunnyRevive | moonPearl | setting(canOWYBA) & @hasABottle) & (setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots | @canLiftRocks)",
          source: "app/Region/Standard/DarkWorld/NorthEast.php:95",
        },
        {
          id: "pyramid",
          kind: "standing",
          name: "Pyramid",
          req: "true",
          source: "app/Region/Standard/DarkWorld/NorthEast.php:33",
          visible: { source: "game" },
        },
        {
          id: "pyramid-fairy/sword",
          kind: "trade",
          name: "Pyramid Fairy - Sword",
          req: `@hasSword & (${FAIRY})`,
          source: "app/Region/Standard/DarkWorld/NorthEast.php:103",
        },
        {
          id: "pyramid-fairy/bow",
          kind: "trade",
          name: "Pyramid Fairy - Bow",
          req: `@canShootArrows & (${FAIRY})`,
          source: "app/Region/Standard/DarkWorld/NorthEast.php:116",
        },
        {
          id: "ganon",
          kind: "prize",
          name: "Ganon",
          req: GANON,
          source: "app/Region/Standard/DarkWorld/NorthEast.php:186",
        },
        // The fairy's two chests exist only with swords in the pool (39-42,
        // 130): without, they are never in logic
        {
          id: "pyramid-fairy/left",
          kind: "chest",
          name: "Pyramid Fairy - Left",
          req: `setting(swordsInPool) & (${FAIRY})`,
          source: "app/Region/Standard/DarkWorld/NorthEast.php:131",
        },
        {
          id: "pyramid-fairy/right",
          kind: "chest",
          name: "Pyramid Fairy - Right",
          req: `setting(swordsInPool) & (${FAIRY})`,
          source: "app/Region/Standard/DarkWorld/NorthEast.php:143",
        },
      ],
      name: "North East Dark World",
      prize: "ganon",
    },
  ],
} as const satisfies RegionModule;
