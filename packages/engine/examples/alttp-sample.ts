/**
 * A slice of A Link to the Past written as an @alltp/engine world.
 *
 * It demonstrates the data format only. The requirements are simplified and
 * NOT the randomizer's logic: Phase 2 ports the real rules from the
 * randomizer's source (sporchia/alttp_vt_randomizer), citing each rule.
 */
import {
  type CompiledWorld,
  compileWorld,
  loadRules,
  type World,
} from "../src/index";

/**
 * Every item id, as the tracker stores them (`glove` and `sword` count
 * upgrades). `agahnim` is the "Agahnim beaten" flag the player toggles.
 */
export const SAMPLE_ITEMS = [
  "agahnim",
  "book",
  "boots",
  "bow",
  "cape",
  "crystal1",
  "crystal2",
  "crystal3",
  "crystal4",
  "crystal5",
  "crystal6",
  "crystal7",
  "firerod",
  "flippers",
  "flute",
  "glove",
  "hammer",
  "hookshot",
  "lantern",
  "mirror",
  "moonpearl",
  "net",
  "sword",
] as const;

export const sampleRules = loadRules({
  groups: {
    crystal: [
      "crystal1",
      "crystal2",
      "crystal3",
      "crystal4",
      "crystal5",
      "crystal6",
      "crystal7",
    ],
  },
  helpers: {
    canKillMostThings: "sword | hammer | bow | firerod",
    canLiftDarkRocks: "glove >= 2",
    canLiftRocks: "glove",
    canLightTorches: "firerod | lantern",
  },
});

export const sampleWorld: World = {
  regions: [
    {
      exits: [
        // The Old Man's cave is dark: without a lantern it is a maybe.
        { req: "flute | @canLiftRocks & ?lantern", to: "deathMountainWest" },
        { req: "cape | sword >= 2", to: "castleTower" },
        // Beating Agahnim opens the pyramid; the player flags it.
        { req: "agahnim", to: "darkWorldNorthEast" },
        {
          req: "moonpearl & (@canLiftDarkRocks | hammer & @canLiftRocks)",
          to: "darkWorldSouth",
        },
      ],
      id: "lightWorld",
      locations: [
        { id: "linksUncle" },
        { id: "sanctuary" },
        { id: "library", req: "boots" },
        { id: "zoraLedge", req: "flippers" },
        { id: "kingsTomb", req: "boots & @canLiftDarkRocks" },
      ],
    },
    {
      exits: [
        { to: "lightWorld" },
        { req: "hookshot | mirror & hammer", to: "deathMountainEast" },
        { req: "mirror | hookshot & hammer", to: "towerOfHera" },
      ],
      id: "deathMountainWest",
      locations: [
        { id: "oldMan", req: "?lantern" },
        { id: "spectacleRockCave" },
        { id: "spectacleRock", req: "mirror" },
        { id: "etherTablet", req: "book & mirror & sword >= 2" },
      ],
    },
    {
      exits: [
        { to: "deathMountainWest" },
        { req: "moonpearl & @canLiftDarkRocks", to: "darkDeathMountain" },
      ],
      id: "deathMountainEast",
      locations: [{ id: "spiralCave" }, { id: "paradoxCave" }],
    },
    {
      exits: [{ to: "deathMountainWest" }],
      id: "towerOfHera",
      locations: [
        { id: "heraBasement", req: "@canLightTorches" },
        { id: "heraBoss", req: "@canKillMostThings" },
      ],
    },
    {
      exits: [{ to: "lightWorld" }],
      id: "castleTower",
      locations: [
        // The tower's maze is a dark room.
        { id: "castleTowerChests", req: "?lantern" },
        { id: "agahnimFight", req: "?lantern & (sword | net)" },
      ],
    },
    {
      exits: [
        { req: "moonpearl & (hammer | @canLiftRocks)", to: "darkWorldSouth" },
      ],
      id: "darkWorldNorthEast",
      locations: [
        { id: "pyramidLedge" },
        { id: "catfish", req: "moonpearl & @canLiftRocks" },
      ],
    },
    {
      exits: [{ req: "moonpearl", to: "darkWorldNorthWest" }],
      id: "darkWorldSouth",
      locations: [
        { id: "stumpy", req: "moonpearl" },
        { id: "hypeCave", req: "moonpearl" },
      ],
    },
    {
      exits: [{ to: "darkWorldSouth" }],
      id: "darkWorldNorthWest",
      locations: [
        { id: "chestGame", req: "moonpearl" },
        // Visible from below without the cape: shown as a maybe.
        {
          id: "bumperCaveLedge",
          req: "moonpearl & cape & @canLiftRocks | maybe",
        },
      ],
    },
    {
      exits: [{ to: "deathMountainEast" }],
      id: "darkDeathMountain",
      locations: [
        { id: "superbunnyCave", req: "moonpearl" },
        { id: "bobsTorch", req: "count(crystal) >= 7 & boots" },
      ],
    },
  ],
  start: "lightWorld",
};

/** The sample, checked against its item list and ready for `solve`. */
export function compileSample(): CompiledWorld {
  return compileWorld(sampleWorld, sampleRules, { items: SAMPLE_ITEMS });
}
