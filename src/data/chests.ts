// Type definitions
export interface ItemState {
  // Index signature for dynamic access
  [key: string]: number | boolean;

  // Numeric items (progressive)
  agahnim: number;
  boomerang: number;
  boss0: number;
  boss1: number;
  boss2: number;
  boss3: number;
  boss4: number;
  boss5: number;
  boss6: number;
  boss7: number;
  boss8: number;
  boss9: number;
  bottle: number;
  bow: number;
  chest0: number;
  chest1: number;
  chest2: number;
  chest3: number;
  chest4: number;
  chest5: number;
  chest6: number;
  chest7: number;
  chest8: number;
  chest9: number;
  dungeon: number;
  glove: number;
  reward0: number;
  reward1: number;
  reward2: number;
  reward3: number;
  reward4: number;
  reward5: number;
  reward6: number;
  reward7: number;
  reward8: number;
  reward9: number;
  shield: number;
  sword: number;
  tunic: number;

  // Boolean items
  blank: boolean;
  bombos: boolean;
  book: boolean;
  boots: boolean;
  byrna: boolean;
  cape: boolean;
  ether: boolean;
  firerod: boolean;
  flippers: boolean;
  flute: boolean;
  hammer: boolean;
  hookshot: boolean;
  icerod: boolean;
  lantern: boolean;
  mirror: boolean;
  moonpearl: boolean;
  mushroom: boolean;
  net: boolean;
  powder: boolean;
  quake: boolean;
  shovel: boolean;
  somaria: boolean;
}

export interface ChestItem {
  id: number;
  name: string;
  x: string;
  y: string;
  isOpened: boolean;
  isAvailable: (items: ItemState, medallions?: number[]) => string;
}

export interface DungeonItem {
  id: number;
  name: string;
  x: string;
  y: string;
  image: string;
  isBeaten: boolean;
  isBeatable: (
    items: ItemState,
    medallions?: number[],
    bigKeysVisible?: boolean,
  ) => string;
  canGetChest: (items: ItemState, medallions?: number[]) => string;
}

// Helper function for checking if player can access Dark World
function steve(items: ItemState): boolean {
  if (!items.moonpearl) return false;
  if (items.glove === 2 || ((items.glove as number) > 0 && items.hammer))
    return true;
  return (
    (items.agahnim as number) > 0 &&
    items.hookshot &&
    (items.hammer || (items.glove as number) > 0 || items.flippers)
  );
}

