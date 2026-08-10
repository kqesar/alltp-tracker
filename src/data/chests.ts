import {
  avail,
  type ChestItem,
  canReachDarkWorld,
  canReachDeathMountain,
  canReachEastDeathMountain,
  canReachSouthDarkWorld,
  checkMedallion,
  hasTitansMitt,
  icon,
} from "@/data/logic";

/** A chest as declared below; `isOpened` is progress, added by the loader. */
type ChestDefinition = Omit<ChestItem, "isOpened">;

const CHESTS: ChestDefinition[] = [
  {
    isAvailable: (items) => {
      if (!items.boots) return "unavailable";
      if ((canReachDarkWorld(items) && items.mirror) || hasTitansMitt(items))
        return "available";
      return "unavailable";
    },
    name: `King's Tomb ${icon("boots.png")} + ${icon("glove2.png")}/${icon("mirror.png")}`,
    x: "30.8%",
    y: "29.6%",
  },
  {
    isAvailable: () => "available",
    name: `Light World Swamp (2)`,
    x: "23.4%",
    y: "93.4%",
  },
  {
    isAvailable: () => "available",
    name: `Stoops Lonk's Hoose`,
    x: "27.4%",
    y: "67.9%",
  },
  {
    isAvailable: (items) => avail(canReachEastDeathMountain(items)),
    name: `Spiral Cave`,
    x: "39.9%",
    y: "9.3%",
  },
  {
    isAvailable: (items, medallions = []) => {
      if (
        !items.moonpearl ||
        !items.hammer ||
        !hasTitansMitt(items) ||
        !items.somaria ||
        !items.mirror
      )
        return "unavailable";
      const medallion = checkMedallion(items, medallions, 9);
      if (medallion) return medallion;
      if (items.firerod) return "available";
      return "possible";
    },
    name: `Mimic Cave (${icon("mirror.png")} outside of Turtle Rock)(Yellow = ${icon("medallion0.png")} unkown OR possible w/out ${icon("firerod.png")})`,
    x: "42.6%",
    y: "9.3%",
  },
  {
    isAvailable: () => "available",
    name: `Tavern`,
    x: "8.1%",
    y: "57.8%",
  },
  {
    isAvailable: () => "available",
    name: `Chicken House ${icon("bomb.png")}`,
    x: "4.4%",
    y: "54.2%",
  },
  {
    isAvailable: (items) => avail(canReachDarkWorld(items)),
    name: `Bombable Hut ${icon("bomb.png")}`,
    x: "55.4%",
    y: "57.8%",
  },
  {
    isAvailable: (items) => avail(canReachDarkWorld(items)),
    name: `C House`,
    x: "60.8%",
    y: "47.9%",
  },
  {
    isAvailable: () => "available",
    name: `Aginah's Cave ${icon("bomb.png")}`,
    x: "10.0%",
    y: "82.6%",
  },
  {
    isAvailable: (items) =>
      avail(items.flute && items.moonpearl && hasTitansMitt(items)),
    name: `West of Mire (2)`,
    x: "51.7%",
    y: "79.5%",
  },
  {
    isAvailable: (items) =>
      avail(
        hasTitansMitt(items) &&
          (items.hookshot || (items.mirror && items.hammer)),
      ),
    name: `DW Death Mountain (2) : Don't need ${icon("moonpearl.png")}`,
    x: "92.8%",
    y: "14.7%",
  },
  {
    isAvailable: () => "available",
    name: `Sahasrahla's Hut (3) ${icon("bomb.png")}/${icon("boots.png")}`,
    x: "40.7%",
    y: "41.4%",
  },
  {
    isAvailable: (items) =>
      avail(items.moonpearl && items.glove && items.hammer),
    name: `Byrna Spike Cave`,
    x: "78.6%",
    y: "14.9%",
  },
  {
    isAvailable: () => "available",
    name: `Kakariko Well (4 + ${icon("bomb.png")})`,
    x: "1.7%",
    y: "41.0%",
  },
  {
    isAvailable: () => "available",
    name: `Thieve's Hut (4 + ${icon("bomb.png")})`,
    x: "6.4%",
    y: "41.0%",
  },
  {
    isAvailable: (items) => avail(canReachSouthDarkWorld(items)),
    name: `Hype Cave! ${icon("bomb.png")} (NPC + 4 ${icon("bomb.png")})`,
    x: "80.0%",
    y: "77.1%",
  },
  {
    isAvailable: (items) => avail(canReachEastDeathMountain(items)),
    name: `Death Mountain East (5 + 2 ${icon("bomb.png")})`,
    x: "41.4%",
    y: "17.1%",
  },
  {
    isAvailable: (items) => avail(items.boots),
    name: `West of Sanctuary ${icon("boots.png")}`,
    x: "19.5%",
    y: "29.3%",
  },
  {
    isAvailable: (items) => avail(items.boots),
    name: `West of Sanctuary ${icon("boots.png")}`,
    x: "22.5%",
    y: "36.6%",
  },
  {
    isAvailable: () => "available",
    name: `Minimoldorm Cave (NPC + 4) ${icon("bomb.png")}`,
    x: "32.6%",
    y: "93.4%",
  },
  {
    isAvailable: () => "available",
    name: `Ice Rod Cave ${icon("bomb.png")}`,
    x: "44.7%",
    y: "76.9%",
  },
  {
    isAvailable: (items) =>
      avail(
        items.moonpearl &&
          hasTitansMitt(items) &&
          (items.hookshot || (items.mirror && items.hammer && items.boots)),
      ),
    name: `Cave Under Rock (bottom chest) ${icon("hookshot.png")}/${icon("boots.png")}`,
    x: "91.6%",
    y: "8.6%",
  },
  {
    isAvailable: (items) =>
      avail(items.moonpearl && hasTitansMitt(items) && items.hookshot),
    name: `Cave Under Rock (3 top chests) ${icon("hookshot.png")}`,
    x: "91.6%",
    y: "3.4%",
  },
  {
    isAvailable: (items) => avail(canReachDarkWorld(items)),
    name: `Treasure Chest Minigame: Pay 30 rupees`,
    x: "52.1%",
    y: "46.4%",
  },
  {
    isAvailable: () => "available",
    name: `Bottle Vendor: Pay 100 rupees`,
    x: "4.5%",
    y: "46.8%",
  },
  {
    isAvailable: () => "unavailable", // Needs pendant logic
    name: `Sahasrahla ${icon("pendant0.png")}`,
    x: "40.7%",
    y: "46.7%",
  },
  {
    isAvailable: (items) => avail(canReachSouthDarkWorld(items)),
    name: `Ol' Stumpy`,
    x: "65.5%",
    y: "68.6%",
  },
  {
    isAvailable: (items) => avail(items.bottle),
    name: `Dying Boy: Distract him with ${icon("bottle0.png")} so that you can rob his family!`,
    x: "7.8%",
    y: "52.1%",
  },
  {
    isAvailable: (items) =>
      avail(items.moonpearl && hasTitansMitt(items) && items.mirror),
    name: `Reunite the Hammer Brothers and show the Purple Chest to Gary`,
    x: "65.2%",
    y: "52.2%",
  },
  {
    isAvailable: (items) => avail(items.flippers),
    name: `Fugitive under the bridge ${icon("flippers.png")}`,
    x: "35.4%",
    y: "69.7%",
  },
  {
    isAvailable: (items) =>
      avail(
        items.sword >= 2 &&
          items.book &&
          canReachDeathMountain(items) &&
          (items.mirror || (items.hookshot && items.hammer)),
      ),
    name: `Ether Tablet ${icon("sword2.png")}${icon("book.png")}`,
    x: "21.0%",
    y: "3.0%",
  },
  {
    isAvailable: (items) =>
      avail(
        canReachSouthDarkWorld(items) &&
          items.mirror &&
          items.sword >= 2 &&
          items.book,
      ),
    name: `Bombos Tablet ${icon("mirror.png")}${icon("sword2.png")}${icon("book.png")}`,
    x: "11.0%",
    y: "92.2%",
  },
  {
    isAvailable: (items) =>
      avail(
        items.moonpearl &&
          items.glove &&
          (items.agahnim ||
            items.hammer ||
            (hasTitansMitt(items) && items.flippers)),
      ),
    name: `Catfish`,
    x: "96.0%",
    y: "17.2%",
  },
  {
    isAvailable: (items) => avail(items.flippers || items.glove),
    name: `King Zora: Pay 500 rupees`,
    x: "47.5%",
    y: "12.1%",
  },
  {
    isAvailable: (items) => {
      if (canReachDeathMountain(items)) return "available";
      return "unavailable";
    },
    name: `Lost Old Man`,
    x: "20.8%",
    y: "20.4%",
  },
  {
    isAvailable: (items) => avail(items.mushroom),
    name: `Witch: Give her ${icon("mushroom.png")}`,
    x: "40.8%",
    y: "32.5%",
  },
  {
    isAvailable: () => "available",
    name: `Forest Hideout`,
    x: "9.4%",
    y: "13.0%",
  },
  {
    isAvailable: (items) => {
      if (items.agahnim && items.boots) return "available";
      return "possible";
    },
    name: `Lumberjack Tree ${icon("agahnim0.png")}${icon("boots.png")}`,
    x: "15.1%",
    y: "7.6%",
  },
  {
    isAvailable: (items) => {
      if (canReachDeathMountain(items)) return "available";
      return "unavailable";
    },
    name: `Spectacle Rock Cave`,
    x: "24.3%",
    y: "14.8%",
  },
  {
    isAvailable: (items) =>
      avail(items.mirror && canReachSouthDarkWorld(items)),
    name: `South of Grove ${icon("mirror.png")}`,
    x: "14.1%",
    y: "84.1%",
  },
  {
    isAvailable: (items) => avail(canReachDarkWorld(items) && items.mirror),
    name: `Graveyard Cliff Cave ${icon("mirror.png")}`,
    x: "28.1%",
    y: "27.0%",
  },
  {
    isAvailable: (items) =>
      avail(items.flute && hasTitansMitt(items) && items.mirror),
    name: `Checkerboard Cave ${icon("mirror.png")}`,
    x: "8.8%",
    y: "77.3%",
  },
  {
    isAvailable: (items) =>
      avail(items.moonpearl && hasTitansMitt(items) && items.hammer),
    name: `${icon("hammer.png")}${icon("hammer.png")}${icon("hammer.png")}${icon("hammer.png")}${icon("hammer.png")}${icon("hammer.png")}${icon("hammer.png")}${icon("hammer.png")}!!!!!!!!`,
    x: "65.8%",
    y: "60.1%",
  },
  {
    isAvailable: (items) => {
      if (items.boots) return "available";
      return "possible";
    },
    name: `Library ${icon("boots.png")}`,
    x: "7.7%",
    y: "65.9%",
  },
  {
    isAvailable: () => "available",
    name: `Mushroom`,
    x: "6.2%",
    y: "8.6%",
  },
  {
    isAvailable: (items) => {
      if (canReachDeathMountain(items)) {
        if (items.mirror) return "available";
        else return "possible";
      }
      return "unavailable";
    },
    name: `Spectacle Rock ${icon("mirror.png")}`,
    x: "25.4%",
    y: "8.5%",
  },
  {
    isAvailable: (items) => {
      if (canReachEastDeathMountain(items)) {
        if (items.mirror && items.moonpearl && hasTitansMitt(items))
          return "available";
        else return "possible";
      }
      return "unavailable";
    },
    name: `Floating Island ${icon("mirror.png")}`,
    x: "40.2%",
    y: "3.0%",
  },
  {
    isAvailable: () => "available",
    name: `Race Minigame ${icon("bomb.png")}/${icon("boots.png")}`,
    x: "1.8%",
    y: "69.8%",
  },
  {
    isAvailable: (items) => {
      if (items.book || (items.flute && hasTitansMitt(items) && items.mirror))
        return "available";
      return "possible";
    },
    name: `Desert West Ledge ${icon("book.png")}/${icon("mirror.png")}`,
    x: "1.5%",
    y: "91.0%",
  },
  {
    isAvailable: (items) => {
      if (items.flippers) {
        if (
          items.moonpearl &&
          items.mirror &&
          (items.agahnim ||
            hasTitansMitt(items) ||
            (items.glove && items.hammer))
        )
          return "available";
        else return "possible";
      }
      return "unavailable";
    },
    name: `Lake Hylia Island ${icon("mirror.png")}`,
    x: "36.1%",
    y: "82.9%",
  },
  {
    isAvailable: (items) => {
      if (canReachDarkWorld(items)) {
        if (items.cape && items.glove) return "available";
        else return "possible";
      }
      return "unavailable";
    },
    name: `Bumper Cave ${icon("cape.png")}`,
    x: "67.1%",
    y: "15.2%",
  },
  {
    isAvailable: (items) =>
      avail(
        items.agahnim ||
          (items.glove && items.hammer && items.moonpearl) ||
          (hasTitansMitt(items) && items.moonpearl && items.flippers),
      ),
    name: `Pyramid`,
    x: "79.0%",
    y: "43.5%",
  },
  {
    isAvailable: (items) => avail(canReachSouthDarkWorld(items)),
    name: `Alec Baldwin's Dig-a-Thon: Pay 80 rupees`,
    x: "52.9%",
    y: "69.2%",
  },
  {
    isAvailable: (items) => {
      if (items.flippers) return "available";
      if (items.glove) return "possible";
      return "unavailable";
    },
    name: `Zora River Ledge ${icon("flippers.png")}`,
    x: "47.5%",
    y: "17.3%",
  },
  {
    isAvailable: (items) => avail(items.shovel),
    name: `Buried Item ${icon("shovel.png")}`,
    x: "14.4%",
    y: "66.2%",
  },
  {
    isAvailable: (items) => avail(items.glove),
    name: `Fall to Escape Sewer (3) ${icon("glove1.png")} + ${icon("bomb.png")}/${icon("boots.png")}`,
    x: "26.8%",
    y: "32.4%",
  },
  {
    isAvailable: () => "available",
    name: `Castle Secret Entrance`,
    x: "29.8%",
    y: "41.8%",
  },
  {
    isAvailable: () => "available",
    name: `Hyrule Castle (4 including Key)`,
    x: "24.9%",
    y: "44.1%",
  },
  {
    isAvailable: () => "available",
    name: `Sanctuary`,
    x: "23.0%",
    y: "28.0%",
  },
  {
    isAvailable: (items) =>
      avail(
        items.powder &&
          (items.hammer ||
            (hasTitansMitt(items) && items.mirror && items.moonpearl)),
      ),
    name: `Mad Batter ${icon("hammer.png")}/${icon("mirror.png")} + ${icon("powder.png")}`,
    x: "16.0%",
    y: "58.0%",
  },
  {
    isAvailable: (items) =>
      avail(items.moonpearl && hasTitansMitt(items) && items.mirror),
    name: `Take the frog home ${icon("mirror.png")}`,
    x: "15.2%",
    y: "51.8%",
  },
  {
    isAvailable: (items) => {
      if (!items.moonpearl) return "unavailable";
      if (items.hammer && (items.agahnim || items.glove)) return "available";
      if (items.agahnim && items.mirror && canReachDarkWorld(items))
        return "available";
      return "unavailable";
    },
    name: `Fat Fairy: Buy OJ bomb from Dark Link's House after ${icon("crystal0.png")}5 ${icon("crystal0.png")}6 (2 items)`,
    x: "73.5%",
    y: "48.5%",
  },
  {
    isAvailable: (items) => {
      if (items.book) return "possible";
      return "unavailable"; // Needs pendant counting logic
    },
    name: `Master Sword Pedestal ${icon("pendant0.png")}${icon("pendant1.png")}${icon("pendant2.png")} (can check with ${icon("book.png")})`,
    x: "2.5%",
    y: "3.2%",
  },
  {
    isAvailable: () => "available",
    name: `Bridge`,
    x: "24.9%",
    y: "57.1%",
  },
];

/** Every overworld chest, each starting closed. */
export const chests: ChestItem[] = CHESTS.map((chest) => ({
  ...chest,
  isOpened: false,
}));
