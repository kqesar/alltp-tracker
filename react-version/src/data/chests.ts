// Type definitions
export interface ItemState {
  [key: string]: any;
}

export interface ChestItem {
  name: string;
  x: string;
  y: string;
  isOpened: boolean;
  isAvailable: (items: ItemState, medallions?: number[]) => string;
}

export interface DungeonItem {
  name: string;
  x: string;
  y: string;
  image: string;
  isBeaten: boolean;
  isBeatable: (items: ItemState, medallions?: number[]) => string;
  canGetChest: (items: ItemState, medallions?: number[]) => string;
}

// Helper function for checking if player can access Dark World
function steve(items: ItemState): boolean {
    if (!items.moonpearl)
        return false;
    if (items.glove == 2 || (items.glove && items.hammer))
        return true;
    return items.agahnim && items.hookshot && (items.hammer || items.glove || items.flippers);
}

// Define dungeon objects
export const dungeons: DungeonItem[] = [
    {
        name: "Eastern Palace <img src='/assets/bow2.png' class='mini'/>",
        x: "46.8%",
        y: "38.8%",
        image: "boss02.png",
        isBeaten: false,
        isBeatable: function (items: ItemState) {
            if (items.bow > 1)
                return "available";
            else
                return "unavailable";
        },
        canGetChest: function (items: ItemState) {
            if (items.chest0 > 1 || items.bow > 1)
                return "available";
            return "possible";
        }
    },
    {
        name: "Desert Palace <img src='/assets/glove1.png' class='mini'/>  <img src='/assets/book.png' class='mini'/>  <img src='/assets/lantern.png' class='mini'/>",
        x: "3.8%",
        y: "78.4%",
        image: "boss12.png",
        isBeaten: false,
        isBeatable: function (items: ItemState) {
            if (!items.glove)
                return "unavailable";
            if (!items.book && !(items.flute && items.glove == 2 && items.mirror))
                return "unavailable";
            if (!items.lantern && !items.firerod)
                return "unavailable";
            if (!items.boots)
                return "possible";
            return "available";
        },
        canGetChest: function (items: ItemState) {
            if (!items.book && !(items.flute && items.glove == 2 && items.mirror))
                return "unavailable";
            if (items.boots && (items.firerod || items.lantern) && items.glove)
                return "available";
            if (items.chest1 > 1 && items.boots)
                return "available";
            return "possible";
        }
    },
    {
        name: "Tower of Hera <img src='/assets/glove1.png' class='mini'/> <img src='/assets/mirror.png' class='mini'/> <img src='/assets/lantern.png' class='mini'/>",
        x: "31.0%",
        y: "5.5%",
        image: "boss22.png",
        isBeaten: false,
        isBeatable: function (items: ItemState) {
            if (!items.flute && !items.glove)
                return "unavailable";
            if (!items.mirror && !(items.hookshot && items.hammer))
                return "unavailable";
            if (items.firerod || items.lantern)
                return "available";
            return "possible";
        },
        canGetChest: function (items: ItemState) {
            return this.isBeatable(items);
        }
    },
    {
        name: "Palace of Darkness <img src='/assets/lantern.png' class='mini'> <img src='/assets/hammer.png' class='mini'/> <img src='/assets/glove1.png' class='mini'/> <img src='/assets/agahnim1.png' class='mini'/>",
        x: "97.0%",
        y: "40.0%",
        image: "boss32.png",
        isBeaten: false,
        isBeatable: function (items: ItemState) {
            if (!items.moonpearl || !(items.bow > 1) || !items.hammer)
                return "unavailable";
            if (!items.agahnim && !items.glove)
                return "unavailable";
            return "available";
        },
        canGetChest: function (items: ItemState) {
            if (!items.moonpearl)
                return "unavailable";
            if (!items.agahnim && !(items.hammer && items.glove) && !(items.glove == 2 && items.flippers))
                return "unavailable";
            if (items.bow > 1 && (items.chest3 > 1 || items.hammer))
                return "available";
            return "possible";
        }
    },
    {
        name: "Swamp Palace <img src='/assets/mirror.png' class='mini'> <img src='/assets/flippers.png' class='mini'/> <img src='/assets/hammer.png' class='mini'/> <img src='/assets/hookshot.png' class='mini'/>",
        x: "73.5%",
        y: "91.0%",
        image: "boss42.png",
        isBeaten: false,
        isBeatable: function (items: ItemState) {
            if (!items.moonpearl || !items.mirror || !items.flippers)
                return "unavailable";
            if (!items.hammer || !items.hookshot)
                return "unavailable";
            if (!items.glove && !items.agahnim)
                return "unavailable";
            return "available";
        },
        canGetChest: function (items: ItemState) {
            if (!items.moonpearl || !items.mirror || !items.flippers)
                return "unavailable";
            if (!steve(items) && !(items.agahnim && items.hammer))
                return "unavailable";

            // Here we go...
            if (items.chest4 <= 2)
                if (items.hookshot && items.hammer)
                    return "available";
                else
                    return "unavailable";
            if (items.chest4 <= 4) {
                if (!items.hammer)
                    return "unavailable";
                if (items.hookshot)
                    return "available";
                return "possible";
            }
            if (items.chest4 == 5)
                if (items.hammer)
                    return "available";
                else
                    return "unavailable";
            if (items.hammer)
                return "available";
            return "possible";
        }
    },
    {
        name: "Skull Woods <img src='/assets/firerod.png' class='mini'/>",
        x: "53.3%",
        y: "5.4%",
        image: "boss52.png",
        isBeaten: false,
        isBeatable: function (items: ItemState) {
            if (!steve(items) || !items.firerod)
                return "unavailable";
            return "available";
        },
        canGetChest: function (items: ItemState) {
            if (!steve(items))
                return "unavailable";
            if (items.firerod)
                return "available";
            return "possible";
        }
    },
    {
        name: "Thieves' Town <img src='/assets/glove2.png' class='mini'/>",
        x: "56.4%",
        y: "47.9%",
        image: "boss62.png",
        isBeaten: false,
        isBeatable: function (items: ItemState) {
            if (steve(items))
                return "available";
            return "unavailable";
        },
        canGetChest: function (items: ItemState) {
            if (!steve(items))
                return "unavailable";
            if (items.chest6 == 1 && !items.hammer)
                return "possible";
            return "available";
        }
    },
    {
        name: "Ice Palace (yellow=must bomb jump) <img src='/assets/firerod.png' class='mini'/>",
        x: "89.8%",
        y: "85.8%",
        image: "boss72.png",
        isBeaten: false,
        isBeatable: function (items: ItemState) {
            if (!items.moonpearl || !items.flippers || items.glove != 2 || !items.hammer)
                return "unavailable";
            if (!items.firerod && !items.bombos)
                return "unavailable";
            if (items.hookshot || items.somaria)
                return "available";
            return "possible";
        },
        canGetChest: function (items: ItemState) {
            if (!items.moonpearl || !items.flippers || items.glove != 2)
                return "unavailable";
            if (!items.firerod && !items.bombos)
                return "unavailable";
            if (items.hammer)
                return "available";
            return "possible";
        }
    },
    {
        name: "Misery Mire <img src='/assets/medallion0.png' class='mini'><img src='/assets/lantern.png' class='mini'>",
        x: "55.8%",
        y: "82.9%",
        image: "boss82.png",
        isBeaten: false,
        isBeatable: function (items: ItemState, medallions: number[] = []) {
            if (!items.moonpearl || !items.flute || items.glove != 2 || !items.somaria)
                return "unavailable";
            if (!items.boots && !items.hookshot)
                return "unavailable";
            // Medallion Check
            if (!items.bombos && !items.ether && !items.quake)
                return "unavailable";
            if ((medallions[8] == 1 && !items.bombos) || (medallions[8] == 2 && !items.ether) || (medallions[8] == 3 && !items.quake))
                return "unavailable";
            if (medallions[8] == 0 && !(items.bombos && items.ether && items.quake))
                return "possible";

            if (items.lantern || items.firerod)
                return "available";
            return "possible";
        },
        canGetChest: function (items: ItemState, medallions: number[] = []) {
            if (!items.moonpearl || !items.flute || items.glove != 2)
                return "unavailable";
            if (!items.boots && !items.hookshot)
                return "unavailable";
            // Medallion Check
            if (!items.bombos && !items.ether && !items.quake)
                return "unavailable";
            if ((medallions[8] == 1 && !items.bombos) || (medallions[8] == 2 && !items.ether) || (medallions[8] == 3 && !items.quake))
                return "unavailable";
            if (medallions[8] == 0 && !(items.bombos && items.ether && items.quake))
                return "possible";

            if (!items.lantern && !items.firerod)
                return "possible";
            if (items.chest8 > 1 || items.somaria)
                return "available";
            return "possible";
        }
    },
    {
        name: "Turtle Rock <img src='/assets/medallion0.png' class='mini'> <img src='/assets/lantern.png' class='mini'> <img src='/assets/icerod.png' class='mini'/> <img src='/assets/firerod.png' class='mini'/>",
        x: "96.9%",
        y: "7.0%",
        image: "boss92.png",
        isBeaten: false,
        isBeatable: function (items: ItemState, medallions: number[] = []) {
            if (!items.moonpearl || !items.hammer || items.glove != 2 || !items.somaria)
                return "unavailable";
            if (!items.hookshot && !items.mirror)
                return "unavailable";
            if (!items.icerod || !items.firerod)
                return "unavailable";
            // Medallion Check
            if (!items.bombos && !items.ether && !items.quake)
                return "unavailable";
            if ((medallions[9] == 1 && !items.bombos) || (medallions[9] == 2 && !items.ether) || (medallions[9] == 3 && !items.quake))
                return "unavailable";
            if (medallions[9] == 0 && !(items.bombos && items.ether && items.quake))
                return "possible";

            return "available";
        },
        canGetChest: function (items: ItemState, medallions: number[] = []) {
            if (!items.moonpearl || !items.hammer || items.glove != 2 || !items.somaria)
                return "unavailable";
            if (!items.hookshot && !items.mirror)
                return "unavailable";
            // Medallion Check
            if (!items.bombos && !items.ether && !items.quake)
                return "unavailable";
            if ((medallions[9] == 1 && !items.bombos) || (medallions[9] == 2 && !items.ether) || (medallions[9] == 3 && !items.quake))
                return "unavailable";
            if (medallions[9] == 0 && !(items.bombos && items.ether && items.quake))
                return "possible";

            if (!items.firerod)
                return "possible";
            if (items.chest9 > 1 || items.icerod)
                return "available";
            return "possible";
        }
    }
];

