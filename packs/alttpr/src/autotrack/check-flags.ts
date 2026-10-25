// Where memory says a location was checked, for every pack location that
// has such a flag, and why the others have none.
//
// Room, screen and NPC flags come from Archipelago's ALttP client
// (MEMORY_SOURCES.ap, Client.py:52-325: location_table_uw, _npc, _ow and
// _misc), which names nine locations otherwise than v31 does: "Hyrule
// Castle - Zelda's Chest" (Zelda's Cell), "Mini Moldorm Cave - Generous Guy"
// and "Hype Cave - Generous Guy" (their NPC), "Bonk Rock Cave" (Pegasus
// Rocks), "Peg Cave" (Hammer Pegs), "Graveyard Cave" (Graveyard Ledge),
// "Bumper Cave Ledge" (Bumper Cave), "Ganons Tower - Validation Chest"
// (Moldorm Chest), and "Ganons Tower" for "Ganon's Tower". The spec
// (check-flags.spec.ts) holds these tables to z3randomizer's own layout:
// the bits sram.asm documents, the boss rooms and heart piece rooms
// heartpieces.asm lists, and the dungeon totals vt writes for the compass
// counts.
//
// Dungeon prizes and the Agahnims come from the base patch itself
// (MEMORY_SOURCES.z3): DungeonsCompleted, ProgressIndicator, Aga2Duck.

import {
  DUNGEON,
  type DungeonCode,
  MEMORY_RANGES,
  type MemoryRangeId,
  ROOM_BITS,
  roomAddress,
  SAVE_DATA,
  SCREEN_ITEM,
  type SourceRef,
  screenAddress,
} from "./memory";

/** A flag that says a location was checked. */
export type CheckFlag =
  | {
      /** The range it is read from. */
      readonly range: MemoryRangeId;
      /** A-bus address of its byte, or of its word's low byte. */
      readonly at: number;
      readonly size: 1 | 2;
      /** Checked when any of these bits is set (little endian). */
      readonly mask: number;
    }
  | {
      readonly range: MemoryRangeId;
      readonly at: number;
      readonly size: 1;
      /** Checked when the byte is at least this value. */
      readonly atLeast: number;
    };

export interface CheckEntry {
  /** The pack's location id. */
  readonly id: string;
  readonly flag: CheckFlag;
  /** The dungeon it lies in, or null outside dungeons (Race Mode's split). */
  readonly dungeon: DungeonCode | null;
  readonly source: SourceRef;
}

/**
 * The dungeons' locations, by id: Race Mode's dungeons (Hyrule Castle with
 * its sewers, Castle Tower, the twelve others). Link's Uncle and the Secret
 * Passage share the escape's region upstream but stand outside the castle:
 * the compass totals count eight Hyrule Castle locations without them (vt
 * app/Rom.php:2015).
 */
const DUNGEON_OF_ID: ReadonlyMap<string, DungeonCode> = new Map([
  ["agahnim", "A1"],
  ["agahnim-2", "A2"],
  ["sanctuary", "H2"],
  ["zelda", "H2"],
]);
const DUNGEON_PREFIXES: readonly (readonly [string, DungeonCode])[] = [
  ["castle-tower/", "A1"],
  ["desert-palace/", "P2"],
  ["eastern-palace/", "P1"],
  ["ganons-tower/", "A2"],
  ["hyrule-castle/", "H2"],
  ["ice-palace/", "D5"],
  ["misery-mire/", "D6"],
  ["palace-of-darkness/", "D1"],
  ["sewers/", "H2"],
  ["skull-woods/", "D3"],
  ["swamp-palace/", "D2"],
  ["thieves-town/", "D4"],
  ["tower-of-hera/", "P3"],
  ["turtle-rock/", "D7"],
];

/** The dungeon a location id lies in, or null. */
export function dungeonOf(id: string): DungeonCode | null {
  const exact = DUNGEON_OF_ID.get(id);
  if (exact !== undefined) return exact;
  for (const [prefix, code] of DUNGEON_PREFIXES) {
    if (id.startsWith(prefix)) return code;
  }
  return null;
}

/** The first range of `categories` holding the `size` bytes at `at`. */
function rangeAt(
  at: number,
  size: number,
  categories: readonly string[],
): MemoryRangeId {
  const found = MEMORY_RANGES.find(
    (range) =>
      categories.includes(range.category) &&
      range.bus <= at &&
      at + size <= range.bus + range.size,
  );
  if (found === undefined) {
    throw new RangeError(`No ${categories.join(" or ")} range at ${at}`);
  }
  return found.id;
}