// Define dungeon objects
export const dungeons: DungeonItem[] = [
  {
    canGetChest: (items: ItemState) => {
      if (items.bow > 1 && items.chest0 > 1) return "available";
      return "possible";
    },
    id: 0,
    image: "boss02.png",
    isBeatable: (
      items: ItemState,
      medallions?: number[],
      bigKeysVisible?: boolean,
    ) => {
      if (items.bow > 1) {
        // Si les grosses clés sont affichées, vérifier qu'on possède la grosse clé
        if (bigKeysVisible && !items.bigkey0) return "unavailable";
        return "available";
      }
      return "unavailable";
    },
    isBeaten: false,
    name: `Eastern Palace <img src='${import.meta.env.BASE_URL}assets/bow2.png' class='mini'/>`,
    x: "46.8%",
    y: "38.8%",
  },
  {
    canGetChest: (items: ItemState) => {
      if (!items.book && !(items.flute && items.glove === 2 && items.mirror))
        return "unavailable";
      if (items.boots && (items.firerod || items.lantern) && items.glove)
        return "available";
      if (items.chest1 > 1 && items.boots) return "available";
      return "possible";
    },
    id: 1,
    image: "boss12.png",
    isBeatable: (
      items: ItemState,
      medallions?: number[],
      bigKeysVisible?: boolean,
    ) => {
      if (!items.glove) return "unavailable";
      if (!items.book && !(items.flute && items.glove === 2 && items.mirror))
        return "unavailable";
      if (!items.lantern && !items.firerod) return "unavailable";

      // Si les grosses clés sont affichées, vérifier qu'on possède la grosse clé
      if (bigKeysVisible && !items.bigkey1) return "unavailable";

      if (!items.boots) return "possible";
      return "available";
    },
    isBeaten: false,
    name: `Desert Palace <img src='${import.meta.env.BASE_URL}assets/glove1.png' class='mini'/>  <img src='${import.meta.env.BASE_URL}assets/book.png' class='mini'/>  <img src='${import.meta.env.BASE_URL}assets/lantern.png' class='mini'/>  <img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'/>`,
    x: "3.8%",
    y: "78.4%",
  },
  {
    canGetChest: function (items: ItemState) {
      return this.isBeatable(items);
    },
    id: 2,
    image: "boss22.png",
    isBeatable: (
      items: ItemState,
      medallions?: number[],
      bigKeysVisible?: boolean,
    ) => {
      if (!items.flute && !items.glove) return "unavailable";
      if (!items.mirror && !(items.hookshot && items.hammer))
        return "unavailable";

      // Si les grosses clés sont affichées, vérifier qu'on possède la grosse clé
      if (bigKeysVisible && !items.bigkey2) return "unavailable";

      if (items.firerod || items.lantern) return "available";
      return "possible";
    },
    isBeaten: false,
    name: `Tower of Hera <img src='${import.meta.env.BASE_URL}assets/glove1.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/lantern.png' class='mini'/>`,
    x: "31.0%",
    y: "5.5%",
  },
  {
    canGetChest: (items: ItemState) => {
      if (!items.moonpearl) return "unavailable";
      if (
        !items.agahnim &&
        !(items.hammer && items.glove) &&
        !(items.glove === 2 && items.flippers)
      )
        return "unavailable";
      if (items.bow > 1 && (items.chest3 > 1 || items.hammer))
        return "available";
      return "possible";
    },
    id: 3,
    image: "boss32.png",
    isBeatable: (
      items: ItemState,
      medallions?: number[],
      bigKeysVisible?: boolean,
    ) => {
      if (!items.moonpearl || !(items.bow > 1) || !items.hammer)
        return "unavailable";
      if (!items.agahnim && !items.glove) return "unavailable";

      // Si les grosses clés sont affichées, vérifier qu'on possède la grosse clé
      if (bigKeysVisible && !items.bigkey3) return "unavailable";

      return "available";
    },
    isBeaten: false,
    name: `Palace of Darkness <img src='${import.meta.env.BASE_URL}assets/moonpearl.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/bow2.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/glove1.png' class='mini'/>`,
    x: "97.0%",
    y: "40.0%",
  },
  {
    canGetChest: (items: ItemState) => {
      if (!items.moonpearl || !items.mirror || !items.flippers)
        return "unavailable";
      if (!steve(items) && !(items.agahnim && items.hammer))
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
    id: 4,
    image: "boss42.png",
    isBeatable: (
      items: ItemState,
      medallions?: number[],
      bigKeysVisible?: boolean,
    ) => {
      if (bigKeysVisible && !items.bigkey4) return "unavailable";
      if (!items.moonpearl || !items.mirror || !items.flippers)
        return "unavailable";
      if (!items.hammer || !items.hookshot) return "unavailable";
      if (!items.glove && !items.agahnim) return "unavailable";
      return "available";
    },
    isBeaten: false,
    name: `Swamp Palace <img src='${import.meta.env.BASE_URL}assets/moonpearl.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/flippers.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/hookshot.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/glove1.png' class='mini'/>`,
    x: "73.5%",
    y: "91.0%",
  },
  {
    canGetChest: (items: ItemState) => {
      if (!steve(items)) return "unavailable";
      if (items.firerod) return "available";
      return "possible";
    },
    id: 5,
    image: "boss52.png",
    isBeatable: (
      items: ItemState,
      medallions?: number[],
      bigKeysVisible?: boolean,
    ) => {
      if (bigKeysVisible && !items.bigkey5) return "unavailable";
      if (!steve(items) || !items.firerod) return "unavailable";
      return "available";
    },
    isBeaten: false,
    name: `Skull Woods <img src='${import.meta.env.BASE_URL}assets/moonpearl.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/firerod.png' class='mini'/>`,
    x: "53.3%",
    y: "5.4%",
  },
  {
    canGetChest: (items: ItemState) => {
      if (!steve(items)) return "unavailable";
      if (items.chest6 === 1 && !items.hammer) return "possible";
      return "available";
    },
    id: 6,
    image: "boss62.png",
    isBeatable: (
      items: ItemState,
      medallions?: number[],
      bigKeysVisible?: boolean,
    ) => {
      if (bigKeysVisible && !items.bigkey6) return "unavailable";
      if (steve(items)) return "available";
      return "unavailable";
    },
    isBeaten: false,
    name: `Thieves' Town <img src='${import.meta.env.BASE_URL}assets/moonpearl.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/glove2.png' class='mini'/>`,
    x: "56.4%",
    y: "47.9%",
  },
  {
    canGetChest: (items: ItemState) => {
      if (!items.moonpearl || !items.flippers || items.glove !== 2)
        return "unavailable";
      if (!items.firerod && !items.bombos) return "unavailable";
      if (items.hammer) return "available";
      return "possible";
    },
    id: 7,
    image: "boss72.png",
    isBeatable: (
      items: ItemState,
      medallions?: number[],
      bigKeysVisible?: boolean,
    ) => {
      if (bigKeysVisible && !items.bigkey7) return "unavailable";
      if (
        !items.moonpearl ||
        !items.flippers ||
        items.glove !== 2 ||
        !items.hammer
      )
        return "unavailable";
      if (!items.firerod && !items.bombos) return "unavailable";
      if (items.hookshot || items.somaria) return "available";
      return "possible";
    },
    isBeaten: false,
    name: `Ice Palace <img src='${import.meta.env.BASE_URL}assets/moonpearl.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/flippers.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/glove2.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/firerod.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/hookshot.png' class='mini'/>`,
    x: "89.8%",
    y: "85.8%",
  },
  {
    canGetChest: (items: ItemState, medallions: number[] = []) => {
      if (!items.moonpearl || !items.flute || items.glove !== 2)
        return "unavailable";
      if (!items.boots && !items.hookshot) return "unavailable";
      // Medallion Check
      if (!items.bombos && !items.ether && !items.quake) return "unavailable";
      if (
        (medallions[8] === 1 && !items.bombos) ||
        (medallions[8] === 2 && !items.ether) ||
        (medallions[8] === 3 && !items.quake)
      )
        return "unavailable";
      if (medallions[8] === 0 && !(items.bombos && items.ether && items.quake))
        return "possible";

      if (!items.lantern && !items.firerod) return "possible";
      if (items.chest8 > 1 || items.somaria) return "available";
      return "possible";
    },
    id: 8,
    image: "boss82.png",
    isBeatable: (
      items: ItemState,
      medallions: number[] = [],
      bigKeysVisible?: boolean,
    ) => {
      if (bigKeysVisible && !items.bigkey8) return "unavailable";
      if (
        !items.moonpearl ||
        !items.flute ||
        items.glove !== 2 ||
        !items.somaria
      )
        return "unavailable";
      if (!items.boots && !items.hookshot) return "unavailable";
      // Medallion Check
      if (!items.bombos && !items.ether && !items.quake) return "unavailable";
      if (
        (medallions[8] === 1 && !items.bombos) ||
        (medallions[8] === 2 && !items.ether) ||
        (medallions[8] === 3 && !items.quake)
      )
        return "unavailable";
      if (medallions[8] === 0 && !(items.bombos && items.ether && items.quake))
        return "possible";

      if (items.lantern || items.firerod) return "available";
      return "possible";
    },
    isBeaten: false,
    name: `Misery Mire <img src='${import.meta.env.BASE_URL}assets/moonpearl.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/flute.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/glove2.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/somaria.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/medallion0.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/lantern.png' class='mini'/>`,
    x: "55.8%",
    y: "82.9%",
  },
  {
    canGetChest: (items: ItemState, medallions: number[] = []) => {
      if (
        !items.moonpearl ||
        !items.hammer ||
        items.glove !== 2 ||
        !items.somaria
      )
        return "unavailable";
      if (!items.hookshot && !items.mirror) return "unavailable";
      // Medallion Check
      if (!items.bombos && !items.ether && !items.quake) return "unavailable";
      if (
        (medallions[9] === 1 && !items.bombos) ||
        (medallions[9] === 2 && !items.ether) ||
        (medallions[9] === 3 && !items.quake)
      )
        return "unavailable";
      if (medallions[9] === 0 && !(items.bombos && items.ether && items.quake))
        return "possible";

      if (!items.firerod) return "possible";
      if (items.chest9 > 1 || items.icerod) return "available";
      return "possible";
    },
    id: 9,
    image: "boss92.png",
    isBeatable: (
      items: ItemState,
      medallions: number[] = [],
      bigKeysVisible?: boolean,
    ) => {
      if (bigKeysVisible && !items.bigkey9) return "unavailable";
      if (
        !items.moonpearl ||
        !items.hammer ||
        items.glove !== 2 ||
        !items.somaria
      )
        return "unavailable";
      if (!items.hookshot && !items.mirror) return "unavailable";
      if (!items.icerod || !items.firerod) return "unavailable";
      // Medallion Check
      if (!items.bombos && !items.ether && !items.quake) return "unavailable";
      if (
        (medallions[9] === 1 && !items.bombos) ||
        (medallions[9] === 2 && !items.ether) ||
        (medallions[9] === 3 && !items.quake)
      )
        return "unavailable";
      if (medallions[9] === 0 && !(items.bombos && items.ether && items.quake))
        return "possible";

      return "available";
    },
    isBeaten: false,
    name: `Turtle Rock <img src='${import.meta.env.BASE_URL}assets/moonpearl.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/glove2.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/somaria.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/hookshot.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/medallion0.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/icerod.png' class='mini'/> <img src='${import.meta.env.BASE_URL}assets/firerod.png' class='mini'/>`,
    x: "96.9%",
    y: "7.0%",
  },
];

// Define overworld chests - ALL 64 chests from legacy version
export const chests: ChestItem[] = [
  {
    id: 0,
    isAvailable: (items: ItemState) => {
      if (!items.boots) return "unavailable";
      if ((steve(items) && items.mirror) || items.glove === 2)
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `King's Tomb <img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'> + <img src='${import.meta.env.BASE_URL}assets/glove2.png' class='mini'>/<img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'>`,
    x: "30.8%",
    y: "29.6%",
  },
  {
    id: 1,
    isAvailable: () => "available",
    isOpened: false,
    name: `Light World Swamp (2)`,
    x: "23.4%",
    y: "93.4%",
  },
  {
    id: 2,
    isAvailable: () => "available",
    isOpened: false,
    name: `Stoops Lonk's Hoose`,
    x: "27.4%",
    y: "67.9%",
  },
  {
    id: 3,
    isAvailable: (items: ItemState) => {
      if (
        (items.glove || items.flute) &&
        (items.hookshot || (items.mirror && items.hammer))
      )
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Spiral Cave`,
    x: "39.9%",
    y: "9.3%",
  },
  {
    id: 4,
    isAvailable: (items: ItemState, medallions: number[] = []) => {
      if (
        !items.moonpearl ||
        !items.hammer ||
        items.glove !== 2 ||
        !items.somaria ||
        !items.mirror
      )
        return "unavailable";
      if (!items.bombos && !items.ether && !items.quake) return "unavailable";
      if (
        (medallions[9] === 1 && !items.bombos) ||
        (medallions[9] === 2 && !items.ether) ||
        (medallions[9] === 3 && !items.quake)
      )
        return "unavailable";
      if (medallions[9] === 0 && !(items.bombos && items.ether && items.quake))
        return "possible";
      if (items.firerod) return "available";
      return "possible";
    },
    isOpened: false,
    name: `Mimic Cave (<img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'> outside of Turtle Rock)(Yellow = <img src='${import.meta.env.BASE_URL}assets/medallion0.png' class='mini'> unkown OR possible w/out <img src='${import.meta.env.BASE_URL}assets/firerod.png' class='mini'>)`,
    x: "42.6%",
    y: "9.3%",
  },
  {
    id: 5,
    isAvailable: () => "available",
    isOpened: false,
    name: `Tavern`,
    x: "8.1%",
    y: "57.8%",
  },
  {
    id: 6,
    isAvailable: () => "available",
    isOpened: false,
    name: `Chicken House <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>`,
    x: "4.4%",
    y: "54.2%",
  },
  {
    id: 7,
    isAvailable: (items: ItemState) => {
      if (steve(items)) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Bombable Hut <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>`,
    x: "55.4%",
    y: "57.8%",
  },
  {
    id: 8,
    isAvailable: (items: ItemState) => {
      if (steve(items)) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `C House`,
    x: "60.8%",
    y: "47.9%",
  },
  {
    id: 9,
    isAvailable: () => "available",
    isOpened: false,
    name: `Aginah's Cave <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>`,
    x: "10.0%",
    y: "82.6%",
  },
  {
    id: 10,
    isAvailable: (items: ItemState) => {
      if (items.flute && items.moonpearl && items.glove === 2)
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `West of Mire (2)`,
    x: "51.7%",
    y: "79.5%",
  },
  {
    id: 11,
    isAvailable: (items: ItemState) => {
      if (
        items.glove === 2 &&
        (items.hookshot || (items.mirror && items.hammer))
      )
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `DW Death Mountain (2) : Don't need <img src='${import.meta.env.BASE_URL}assets/moonpearl.png' class='mini'>`,
    x: "92.8%",
    y: "14.7%",
  },
  {
    id: 12,
    isAvailable: () => "available",
    isOpened: false,
    name: `Sahasrahla's Hut (3) <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>/<img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'>`,
    x: "40.7%",
    y: "41.4%",
  },
  {
    id: 13,
    isAvailable: (items: ItemState) => {
      if (items.moonpearl && items.glove && items.hammer) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Byrna Spike Cave`,
    x: "78.6%",
    y: "14.9%",
  },
  {
    id: 14,
    isAvailable: () => "available",
    isOpened: false,
    name: `Kakariko Well (4 + <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>)`,
    x: "1.7%",
    y: "41.0%",
  },
  {
    id: 15,
    isAvailable: () => "available",
    isOpened: false,
    name: `Thieve's Hut (4 + <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>)`,
    x: "6.4%",
    y: "41.0%",
  },
  {
    id: 16,
    isAvailable: (items: ItemState) => {
      if (steve(items) || (items.agahnim && items.moonpearl && items.hammer))
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Hype Cave! <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'> (NPC + 4 <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>)`,
    x: "80.0%",
    y: "77.1%",
  },
  {
    id: 17,
    isAvailable: (items: ItemState) => {
      if (
        (items.glove || items.flute) &&
        (items.hookshot || (items.mirror && items.hammer))
      )
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Death Mountain East (5 + 2 <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>)`,
    x: "41.4%",
    y: "17.1%",
  },
  {
    id: 64,
    isAvailable: (items: ItemState) => {
      if (items.boots) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `West of Sanctuary <img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'>`,
    x: "19.5%",
    y: "29.3%",
  },
  {
    id: 18,
    isAvailable: (items: ItemState) => {
      if (items.boots) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `West of Sanctuary <img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'>`,
    x: "22.5%",
    y: "36.6%",
  },
  {
    id: 19,
    isAvailable: () => "available",
    isOpened: false,
    name: `Minimoldorm Cave (NPC + 4) <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>`,
    x: "32.6%",
    y: "93.4%",
  },
  {
    id: 20,
    isAvailable: () => "available",
    isOpened: false,
    name: `Ice Rod Cave <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>`,
    x: "44.7%",
    y: "76.9%",
  },
  {
    id: 21,
    isAvailable: (items: ItemState) => {
      if (
        items.moonpearl &&
        items.glove === 2 &&
        (items.hookshot || (items.mirror && items.hammer && items.boots))
      )
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Cave Under Rock (bottom chest) <img src='${import.meta.env.BASE_URL}assets/hookshot.png' class='mini'>/<img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'>`,
    x: "91.6%",
    y: "8.6%",
  },
  {
    id: 22,
    isAvailable: (items: ItemState) => {
      if (items.moonpearl && items.glove === 2 && items.hookshot)
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Cave Under Rock (3 top chests) <img src='${import.meta.env.BASE_URL}assets/hookshot.png' class='mini'>`,
    x: "91.6%",
    y: "3.4%",
  },
  {
    id: 23,
    isAvailable: (items: ItemState) => {
      if (steve(items)) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Treasure Chest Minigame: Pay 30 rupees`,
    x: "52.1%",
    y: "46.4%",
  },
  {
    id: 24,
    isAvailable: () => "available",
    isOpened: false,
    name: `Bottle Vendor: Pay 100 rupees`,
    x: "4.5%",
    y: "46.8%",
  },
  {
    id: 25,
    isAvailable: () => "unavailable", // Needs pendant logic
    isOpened: false,
    name: `Sahasrahla <img src='${import.meta.env.BASE_URL}assets/pendant0.png' class='mini'>`,
    x: "40.7%",
    y: "46.7%",
  },
  {
    id: 26,
    isAvailable: (items: ItemState) => {
      if (steve(items) || (items.agahnim && items.moonpearl && items.hammer))
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Ol' Stumpy`,
    x: "65.5%",
    y: "68.6%",
  },
  {
    id: 27,
    isAvailable: (items: ItemState) => {
      if (items.bottle) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Dying Boy: Distract him with <img src='${import.meta.env.BASE_URL}assets/bottle0.png' class='mini'> so that you can rob his family!`,
    x: "7.8%",
    y: "52.1%",
  },
  {
    id: 28,
    isAvailable: (items: ItemState) => {
      if (items.moonpearl && items.glove === 2 && items.mirror)
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Reunite the Hammer Brothers and show the Purple Chest to Gary`,
    x: "65.2%",
    y: "52.2%",
  },
  {
    id: 29,
    isAvailable: (items: ItemState) => {
      if (items.flippers) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Fugitive under the bridge <img src='${import.meta.env.BASE_URL}assets/flippers.png' class='mini'>`,
    x: "35.4%",
    y: "69.7%",
  },
  {
    id: 30,
    isAvailable: (items: ItemState) => {
      if (
        items.sword >= 2 &&
        items.book &&
        (items.glove || items.flute) &&
        (items.mirror || (items.hookshot && items.hammer))
      )
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Ether Tablet <img src='${import.meta.env.BASE_URL}assets/sword2.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/book.png' class='mini'>`,
    x: "21.0%",
    y: "3.0%",
  },
  {
    id: 31,
    isAvailable: (items: ItemState) => {
      if (
        (steve(items) || (items.agahnim && items.moonpearl && items.hammer)) &&
        items.mirror &&
        items.sword >= 2 &&
        items.book
      )
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Bombos Tablet <img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/sword2.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/book.png' class='mini'>`,
    x: "11.0%",
    y: "92.2%",
  },
  {
    id: 32,
    isAvailable: (items: ItemState) => {
      if (
        items.moonpearl &&
        items.glove &&
        (items.agahnim || items.hammer || (items.glove === 2 && items.flippers))
      )
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Catfish`,
    x: "96.0%",
    y: "17.2%",
  },
  {
    id: 33,
    isAvailable: (items: ItemState) => {
      if (items.flippers || items.glove) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `King Zora: Pay 500 rupees`,
    x: "47.5%",
    y: "12.1%",
  },
  {
    id: 34,
    isAvailable: (items: ItemState) => {
      if (items.glove || items.flute) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Lost Old Man`,
    x: "20.8%",
    y: "20.4%",
  },
  {
    id: 35,
    isAvailable: (items: ItemState) => {
      if (items.mushroom) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Witch: Give her <img src='${import.meta.env.BASE_URL}assets/mushroom.png' class='mini'>`,
    x: "40.8%",
    y: "32.5%",
  },
  {
    id: 36,
    isAvailable: () => "available",
    isOpened: false,
    name: `Forest Hideout`,
    x: "9.4%",
    y: "13.0%",
  },
  {
    id: 37,
    isAvailable: (items: ItemState) => {
      if (items.agahnim && items.boots) return "available";
      return "possible";
    },
    isOpened: false,
    name: `Lumberjack Tree <img src='${import.meta.env.BASE_URL}assets/agahnim0.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'>`,
    x: "15.1%",
    y: "7.6%",
  },
  {
    id: 38,
    isAvailable: (items: ItemState) => {
      if (items.glove || items.flute) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Spectacle Rock Cave`,
    x: "24.3%",
    y: "14.8%",
  },
  {
    id: 39,
    isAvailable: (items: ItemState) => {
      if (
        items.mirror &&
        (steve(items) || (items.agahnim && items.moonpearl && items.hammer))
      )
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `South of Grove <img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'>`,
    x: "14.1%",
    y: "84.1%",
  },
  {
    id: 40,
    isAvailable: (items: ItemState) => {
      if (steve(items) && items.mirror) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Graveyard Cliff Cave <img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'>`,
    x: "28.1%",
    y: "27.0%",
  },
  {
    id: 41,
    isAvailable: (items: ItemState) => {
      if (items.flute && items.glove === 2 && items.mirror) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Checkerboard Cave <img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'>`,
    x: "8.8%",
    y: "77.3%",
  },
  {
    id: 42,
    isAvailable: (items: ItemState) => {
      if (items.moonpearl && items.glove === 2 && items.hammer)
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `<img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'>!!!!!!!!`,
    x: "65.8%",
    y: "60.1%",
  },
  {
    id: 43,
    isAvailable: (items: ItemState) => {
      if (items.boots) return "available";
      return "possible";
    },
    isOpened: false,
    name: `Library <img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'>`,
    x: "7.7%",
    y: "65.9%",
  },
  {
    id: 44,
    isAvailable: () => "available",
    isOpened: false,
    name: `Mushroom`,
    x: "6.2%",
    y: "8.6%",
  },
  {
    id: 45,
    isAvailable: (items: ItemState) => {
      if (items.glove || items.flute) {
        if (items.mirror) return "available";
        else return "possible";
      }
      return "unavailable";
    },
    isOpened: false,
    name: `Spectacle Rock <img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'>`,
    x: "25.4%",
    y: "8.5%",
  },
  {
    id: 46,
    isAvailable: (items: ItemState) => {
      if (
        (items.glove || items.flute) &&
        (items.hookshot || (items.hammer && items.mirror))
      ) {
        if (items.mirror && items.moonpearl && items.glove === 2)
          return "available";
        else return "possible";
      }
      return "unavailable";
    },
    isOpened: false,
    name: `Floating Island <img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'>`,
    x: "40.2%",
    y: "3.0%",
  },
  {
    id: 47,
    isAvailable: () => "available",
    isOpened: false,
    name: `Race Minigame <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>/<img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'>`,
    x: "1.8%",
    y: "69.8%",
  },
  {
    id: 48,
    isAvailable: (items: ItemState) => {
      if (items.book || (items.flute && items.glove === 2 && items.mirror))
        return "available";
      return "possible";
    },
    isOpened: false,
    name: `Desert West Ledge <img src='${import.meta.env.BASE_URL}assets/book.png' class='mini'>/<img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'>`,
    x: "1.5%",
    y: "91.0%",
  },
  {
    id: 49,
    isAvailable: (items: ItemState) => {
      if (items.flippers) {
        if (
          items.moonpearl &&
          items.mirror &&
          (items.agahnim || items.glove === 2 || (items.glove && items.hammer))
        )
          return "available";
        else return "possible";
      }
      return "unavailable";
    },
    isOpened: false,
    name: `Lake Hylia Island <img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'>`,
    x: "36.1%",
    y: "82.9%",
  },
  {
    id: 50,
    isAvailable: (items: ItemState) => {
      if (steve(items)) {
        if (items.cape && items.glove) return "available";
        else return "possible";
      }
      return "unavailable";
    },
    isOpened: false,
    name: `Bumper Cave <img src='${import.meta.env.BASE_URL}assets/cape.png' class='mini'>`,
    x: "67.1%",
    y: "15.2%",
  },
  {
    id: 51,
    isAvailable: (items: ItemState) => {
      if (
        items.agahnim ||
        (items.glove && items.hammer && items.moonpearl) ||
        (items.glove === 2 && items.moonpearl && items.flippers)
      )
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Pyramid`,
    x: "79.0%",
    y: "43.5%",
  },
  {
    id: 52,
    isAvailable: (items: ItemState) => {
      if (steve(items) || (items.agahnim && items.moonpearl && items.hammer))
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Alec Baldwin's Dig-a-Thon: Pay 80 rupees`,
    x: "52.9%",
    y: "69.2%",
  },
  {
    id: 53,
    isAvailable: (items: ItemState) => {
      if (items.flippers) return "available";
      if (items.glove) return "possible";
      return "unavailable";
    },
    isOpened: false,
    name: `Zora River Ledge <img src='${import.meta.env.BASE_URL}assets/flippers.png' class='mini'>`,
    x: "47.5%",
    y: "17.3%",
  },
  {
    id: 54,
    isAvailable: (items: ItemState) => {
      if (items.shovel) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Buried Item <img src='${import.meta.env.BASE_URL}assets/shovel.png' class='mini'>`,
    x: "14.4%",
    y: "66.2%",
  },
  {
    id: 55,
    isAvailable: (items: ItemState) => {
      if (items.glove) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Fall to Escape Sewer (3) <img src='${import.meta.env.BASE_URL}assets/glove1.png' class='mini'> + <img src='${import.meta.env.BASE_URL}assets/bomb.png' class='mini'>/<img src='${import.meta.env.BASE_URL}assets/boots.png' class='mini'>`,
    x: "26.8%",
    y: "32.4%",
  },
  {
    id: 56,
    isAvailable: () => "available",
    isOpened: false,
    name: `Castle Secret Entrance`,
    x: "29.8%",
    y: "41.8%",
  },
  {
    id: 57,
    isAvailable: () => "available",
    isOpened: false,
    name: `Hyrule Castle (4 including Key)`,
    x: "24.9%",
    y: "44.1%",
  },
  {
    id: 58,
    isAvailable: () => "available",
    isOpened: false,
    name: `Sanctuary`,
    x: "23.0%",
    y: "28.0%",
  },
  {
    id: 59,
    isAvailable: (items: ItemState) => {
      if (
        items.powder &&
        (items.hammer || (items.glove === 2 && items.mirror && items.moonpearl))
      )
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Mad Batter <img src='${import.meta.env.BASE_URL}assets/hammer.png' class='mini'>/<img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'> + <img src='${import.meta.env.BASE_URL}assets/powder.png' class='mini'>`,
    x: "16.0%",
    y: "58.0%",
  },
  {
    id: 60,
    isAvailable: (items: ItemState) => {
      if (items.moonpearl && items.glove === 2 && items.mirror)
        return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Take the frog home <img src='${import.meta.env.BASE_URL}assets/mirror.png' class='mini'>`,
    x: "15.2%",
    y: "51.8%",
  },
  {
    id: 61,
    isAvailable: (items: ItemState) => {
      if (!items.moonpearl) return "unavailable";
      if (items.hammer && (items.agahnim || items.glove)) return "available";
      if (items.agahnim && items.mirror && steve(items)) return "available";
      return "unavailable";
    },
    isOpened: false,
    name: `Fat Fairy: Buy OJ bomb from Dark Link's House after <img src='${import.meta.env.BASE_URL}assets/crystal0.png' class='mini'>5 <img src='${import.meta.env.BASE_URL}assets/crystal0.png' class='mini'>6 (2 items)`,
    x: "73.5%",
    y: "48.5%",
  },
  {
    id: 62,
    isAvailable: (items: ItemState) => {
      if (items.book) return "possible";
      return "unavailable"; // Needs pendant counting logic
    },
    isOpened: false,
    name: `Master Sword Pedestal <img src='${import.meta.env.BASE_URL}assets/pendant0.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/pendant1.png' class='mini'><img src='${import.meta.env.BASE_URL}assets/pendant2.png' class='mini'> (can check with <img src='${import.meta.env.BASE_URL}assets/book.png' class='mini'>)`,
    x: "2.5%",
    y: "3.2%",
  },
  {
    id: 63,
    isAvailable: () => "available",
    isOpened: false,
    name: `Bridge`,
    x: "24.9%",
    y: "57.1%",
  },
];
