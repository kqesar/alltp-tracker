import {
  canReachDarkWorld,
  checkMedallion,
  type DungeonItem,
  hasTitansMitt,
  icon,
} from "@/data/logic";

/** A dungeon as declared below; `isBeaten` is progress, added by the loader. */
type DungeonDefinition = Omit<DungeonItem, "isBeaten">;

/** Shared by Tower of Hera's canGetChest and isBeatable. */
const towerOfHeraBeatable: DungeonItem["isBeatable"] = (
  items,
  _medallions,
  bigKeysVisible,
) => {
  if (!items.flute && !items.glove) return "unavailable";
  if (!items.mirror && !(items.hookshot && items.hammer)) return "unavailable";

  // If big keys are displayed, check that we have the big key
  if (bigKeysVisible && !items.bigkey2) return "unavailable";

  if (items.firerod || items.lantern) return "available";
  return "possible";
};

const DUNGEONS: DungeonDefinition[] = [
  {
    canGetChest: (items) => {
      if (items.bow > 1 && items.chest0 > 1) return "available";
      return "possible";
    },
    image: "boss02.png",
    isBeatable: (items, _medallions, bigKeysVisible) => {
      if (items.bow > 1) {
        // If big keys are displayed, check that we have the big key
        if (bigKeysVisible && !items.bigkey0) return "unavailable";
        return "available";
      }
      return "unavailable";
    },
    name: `Eastern Palace ${icon("bow2.png")}`,
    x: "46.8%",
    y: "38.8%",
  },
  {
    canGetChest: (items) => {
      if (!items.book && !(items.flute && hasTitansMitt(items) && items.mirror))
        return "unavailable";
      if (items.boots && (items.firerod || items.lantern) && items.glove)
        return "available";
      if (items.chest1 > 1 && items.boots) return "available";
      return "possible";
    },
    image: "boss12.png",
    isBeatable: (items, _medallions, bigKeysVisible) => {
      if (!items.glove) return "unavailable";
      if (!items.book && !(items.flute && hasTitansMitt(items) && items.mirror))
        return "unavailable";
      if (!items.lantern && !items.firerod) return "unavailable";

      // If big keys are displayed, check that we have the big key
      if (bigKeysVisible && !items.bigkey1) return "unavailable";

      if (!items.boots) return "possible";
      return "available";
    },
    name: `Desert Palace ${icon("glove1.png")}  ${icon("book.png")}  ${icon("lantern.png")}  ${icon("boots.png")}`,
    x: "3.8%",
    y: "78.4%",
  },
  {
    // Reaching a chest in Hera means reaching the boss, so both share one
    // predicate. canGetChest deliberately omits bigKeysVisible: a big key is
    // needed for the boss, not for the chests on the way.
    canGetChest: (items) => towerOfHeraBeatable(items),
    image: "boss22.png",
    isBeatable: towerOfHeraBeatable,
    name: `Tower of Hera ${icon("glove1.png")} ${icon("mirror.png")} ${icon("lantern.png")}`,
    x: "31.0%",
    y: "5.5%",
  },
  {
    canGetChest: (items) => {
      if (!items.moonpearl) return "unavailable";
      if (
        !items.agahnim &&
        !(items.hammer && items.glove) &&
        !(hasTitansMitt(items) && items.flippers)
      )
        return "unavailable";
      if (items.bow > 1 && (items.chest3 > 1 || items.hammer))
        return "available";
      return "possible";
    },
    image: "boss32.png",
    isBeatable: (items, _medallions, bigKeysVisible) => {
      if (!items.moonpearl || !(items.bow > 1) || !items.hammer)
        return "unavailable";
      if (!items.agahnim && !items.glove) return "unavailable";

      // If big keys are displayed, check that we have the big key
      if (bigKeysVisible && !items.bigkey3) return "unavailable";

      return "available";
    },
    name: `Palace of Darkness ${icon("moonpearl.png")} ${icon("bow2.png")} ${icon("hammer.png")} ${icon("glove1.png")}`,
    x: "97.0%",
    y: "40.0%",
  },
  {
    canGetChest: (items) => {
      if (!items.moonpearl || !items.mirror || !items.flippers)
        return "unavailable";
      if (!canReachDarkWorld(items) && !(items.agahnim && items.hammer))
        return "unavailable";

      // Here we go...
      if (items.chest4 <= 2)
        if (items.hookshot && items.hammer) return "available";
        else return "unavailable";
      if (items.chest4 <= 4) {
        if (!items.hammer) return "unavailable";
        if (items.hookshot) return "available";
        return "possible";
      }
      if (items.chest4 === 5)
        if (items.hammer) return "available";
        else return "unavailable";
      if (items.hammer) return "available";
      return "possible";
    },
    image: "boss42.png",
    isBeatable: (items, _medallions, bigKeysVisible) => {
      if (bigKeysVisible && !items.bigkey4) return "unavailable";
      if (!items.moonpearl || !items.mirror || !items.flippers)
        return "unavailable";
      if (!items.hammer || !items.hookshot) return "unavailable";
      if (!items.glove && !items.agahnim) return "unavailable";
      return "available";
    },
    name: `Swamp Palace ${icon("moonpearl.png")} ${icon("mirror.png")} ${icon("flippers.png")} ${icon("hammer.png")} ${icon("hookshot.png")} ${icon("glove1.png")}`,
    x: "73.5%",
    y: "91.0%",
  },
  {
    canGetChest: (items) => {
      if (!canReachDarkWorld(items)) return "unavailable";
      if (items.firerod) return "available";
      return "possible";
    },
    image: "boss52.png",
    isBeatable: (items, _medallions, bigKeysVisible) => {
      if (bigKeysVisible && !items.bigkey5) return "unavailable";
      if (!canReachDarkWorld(items) || !items.firerod) return "unavailable";
      return "available";
    },
    name: `Skull Woods ${icon("moonpearl.png")} ${icon("firerod.png")}`,
    x: "53.3%",
    y: "5.4%",
  },
  {
    canGetChest: (items) => {
      if (!canReachDarkWorld(items)) return "unavailable";
      if (items.chest6 === 1 && !items.hammer) return "possible";
      return "available";
    },
    image: "boss62.png",
    isBeatable: (items, _medallions, bigKeysVisible) => {
      if (bigKeysVisible && !items.bigkey6) return "unavailable";
      if (canReachDarkWorld(items)) return "available";
      return "unavailable";
    },
    name: `Thieves' Town ${icon("moonpearl.png")} ${icon("glove2.png")}`,
    x: "56.4%",
    y: "47.9%",
  },
  {
    canGetChest: (items) => {
      if (!items.moonpearl || !items.flippers || !hasTitansMitt(items))
        return "unavailable";
      if (!items.firerod && !items.bombos) return "unavailable";
      if (items.hammer) return "available";
      return "possible";
    },
    image: "boss72.png",
    isBeatable: (items, _medallions, bigKeysVisible) => {
      if (bigKeysVisible && !items.bigkey7) return "unavailable";
      if (
        !items.moonpearl ||
        !items.flippers ||
        !hasTitansMitt(items) ||
        !items.hammer
      )
        return "unavailable";
      if (!items.firerod && !items.bombos) return "unavailable";
      if (items.hookshot || items.somaria) return "available";
      return "possible";
    },
    name: `Ice Palace ${icon("moonpearl.png")} ${icon("flippers.png")} ${icon("glove2.png")} ${icon("hammer.png")} ${icon("firerod.png")} ${icon("hookshot.png")}`,
    x: "89.8%",
    y: "85.8%",
  },
  {
    canGetChest: (items, medallions = []) => {
      if (!items.moonpearl || !items.flute || !hasTitansMitt(items))
        return "unavailable";
      if (!items.boots && !items.hookshot) return "unavailable";
      // Medallion Check
      const medallion = checkMedallion(items, medallions, 8);
      if (medallion) return medallion;

      if (!items.lantern && !items.firerod) return "possible";
      if (items.chest8 > 1 || items.somaria) return "available";
      return "possible";
    },
    image: "boss82.png",
    isBeatable: (items, medallions = [], bigKeysVisible) => {
      if (bigKeysVisible && !items.bigkey8) return "unavailable";
      if (
        !items.moonpearl ||
        !items.flute ||
        !hasTitansMitt(items) ||
        !items.somaria
      )
        return "unavailable";
      if (!items.boots && !items.hookshot) return "unavailable";
      // Medallion Check
      const medallion = checkMedallion(items, medallions, 8);
      if (medallion) return medallion;

      if (items.lantern || items.firerod) return "available";
      return "possible";
    },
    name: `Misery Mire ${icon("moonpearl.png")} ${icon("flute.png")} ${icon("glove2.png")} ${icon("somaria.png")} ${icon("boots.png")} ${icon("lantern.png")}`,
    x: "55.8%",
    y: "82.9%",
  },
  {
    canGetChest: (items, medallions = []) => {
      if (
        !items.moonpearl ||
        !items.hammer ||
        !hasTitansMitt(items) ||
        !items.somaria
      )
        return "unavailable";
      if (!items.hookshot && !items.mirror) return "unavailable";
      // Medallion Check
      const medallion = checkMedallion(items, medallions, 9);
      if (medallion) return medallion;

      if (!items.firerod) return "possible";
      if (items.chest9 > 1 || items.icerod) return "available";
      return "possible";
    },
    image: "boss92.png",
    isBeatable: (items, medallions = [], bigKeysVisible) => {
      if (bigKeysVisible && !items.bigkey9) return "unavailable";
      if (
        !items.moonpearl ||
        !items.hammer ||
        !hasTitansMitt(items) ||
        !items.somaria
      )
        return "unavailable";
      if (!items.hookshot && !items.mirror) return "unavailable";
      if (!items.icerod || !items.firerod) return "unavailable";
      // Medallion Check
      const medallion = checkMedallion(items, medallions, 9);
      if (medallion) return medallion;

      return "available";
    },
    name: `Turtle Rock ${icon("moonpearl.png")} ${icon("hammer.png")} ${icon("glove2.png")} ${icon("somaria.png")} ${icon("hookshot.png")} ${icon("icerod.png")} ${icon("firerod.png")}`,
    x: "96.9%",
    y: "7.0%",
  },
];

/** The ten dungeons, each starting unbeaten. */
export const dungeons: DungeonItem[] = DUNGEONS.map((dungeon) => ({
  ...dungeon,
  isBeaten: false,
}));