const ap = (line: number): SourceRef => `ap:Client.py:${line}`;

/** A room flag: dungeon chests in the dungeon rooms, bosses in their room. */
function roomEntry(
  id: string,
  room: number,
  mask: number,
  line: number,
): CheckEntry {
  const dungeon = dungeonOf(id);
  const at = roomAddress(room);
  const categories =
    dungeon === null
      ? ["outside-checks"]
      : mask === ROOM_BITS.boss
        ? ["boss-kills"]
        : ["dungeon-checks"];
  return {
    dungeon,
    flag: { at, mask, range: rangeAt(at, 2, categories), size: 2 },
    id,
    source: ap(line),
  };
}

// [id, room, mask, Client.py line]: location_table_uw.
const ROOMS: readonly (readonly [string, number, number, number])[] = [
  ["sahasrahlas-hut/left", 0x105, 0x10, 66],
  ["sahasrahlas-hut/middle", 0x105, 0x20, 67],
  ["sahasrahlas-hut/right", 0x105, 0x40, 68],
  ["waterfall-fairy/left", 0x114, 0x10, 58],
  ["waterfall-fairy/right", 0x114, 0x20, 59],
  ["kings-tomb", 0x113, 0x10, 60],
  ["kakariko-tavern", 0x103, 0x10, 63],
  ["chicken-house", 0x108, 0x10, 64],
  ["kakariko-well/top", 0x2f, 0x10, 69],
  ["kakariko-well/left", 0x2f, 0x20, 70],
  ["kakariko-well/middle", 0x2f, 0x40, 71],
  ["kakariko-well/right", 0x2f, 0x80, 72],
  ["kakariko-well/bottom", 0x2f, 0x100, 73],
  ["blinds-hideout/top", 0x11d, 0x10, 52],
  ["blinds-hideout/left", 0x11d, 0x20, 53],
  ["blinds-hideout/right", 0x11d, 0x40, 54],
  ["blinds-hideout/far-left", 0x11d, 0x80, 55],
  ["blinds-hideout/far-right", 0x11d, 0x100, 56],
  ["pegasus-rocks", 0x124, 0x10, 85],
  ["lost-woods-hideout", 0xe1, 0x200, 74],
  ["lumberjack-tree", 0xe2, 0x200, 75],
  ["graveyard-ledge", 0x11b, 0x200, 77],
  ["floodgate-chest", 0x10b, 0x10, 61],
  ["links-house", 0x104, 0x10, 62],
  ["aginahs-cave", 0x10a, 0x10, 65],
  ["mini-moldorm-cave/far-left", 0x123, 0x10, 79],
  ["mini-moldorm-cave/left", 0x123, 0x20, 80],
  ["mini-moldorm-cave/right", 0x123, 0x40, 81],
  ["mini-moldorm-cave/far-right", 0x123, 0x80, 82],
  ["ice-rod-cave", 0x120, 0x10, 84],
  ["cave-45", 0x11b, 0x400, 76],
  ["checkerboard-cave", 0x126, 0x200, 78],
  ["mini-moldorm-cave/npc", 0x123, 0x400, 83],
  ["sanctuary", 0x12, 0x10, 114],
  ["sewers/secret-room/left", 0x11, 0x10, 111],
  ["sewers/secret-room/middle", 0x11, 0x20, 112],
  ["sewers/secret-room/right", 0x11, 0x40, 113],
  ["sewers/dark-cross", 0x32, 0x10, 109],
  ["hyrule-castle/boomerang-chest", 0x71, 0x10, 103],
  ["hyrule-castle/map-chest", 0x72, 0x10, 105],
  ["hyrule-castle/zeldas-cell", 0x80, 0x10, 107],
  ["secret-passage", 0x55, 0x10, 57],
  ["eastern-palace/compass-chest", 0xa8, 0x10, 95],
  ["eastern-palace/big-chest", 0xa9, 0x10, 96],
  ["eastern-palace/cannonball-chest", 0xb9, 0x10, 99],
  ["eastern-palace/big-key-chest", 0xb8, 0x10, 100],
  ["eastern-palace/map-chest", 0xaa, 0x10, 101],
  ["eastern-palace/boss", 0xc8, 0x800, 102],
  ["desert-palace/big-chest", 0x73, 0x10, 86],
  ["desert-palace/map-chest", 0x74, 0x10, 88],
  ["desert-palace/torch", 0x73, 0x400, 87],
  ["desert-palace/big-key-chest", 0x75, 0x10, 90],
  ["desert-palace/compass-chest", 0x85, 0x10, 89],
  ["desert-palace/boss", 0x33, 0x800, 94],
  ["spectacle-rock-cave", 0xea, 0x400, 119],
  ["spiral-cave", 0xfe, 0x10, 127],
  ["mimic-cave", 0x10c, 0x10, 154],
  ["paradox-cave-lower/far-left", 0xef, 0x10, 120],
  ["paradox-cave-lower/left", 0xef, 0x20, 121],
  ["paradox-cave-lower/right", 0xef, 0x40, 122],
  ["paradox-cave-lower/far-right", 0xef, 0x80, 123],
  ["paradox-cave-lower/middle", 0xef, 0x100, 124],
  ["paradox-cave-upper/left", 0xff, 0x10, 125],
  ["paradox-cave-upper/right", 0xff, 0x20, 126],
  ["tower-of-hera/big-key-chest", 0x87, 0x10, 130],
  ["tower-of-hera/basement-cage", 0x87, 0x400, 128],
  ["tower-of-hera/map-chest", 0x77, 0x10, 129],
  ["tower-of-hera/compass-chest", 0x27, 0x20, 131],
  ["tower-of-hera/big-chest", 0x27, 0x10, 132],
  ["tower-of-hera/boss", 0x07, 0x800, 133],
  ["castle-tower/room-03", 0xe0, 0x10, 115],
  ["castle-tower/dark-maze", 0xd0, 0x10, 116],
  ["superbunny-cave/top", 0xf8, 0x10, 147],
  ["superbunny-cave/bottom", 0xf8, 0x20, 148],
  ["hookshot-cave/top-right", 0x3c, 0x10, 150],
  ["hookshot-cave/top-left", 0x3c, 0x20, 151],
  ["hookshot-cave/bottom-left", 0x3c, 0x40, 153],
  ["hookshot-cave/bottom-right", 0x3c, 0x80, 152],
  ["spike-cave", 0x117, 0x10, 149],
  ["pyramid-fairy/left", 0x116, 0x10, 140],
  ["pyramid-fairy/right", 0x116, 0x20, 141],
  ["brewery", 0x106, 0x10, 142],
  ["c-shaped-house", 0x11c, 0x10, 143],
  ["chest-game", 0x106, 0x400, 144],
  ["hammer-pegs", 0x127, 0x400, 139],
  ["hype-cave/top", 0x11e, 0x10, 134],
  ["hype-cave/middle-right", 0x11e, 0x20, 135],
  ["hype-cave/middle-left", 0x11e, 0x40, 136],
  ["hype-cave/bottom", 0x11e, 0x80, 137],
  ["hype-cave/npc", 0x11e, 0x400, 138],
  ["mire-shed/left", 0x10d, 0x10, 145],
  ["mire-shed/right", 0x10d, 0x20, 146],
  ["palace-of-darkness/shooter-room", 0x09, 0x10, 227],
  ["palace-of-darkness/big-key-chest", 0x3a, 0x10, 230],
  ["palace-of-darkness/the-arena/ledge", 0x2a, 0x10, 231],
  ["palace-of-darkness/the-arena/bridge", 0x2a, 0x20, 228],
  ["palace-of-darkness/stalfos-basement", 0x0a, 0x10, 229],
  ["palace-of-darkness/map-chest", 0x2b, 0x10, 232],
  ["palace-of-darkness/big-chest", 0x1a, 0x10, 238],
  ["palace-of-darkness/compass-chest", 0x1a, 0x20, 233],
  ["palace-of-darkness/harmless-hellway", 0x1a, 0x40, 239],
  ["palace-of-darkness/dark-basement/left", 0x6a, 0x10, 234],
  ["palace-of-darkness/dark-basement/right", 0x6a, 0x20, 235],
  ["palace-of-darkness/dark-maze/top", 0x19, 0x10, 236],
  ["palace-of-darkness/dark-maze/bottom", 0x19, 0x20, 237],
  ["palace-of-darkness/boss", 0x5a, 0x800, 240],
  ["swamp-palace/entrance", 0x28, 0x10, 155],
  ["swamp-palace/big-chest", 0x36, 0x10, 160],
  ["swamp-palace/big-key-chest", 0x35, 0x10, 163],
  ["swamp-palace/map-chest", 0x37, 0x10, 156],
  ["swamp-palace/west-chest", 0x34, 0x10, 164],
  ["swamp-palace/compass-chest", 0x46, 0x10, 161],
  ["swamp-palace/flooded-room/left", 0x76, 0x10, 165],
  ["swamp-palace/flooded-room/right", 0x76, 0x20, 166],
  ["swamp-palace/waterfall-room", 0x66, 0x10, 167],
  ["swamp-palace/boss", 0x06, 0x800, 169],
  ["skull-woods/big-chest", 0x58, 0x10, 182],
  ["skull-woods/big-key-chest", 0x57, 0x10, 185],
  ["skull-woods/compass-chest", 0x67, 0x10, 180],
  ["skull-woods/map-chest", 0x58, 0x20, 181],
  ["skull-woods/bridge-room", 0x59, 0x10, 187],
  ["skull-woods/pot-prison", 0x57, 0x20, 183],
  ["skull-woods/pinball-room", 0x68, 0x10, 184],
  ["skull-woods/boss", 0x29, 0x800, 189],
  ["thieves-town/attic", 0x65, 0x10, 176],
  ["thieves-town/big-key-chest", 0xdb, 0x20, 170],
  ["thieves-town/map-chest", 0xdb, 0x10, 171],
  ["thieves-town/compass-chest", 0xdc, 0x10, 172],
  ["thieves-town/ambush-chest", 0xcb, 0x10, 173],
  ["thieves-town/big-chest", 0x44, 0x10, 177],
  ["thieves-town/blinds-cell", 0x45, 0x10, 178],
  ["thieves-town/boss", 0xac, 0x800, 179],
  ["ice-palace/big-key-chest", 0x1f, 0x10, 198],
  ["ice-palace/compass-chest", 0x2e, 0x10, 191],
  ["ice-palace/map-chest", 0x3f, 0x10, 200],
  ["ice-palace/spike-room", 0x5f, 0x10, 197],
  ["ice-palace/freezor-chest", 0x7e, 0x10, 193],
  ["ice-palace/iced-t-room", 0xae, 0x10, 195],
  ["ice-palace/big-chest", 0x9e, 0x10, 194],
  ["ice-palace/boss", 0xde, 0x800, 201],
  ["misery-mire/big-chest", 0xc3, 0x10, 202],
  ["misery-mire/main-lobby", 0xc2, 0x10, 204],
  ["misery-mire/big-key-chest", 0xd1, 0x10, 211],
  ["misery-mire/compass-chest", 0xc1, 0x10, 210],
  ["misery-mire/bridge-chest", 0xa2, 0x10, 205],
  ["misery-mire/map-chest", 0xc3, 0x20, 203],
  ["misery-mire/spike-chest", 0xb3, 0x10, 207],
  ["misery-mire/boss", 0x90, 0x800, 212],
  ["turtle-rock/chain-chomps", 0xb6, 0x10, 217],
  ["turtle-rock/compass-chest", 0xd6, 0x10, 213],
  ["turtle-rock/roller-room/left", 0xb7, 0x10, 214],
  ["turtle-rock/roller-room/right", 0xb7, 0x20, 215],
  ["turtle-rock/big-chest", 0x24, 0x10, 220],
  ["turtle-rock/big-key-chest", 0x14, 0x10, 219],
  ["turtle-rock/crystaroller-room", 0x04, 0x10, 221],
  ["turtle-rock/eye-bridge/bottom-left", 0xd5, 0x80, 222],
  ["turtle-rock/eye-bridge/bottom-right", 0xd5, 0x40, 223],
  ["turtle-rock/eye-bridge/top-left", 0xd5, 0x20, 224],
  ["turtle-rock/eye-bridge/top-right", 0xd5, 0x10, 225],
  ["turtle-rock/boss", 0xa4, 0x800, 226],
  ["ganons-tower/bobs-torch", 0x8c, 0x400, 242],
  ["ganons-tower/dms-room/top-left", 0x7b, 0x10, 251],
  ["ganons-tower/dms-room/top-right", 0x7b, 0x20, 252],
  ["ganons-tower/dms-room/bottom-left", 0x7b, 0x40, 253],
  ["ganons-tower/dms-room/bottom-right", 0x7b, 0x80, 254],
  ["ganons-tower/randomizer-room/top-left", 0x7c, 0x10, 258],
  ["ganons-tower/randomizer-room/top-right", 0x7c, 0x20, 259],
  ["ganons-tower/randomizer-room/bottom-left", 0x7c, 0x40, 260],
  ["ganons-tower/randomizer-room/bottom-right", 0x7c, 0x80, 261],
  ["ganons-tower/firesnake-room", 0x7d, 0x10, 257],
  ["ganons-tower/map-chest", 0x8b, 0x10, 255],
  ["ganons-tower/big-chest", 0x8c, 0x10, 263],
  ["ganons-tower/hope-room/left", 0x8c, 0x20, 243],
  ["ganons-tower/hope-room/right", 0x8c, 0x40, 244],
  ["ganons-tower/bobs-chest", 0x8c, 0x80, 262],
  ["ganons-tower/tile-room", 0x8d, 0x10, 245],
  ["ganons-tower/compass-room/top-left", 0x9d, 0x10, 246],
  ["ganons-tower/compass-room/top-right", 0x9d, 0x20, 247],
  ["ganons-tower/compass-room/bottom-left", 0x9d, 0x40, 248],
  ["ganons-tower/compass-room/bottom-right", 0x9d, 0x80, 249],
  ["ganons-tower/big-key-chest", 0x1c, 0x10, 266],
  ["ganons-tower/big-key-room/left", 0x1c, 0x20, 264],
  ["ganons-tower/big-key-room/right", 0x1c, 0x40, 265],
  ["ganons-tower/mini-helmasaur-room/left", 0x3d, 0x10, 267],
  ["ganons-tower/mini-helmasaur-room/right", 0x3d, 0x20, 268],
  ["ganons-tower/pre-moldorm-chest", 0x3d, 0x40, 270],
  ["ganons-tower/moldorm-chest", 0x4d, 0x10, 271],
];