// Define overworld chests (first 10 for now)
export const chests: ChestItem[] = [
    {
        name: "King's Tomb <img src='/assets/boots.png' class='mini'> + <img src='/assets/glove2.png' class='mini'>/<img src='/assets/mirror.png' class='mini'>",
        x: "30.8%",
        y: "29.6%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (!items.boots)
                return "unavailable";
            if ((steve(items) && items.mirror) || items.glove == 2)
                return "available";
            return "unavailable";
        }
    },
    {
        name: "Light World Swamp (2)",
        x: "23.4%",
        y: "93.4%",
        isOpened: false,
        isAvailable: function () {
            return "available";
        }
    },
    {
        name: "Stoops Lonk's Hoose",
        x: "27.4%",
        y: "67.9%",
        isOpened: false,
        isAvailable: function () {
            return "available";
        }
    },
    {
        name: "Spiral Cave",
        x: "39.9%",
        y: "9.3%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if ((items.glove || items.flute) && (items.hookshot || (items.mirror && items.hammer)))
                return "available";
            return "unavailable";
        }
    },
    {
        name: "Mimic Cave (<img src='/assets/mirror.png' class='mini'> outside of Turtle Rock)(Yellow = <img src='/assets/medallion0.png' class='mini'> unkown OR possible w/out <img src='/assets/firerod.png' class='mini'>)",
        x: "42.6%",
        y: "9.3%",
        isOpened: false,
        isAvailable: function (items: ItemState, medallions: number[] = []) {
            if (!items.moonpearl || !items.hammer || items.glove != 2 || !items.somaria || !items.mirror)
                return "unavailable";
            // Medallion Check
            if (!items.bombos && !items.ether && !items.quake)
                return "unavailable";
            if ((medallions[9] == 1 && !items.bombos) || (medallions[9] == 2 && !items.ether) || (medallions[9] == 3 && !items.quake))
                return "unavailable";
            if (medallions[9] == 0 && !(items.bombos && items.ether && items.quake))
                return "possible";

            if (items.firerod)
                return "available";
            return "possible";
        }
    },
    {
        name: "Tavern",
        x: "8.1%",
        y: "57.8%",
        isOpened: false,
        isAvailable: function () {
            return "available";
        }
    },
    {
        name: "Chicken House <img src='/assets/bomb.png' class='mini'>",
        x: "4.4%",
        y: "54.2%",
        isOpened: false,
        isAvailable: function () {
            return "available";
        }
    },
    {
        name: "Bombable Hut <img src='/assets/bomb.png' class='mini'>",
        x: "55.4%",
        y: "57.8%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (steve(items))
                return "available";
            return "unavailable";
        }
    },
    {
        name: "C House",
        x: "60.8%",
        y: "47.9%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (steve(items))
                return "available";
            return "unavailable";
        }
    },
    {
        name: "Aginah's Cave <img src='/assets/bomb.png' class='mini'>",
        x: "10.0%",
        y: "82.6%",
        isOpened: false,
        isAvailable: function () {
            return "available";
        }
    }
];
