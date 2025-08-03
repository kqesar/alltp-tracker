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

// Define overworld chests - ALL 64 chests from legacy version
export const chests: ChestItem[] = [
    {
        name: "King's Tomb <img src='/assets/boots.png' class='mini'> + <img src='/assets/glove2.png' class='mini'>/<img src='/assets/mirror.png' class='mini'>",
        x: "30.8%",
        y: "29.6%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (!items.boots) return "unavailable";
            if ((steve(items) && items.mirror) || items.glove == 2) return "available";
            return "unavailable";
        }
    },
    {
        name: "Light World Swamp (2)",
        x: "23.4%",
        y: "93.4%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Stoops Lonk's Hoose",
        x: "27.4%",
        y: "67.9%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Spiral Cave",
        x: "39.9%",
        y: "9.3%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if ((items.glove || items.flute) && (items.hookshot || (items.mirror && items.hammer))) return "available";
            return "unavailable";
        }
    },
    {
        name: "Mimic Cave (<img src='/assets/mirror.png' class='mini'> outside of Turtle Rock)(Yellow = <img src='/assets/medallion0.png' class='mini'> unkown OR possible w/out <img src='/assets/firerod.png' class='mini'>)",
        x: "42.6%",
        y: "9.3%",
        isOpened: false,
        isAvailable: function (items: ItemState, medallions: number[] = []) {
            if (!items.moonpearl || !items.hammer || items.glove != 2 || !items.somaria || !items.mirror) return "unavailable";
            if (!items.bombos && !items.ether && !items.quake) return "unavailable";
            if ((medallions[9] == 1 && !items.bombos) || (medallions[9] == 2 && !items.ether) || (medallions[9] == 3 && !items.quake)) return "unavailable";
            if (medallions[9] == 0 && !(items.bombos && items.ether && items.quake)) return "possible";
            if (items.firerod) return "available";
            return "possible";
        }
    },
    {
        name: "Tavern",
        x: "8.1%",
        y: "57.8%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Chicken House <img src='/assets/bomb.png' class='mini'>",
        x: "4.4%",
        y: "54.2%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Bombable Hut <img src='/assets/bomb.png' class='mini'>",
        x: "55.4%",
        y: "57.8%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (steve(items)) return "available";
            return "unavailable";
        }
    },
    {
        name: "C House",
        x: "60.8%",
        y: "47.9%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (steve(items)) return "available";
            return "unavailable";
        }
    },
    {
        name: "Aginah's Cave <img src='/assets/bomb.png' class='mini'>",
        x: "10.0%",
        y: "82.6%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "West of Mire (2)",
        x: "51.7%",
        y: "79.5%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.flute && items.moonpearl && items.glove == 2) return "available";
            return "unavailable";
        }
    },
    {
        name: "DW Death Mountain (2) : Don't need <img src='/assets/moonpearl.png' class='mini'>",
        x: "92.8%",
        y: "14.7%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.glove == 2 && (items.hookshot || (items.mirror && items.hammer))) return "available";
            return "unavailable";
        }
    },
    {
        name: "Sahasrahla's Hut (3) <img src='/assets/bomb.png' class='mini'>/<img src='/assets/boots.png' class='mini'>",
        x: "40.7%",
        y: "41.4%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Byrna Spike Cave",
        x: "78.6%",
        y: "14.9%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.moonpearl && items.glove && items.hammer) return "available";
            return "unavailable";
        }
    },
    {
        name: "Kakariko Well (4 + <img src='/assets/bomb.png' class='mini'>)",
        x: "1.7%",
        y: "41.0%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Thieve's Hut (4 + <img src='/assets/bomb.png' class='mini'>)",
        x: "6.4%",
        y: "41.0%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Hype Cave! <img src='/assets/bomb.png' class='mini'> (NPC + 4 <img src='/assets/bomb.png' class='mini'>)",
        x: "80.0%",
        y: "77.1%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (steve(items) || (items.agahnim && items.moonpearl && items.hammer)) return "available";
            return "unavailable";
        }
    },
    {
        name: "Death Mountain East (5 + 2 <img src='/assets/bomb.png' class='mini'>)",
        x: "41.4%",
        y: "17.1%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if ((items.glove || items.flute) && (items.hookshot || (items.mirror && items.hammer))) return "available";
            return "unavailable";
        }
    },
    {
        name: "West of Sanctuary <img src='/assets/boots.png' class='mini'>",
        x: "19.5%",
        y: "29.3%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.boots) return "available";
            return "unavailable";
        }
    },
    {
        name: "Minimoldorm Cave (NPC + 4) <img src='/assets/bomb.png' class='mini'>",
        x: "32.6%",
        y: "93.4%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Ice Rod Cave <img src='/assets/bomb.png' class='mini'>",
        x: "44.7%",
        y: "76.9%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Cave Under Rock (bottom chest) <img src='/assets/hookshot.png' class='mini'>/<img src='/assets/boots.png' class='mini'>",
        x: "91.6%",
        y: "8.6%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.moonpearl && items.glove == 2 && (items.hookshot || (items.mirror && items.hammer && items.boots))) return "available";
            return "unavailable";
        }
    },
    {
        name: "Cave Under Rock (3 top chests) <img src='/assets/hookshot.png' class='mini'>",
        x: "91.6%",
        y: "3.4%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.moonpearl && items.glove == 2 && items.hookshot) return "available";
            return "unavailable";
        }
    },
    {
        name: "Treasure Chest Minigame: Pay 30 rupees",
        x: "52.1%",
        y: "46.4%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (steve(items)) return "available";
            return "unavailable";
        }
    },
    {
        name: "Bottle Vendor: Pay 100 rupees",
        x: "4.5%",
        y: "46.8%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Sahasrahla <img src='/assets/pendant0.png' class='mini'>",
        x: "40.7%",
        y: "46.7%",
        isOpened: false,
        isAvailable: function () { return "unavailable"; } // Needs pendant logic
    },
    {
        name: "Ol' Stumpy",
        x: "65.5%",
        y: "68.6%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (steve(items) || (items.agahnim && items.moonpearl && items.hammer)) return "available";
            return "unavailable";
        }
    },
    {
        name: "Dying Boy: Distract him with <img src='/assets/bottle0.png' class='mini'> so that you can rob his family!",
        x: "7.8%",
        y: "52.1%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.bottle) return "available";
            return "unavailable";
        }
    },
    {
        name: "Reunite the Hammer Brothers and show the Purple Chest to Gary",
        x: "65.2%",
        y: "52.2%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.moonpearl && items.glove == 2 && items.mirror) return "available";
            return "unavailable";
        }
    },
    {
        name: "Fugitive under the bridge <img src='/assets/flippers.png' class='mini'>",
        x: "35.4%",
        y: "69.7%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.flippers) return "available";
            return "unavailable";
        }
    },
    {
        name: "Ether Tablet <img src='/assets/sword2.png' class='mini'><img src='/assets/book.png' class='mini'>",
        x: "21.0%",
        y: "3.0%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.sword >= 2 && items.book && (items.glove || items.flute) && (items.mirror || (items.hookshot && items.hammer))) return "available";
            return "unavailable";
        }
    },
    {
        name: "Bombos Tablet <img src='/assets/mirror.png' class='mini'><img src='/assets/sword2.png' class='mini'><img src='/assets/book.png' class='mini'>",
        x: "11.0%",
        y: "92.2%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if ((steve(items) || (items.agahnim && items.moonpearl && items.hammer)) && items.mirror && items.sword >= 2 && items.book) return "available";
            return "unavailable";
        }
    },
    {
        name: "Catfish",
        x: "96.0%",
        y: "17.2%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.moonpearl && items.glove && (items.agahnim || items.hammer || (items.glove == 2 && items.flippers))) return "available";
            return "unavailable";
        }
    },
    {
        name: "King Zora: Pay 500 rupees",
        x: "47.5%",
        y: "12.1%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.flippers || items.glove) return "available";
            return "unavailable";
        }
    },
    {
        name: "Lost Old Man",
        x: "20.8%",
        y: "20.4%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.glove || items.flute) return "available";
            return "unavailable";
        }
    },
    {
        name: "Witch: Give her <img src='/assets/mushroom.png' class='mini'>",
        x: "40.8%",
        y: "32.5%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.mushroom) return "available";
            return "unavailable";
        }
    },
    {
        name: "Forest Hideout",
        x: "9.4%",
        y: "13.0%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Lumberjack Tree <img src='/assets/agahnim0.png' class='mini'><img src='/assets/boots.png' class='mini'>",
        x: "15.1%",
        y: "7.6%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.agahnim && items.boots) return "available";
            return "possible";
        }
    },
    {
        name: "Spectacle Rock Cave",
        x: "24.3%",
        y: "14.8%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.glove || items.flute) return "available";
            return "unavailable";
        }
    },
    {
        name: "South of Grove <img src='/assets/mirror.png' class='mini'>",
        x: "14.1%",
        y: "84.1%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.mirror && (steve(items) || (items.agahnim && items.moonpearl && items.hammer))) return "available";
            return "unavailable";
        }
    },
    {
        name: "Graveyard Cliff Cave <img src='/assets/mirror.png' class='mini'>",
        x: "28.1%",
        y: "27.0%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (steve(items) && items.mirror) return "available";
            return "unavailable";
        }
    },
    {
        name: "Checkerboard Cave <img src='/assets/mirror.png' class='mini'>",
        x: "8.8%",
        y: "77.3%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.flute && items.glove == 2 && items.mirror) return "available";
            return "unavailable";
        }
    },
    {
        name: "<img src='/assets/hammer.png' class='mini'><img src='/assets/hammer.png' class='mini'><img src='/assets/hammer.png' class='mini'><img src='/assets/hammer.png' class='mini'><img src='/assets/hammer.png' class='mini'><img src='/assets/hammer.png' class='mini'><img src='/assets/hammer.png' class='mini'><img src='/assets/hammer.png' class='mini'>!!!!!!!!",
        x: "65.8%",
        y: "60.1%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.moonpearl && items.glove == 2 && items.hammer) return "available";
            return "unavailable";
        }
    },
    {
        name: "Library <img src='/assets/boots.png' class='mini'>",
        x: "7.7%",
        y: "65.9%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.boots) return "available";
            return "possible";
        }
    },
    {
        name: "Mushroom",
        x: "6.2%",
        y: "8.6%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Spectacle Rock <img src='/assets/mirror.png' class='mini'>",
        x: "25.4%",
        y: "8.5%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.glove || items.flute) {
                if (items.mirror) return "available";
                else return "possible";
            }
            return "unavailable";
        }
    },
    {
        name: "Floating Island <img src='/assets/mirror.png' class='mini'>",
        x: "40.2%",
        y: "3.0%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if ((items.glove || items.flute) && (items.hookshot || (items.hammer && items.mirror))) {
                if (items.mirror && items.moonpearl && items.glove == 2) return "available";
                else return "possible";
            }
            return "unavailable";
        }
    },
    {
        name: "Race Minigame <img src='/assets/bomb.png' class='mini'>/<img src='/assets/boots.png' class='mini'>",
        x: "1.8%",
        y: "69.8%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Desert West Ledge <img src='/assets/book.png' class='mini'>/<img src='/assets/mirror.png' class='mini'>",
        x: "1.5%",
        y: "91.0%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.book || (items.flute && items.glove == 2 && items.mirror)) return "available";
            return "possible";
        }
    },
    {
        name: "Lake Hylia Island <img src='/assets/mirror.png' class='mini'>",
        x: "36.1%",
        y: "82.9%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.flippers) {
                if (items.moonpearl && items.mirror && (items.agahnim || items.glove == 2 || (items.glove && items.hammer))) return "available";
                else return "possible";
            }
            return "unavailable";
        }
    },
    {
        name: "Bumper Cave <img src='/assets/cape.png' class='mini'>",
        x: "67.1%",
        y: "15.2%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (steve(items)) {
                if (items.cape && items.glove) return "available";
                else return "possible";
            }
            return "unavailable";
        }
    },
    {
        name: "Pyramid",
        x: "79.0%",
        y: "43.5%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.agahnim || (items.glove && items.hammer && items.moonpearl) || (items.glove == 2 && items.moonpearl && items.flippers)) return "available";
            return "unavailable";
        }
    },
    {
        name: "Alec Baldwin's Dig-a-Thon: Pay 80 rupees",
        x: "52.9%",
        y: "69.2%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (steve(items) || (items.agahnim && items.moonpearl && items.hammer)) return "available";
            return "unavailable";
        }
    },
    {
        name: "Zora River Ledge <img src='/assets/flippers.png' class='mini'>",
        x: "47.5%",
        y: "17.3%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.flippers) return "available";
            if (items.glove) return "possible";
            return "unavailable";
        }
    },
    {
        name: "Buried Item <img src='/assets/shovel.png' class='mini'>",
        x: "14.4%",
        y: "66.2%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.shovel) return "available";
            return "unavailable";
        }
    },
    {
        name: "Fall to Escape Sewer (3) <img src='/assets/glove1.png' class='mini'> + <img src='/assets/bomb.png' class='mini'>/<img src='/assets/boots.png' class='mini'>",
        x: "26.8%",
        y: "32.4%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.glove) return "available";
            return "unavailable";
        }
    },
    {
        name: "Castle Secret Entrance",
        x: "29.8%",
        y: "41.8%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Hyrule Castle (4 including Key)",
        x: "24.9%",
        y: "44.1%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Sanctuary",
        x: "23.0%",
        y: "28.0%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    },
    {
        name: "Mad Batter <img src='/assets/hammer.png' class='mini'>/<img src='/assets/mirror.png' class='mini'> + <img src='/assets/powder.png' class='mini'>",
        x: "16.0%",
        y: "58.0%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.powder && (items.hammer || (items.glove == 2 && items.mirror && items.moonpearl))) return "available";
            return "unavailable";
        }
    },
    {
        name: "Take the frog home <img src='/assets/mirror.png' class='mini'>",
        x: "15.2%",
        y: "51.8%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.moonpearl && items.glove == 2 && items.mirror) return "available";
            return "unavailable";
        }
    },
    {
        name: "Fat Fairy: Buy OJ bomb from Dark Link's House after <img src='/assets/crystal0.png' class='mini'>5 <img src='/assets/crystal0.png' class='mini'>6 (2 items)",
        x: "73.5%",
        y: "48.5%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (!items.moonpearl) return "unavailable";
            if (items.hammer && (items.agahnim || items.glove)) return "available";
            if (items.agahnim && items.mirror && steve(items)) return "available";
            return "unavailable";
        }
    },
    {
        name: "Master Sword Pedestal <img src='/assets/pendant0.png' class='mini'><img src='/assets/pendant1.png' class='mini'><img src='/assets/pendant2.png' class='mini'> (can check with <img src='/assets/book.png' class='mini'>)",
        x: "2.5%",
        y: "3.2%",
        isOpened: false,
        isAvailable: function (items: ItemState) {
            if (items.book) return "possible";
            return "unavailable"; // Needs pendant counting logic
        }
    },
    {
        name: "Bridge",
        x: "24.9%",
        y: "57.1%",
        isOpened: false,
        isAvailable: function () { return "available"; }
    }
];