// [id, screen, Client.py line]: location_table_ow, bit SCREEN_ITEM.
const SCREENS: readonly (readonly [string, number, number])[] = [
  ["zoras-ledge", 0x81, 308],
  ["master-sword-pedestal", 0x80, 312],
  ["maze-race", 0x28, 310],
  ["desert-ledge", 0x30, 311],
  ["lake-hylia-island", 0x35, 309],
  ["sunken-treasure", 0x3b, 307],
  ["flute-spot", 0x2a, 306],
  ["spectacle-rock", 0x03, 313],
  ["floating-island", 0x05, 317],
  ["pyramid", 0x5b, 314],
  ["bumper-cave", 0x4a, 316],
  ["digging-game", 0x68, 315],
];

// [id, mask over the word at $7E:F410, Client.py line]: location_table_npc.
const NPCS: readonly (readonly [string, number, number])[] = [
  ["sahasrahla", 0x0010, 292],
  ["king-zora", 0x0002, 291],
  ["potion-shop", 0x2000, 297],
  ["magic-bat", 0x8000, 294],
  ["sick-kid", 0x0004, 295],
  ["mushroom", 0x1000, 290],
  ["bombos-tablet", 0x0200, 302],
  ["library", 0x0080, 296],
  ["old-man", 0x0001, 298],
  ["ether-tablet", 0x0100, 299],
  ["catfish", 0x0020, 300],
  ["blacksmith", 0x0400, 293],
  ["stumpy", 0x0008, 301],
];

// [id, save data offset, mask, Client.py line]: location_table_misc.
const MISC: readonly (readonly [string, number, number, number])[] = [
  ["bottle-merchant", 0x3c9, 0x02, 321],
  ["purple-chest", 0x3c9, 0x10, 322],
  ["links-uncle", 0x3c6, 0x01, 323],
  ["hobo", 0x3c9, 0x01, 324],
];

/** The ten dungeon prizes: the dungeon's bit in DungeonsCompleted. */
const PRIZES: readonly (readonly [string, DungeonCode])[] = [
  ["eastern-palace/prize", "P1"],
  ["desert-palace/prize", "P2"],
  ["tower-of-hera/prize", "P3"],
  ["palace-of-darkness/prize", "D1"],
  ["swamp-palace/prize", "D2"],
  ["skull-woods/prize", "D3"],
  ["thieves-town/prize", "D4"],
  ["ice-palace/prize", "D5"],
  ["misery-mire/prize", "D6"],
  ["turtle-rock/prize", "D7"],
];

const DUNGEONS_COMPLETED = SAVE_DATA + 0x472;
const PROGRESS = SAVE_DATA + 0x3c5;

function saveEntry(
  id: string,
  offset: number,
  size: 1 | 2,
  mask: number,
  source: SourceRef,
): CheckEntry {
  const at = SAVE_DATA + offset;
  const dungeon = dungeonOf(id);
  return {
    dungeon,
    flag: {
      at,
      mask,
      range: rangeAt(
        at,
        size,
        dungeon === null ? ["outside-checks"] : ["items", "boss-kills"],
      ),
      size,
    },
    id,
    source,
  };
}

/** Every pack location memory can tell checked, in the pack's order. */
export const CHECK_FLAGS: readonly CheckEntry[] = [
  ...ROOMS.map(([id, room, mask, line]) => roomEntry(id, room, mask, line)),
  ...SCREENS.map(
    ([id, screen, line]): CheckEntry =>
      saveEntry(
        id,
        screenAddress(screen) - SAVE_DATA,
        1,
        SCREEN_ITEM,
        ap(line),
      ),
  ),
  ...NPCS.map(([id, mask, line]) => saveEntry(id, 0x410, 2, mask, ap(line))),
  ...MISC.map(([id, offset, mask, line]) =>
    saveEntry(id, offset, 1, mask, ap(line)),
  ),
  ...PRIZES.map(([id, code]) =>
    saveEntry(
      id,
      DUNGEONS_COMPLETED - SAVE_DATA,
      2,
      DUNGEON[code].bit,
      "z3:dungeondrops.asm:323-329",
    ),
  ),
  // Zelda's rescue sets ProgressIndicator to $02 (zelda.asm:11-13); Open
  // starts there (vt app/Rom.php:1558), as upstream gives RescueZelda at the
  // start of Open. Agahnim's fall sets $03 (events.asm:89-90, sram.asm:192).
  {
    dungeon: "H2",
    flag: { at: PROGRESS, atLeast: 2, range: "progress", size: 1 },
    id: "zelda",
    source: "z3:zelda.asm:11-13",
  },
  {
    dungeon: "A1",
    flag: { at: PROGRESS, atLeast: 3, range: "progress", size: 1 },
    id: "agahnim",
    source: "z3:events.asm:89-90",
  },
  saveEntry("agahnim-2", 0x40f, 1, 0x01, "z3:events.asm:104-106"),
];

/** A pack location memory cannot tell checked, and why. */
export interface UnmappedLocation {
  readonly id: string;
  readonly reason: string;
}

const NO_FLAG =
  "no flag in the base patch's SRAM map (z3 sram.asm) nor in AP's tables";

/** Every pack location CHECK_FLAGS leaves out. */
export const UNMAPPED_LOCATIONS: readonly UnmappedLocation[] = [
  {
    id: "pyramid-fairy/sword",
    reason: `A trade with the fairy: ${NO_FLAG}; what she gives shows in the inventory only.`,
  },
  {
    id: "pyramid-fairy/bow",
    reason: `A trade with the fairy: ${NO_FLAG}; what she gives shows in the inventory only.`,
  },
  {
    id: "ganon",
    reason:
      "Memory says the goal was reached (game mode $19, StatsLocked), not that Ganon fell: the seed's goal may be another.",
  },
  {
    id: "turtle-rock-medallion",
    reason:
      "Holds the medallion that opens the dungeon: not a check, and no flag says it is known. Outside Race Mode the ROM names it, told once the game shows it (autotrack/medallion-pads.ts).",
  },
  {
    id: "misery-mire-medallion",
    reason:
      "Holds the medallion that opens the dungeon: not a check, and no flag says it is known. Outside Race Mode the ROM names it, told once the game shows it (autotrack/medallion-pads.ts).",
  },
  { id: "waterfall-bottle", reason: `A fairy fountain: ${NO_FLAG}.` },
  { id: "pyramid-bottle", reason: `A fairy fountain: ${NO_FLAG}.` },
];
