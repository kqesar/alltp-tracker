// Fixtures for ALttPR's autotracking specs, not part of the app: a console's
// memory holding an alttpr.com seed in play, a location's flag set, and the
// whole decoded. What every game's specs share is in autotrack/fixtures.ts.

import { bus } from "@alltp/autotrack";
import {
  ART_ROM,
  AUX_ROWS,
  CHECK_FLAGS,
  GUARD,
  MAIN_ROWS,
  MEMORY_RANGE,
  type MemoryRangeId,
  SHEETS,
} from "@alltp/pack-alttpr";
import { readMemory } from "@/games/alttpr/autotrack/reading";

// The console's memory in the FX Pak Pro space the bridges take: ROM from
// $00_0000 (LoROM, headerless), WRAM from $F5_0000.
const ROM_HEADER = 0x00_7fc0;
const RACE_FLAG = 0x18_0213;
const WRAM = 0xf5_0000;
export const SAVE = (offset: number) => WRAM + 0xf000 + offset;
/** The game mode's byte ($7E:0010): $01 the file select, $07 a dungeon. */
export const GAME_MODE = WRAM + 0x10;

/**
 * A 16 MiB memory image with an alttpr.com seed in play on the overworld: a
 * few items, Link's House and Eastern Palace's compass chest checked, the
 * Armos Knights beaten.
 * @param race - A race seed (its race flag set) or an open one
 * @param name - The seed's name in the header, after "VT "
 */
export const seedMemory = ({
  name,
  race,
}: {
  name?: string;
  race: boolean;
}) => {
  const memory = new Uint8Array(0x100_0000);
  const title = `VT ${name ?? (race ? "RACE" : "OPEN")}`.padEnd(21, " ");
  for (let i = 0; i < title.length; i++) {
    memory[ROM_HEADER + i] = title.charCodeAt(i);
  }
  // The flag and its complement (vt app/Rom.php:908-920)
  memory.set(race ? [0x01, 0x00] : [0x00, 0x01], RACE_FLAG);
  memory[WRAM + 0x10] = 0x09; // game mode: the overworld
  memory[SAVE(0x342)] = 0x01; // Hookshot
  memory[SAVE(0x359)] = 0x02; // Master Sword
  memory[SAVE(0x35c)] = 0x02; // one empty bottle
  memory[SAVE(0x374)] = 0x04; // the Pendant of Courage
  memory[SAVE(0x3c5)] = 0x02; // Zelda rescued
  memory[SAVE(0x208)] = 0x10; // Link's House chest (room $104)
  memory[SAVE(0x150)] = 0x10; // Eastern Palace's compass chest (room $A8)
  memory[SAVE(0x191)] = 0x08; // Armos Knights (room $C8, its boss bit)
  return memory;
};

/**
 * Write a real seed's prize tables into a memory image: alttpr.com's
 * 2v7g66Dpvq (Standard, maps and compasses wild), as its patch writes them.
 * Eastern Palace holds the Pendant of Wisdom, Desert Palace crystal 1, Tower of
 * Hera the Pendant of Courage, Palace of Darkness the Pendant of Power, Swamp
 * Palace crystal 5, Skull Woods crystal 3, Thieves' Town crystal 4, Ice
 * Palace crystal 6, Misery Mire crystal 7, Turtle Rock crystal 2.
 * @param memory - A memory image, as `seedMemory` makes
 * @param mapMode - $01 (the seed's): the world map shows a prize once its
 * dungeon's map is held; $00: always
 */
export const writePrizeTables = (memory: Uint8Array, mapMode = 0x01) => {
  memory.set(
    [0x01, 0x02, 0x00, 0x04, 0x02, 0x08, 0x40, 0x01, 0x04, 0x20, 0x10],
    MEMORY_RANGE["prize-bits"].address,
  );
  memory.set(
    [0x00, 0x40, 0x00, 0x40, 0x00, 0x40, 0x40, 0x40, 0x00, 0x40, 0x40],
    MEMORY_RANGE["prize-kinds"].address,
  );
  memory[MEMORY_RANGE["map-mode"].address] = mapMode;
  return memory;
};

/**
 * Write a seed's pad medallions into a memory image (Misery Mire's, then
 * Turtle Rock's: $00 Bombos, $01 Ether, $02 Quake), with the prize table
 * every seed's ROM holds beside it, which tells a served ROM from a zeroed
 * one.
 * @param memory - A memory image, as `seedMemory` makes
 */
export const writeMedallions = (
  memory: Uint8Array,
  mire: number,
  turtleRock: number,
) => {
  writePrizeTables(memory);
  memory.set([mire, turtleRock], MEMORY_RANGE.medallions.address);
  return memory;
};

/**
 * Put Link on an overworld screen: the game mode is the overworld's, and
 * OverworldIndex the screen ($70 Misery Mire's, $47 Turtle Rock's).
 */
export const standOn = (memory: Uint8Array, screen: number, mode = 0x09) => {
  memory[GAME_MODE] = mode;
  memory[MEMORY_RANGE["overworld-screen"].address] = screen;
  return memory;
};

/** Set the bit that says a screen's entrance was opened ($20 of its event byte). */
export const openEntrance = (memory: Uint8Array, screen: number) => {
  memory[MEMORY_RANGE.overworld.address + screen] |= 0x20;
  return memory;
};

/** Where a range's byte at A-bus address `at` lies in a memory image. */
const imageAddress = (range: MemoryRangeId, at: number) =>
  MEMORY_RANGE[range].address + (at - MEMORY_RANGE[range].bus);

/**
 * Set the flag that says a location was checked, in a memory image.
 * @param memory - A memory image, as `seedMemory` makes
 * @param location - The pack's location id
 */
export const checkIn = (memory: Uint8Array, location: string) => {
  const entry = CHECK_FLAGS.find(({ id }) => id === location);
  if (entry === undefined) throw new RangeError(`No flag for ${location}`);
  const { flag } = entry;
  const at = imageAddress(flag.range, flag.at);
  if ("atLeast" in flag) {
    memory[at] = Math.max(memory[at], flag.atLeast);
    return;
  }
  memory[at] |= flag.mask & 0xff;
  if (flag.size === 2) memory[at + 1] |= flag.mask >> 8;
};

/**
 * A memory image decoded as the session decodes its snapshot.
 * @param memory - A memory image, as `seedMemory` makes
 * @param options - Race Mode, and the ranges not read yet
 */
export const readingOf = (
  memory: Uint8Array,
  {
    race = false,
    unread = [],
  }: { race?: boolean; unread?: readonly MemoryRangeId[] } = {},
) =>
  readMemory(
    {
      bytes: (id) => {
        const { address, size } = MEMORY_RANGE[id as MemoryRangeId];
        return memory.subarray(address, address + size);
      },
      has: (id) => !unread.includes(id as MemoryRangeId),
    },
    race,
    Date.UTC(2026, 9, 16, 20, 15),
  );

/** The ranges of a recorded dark room, by id, as bytes (packs/alttpr/test/dark-room/). */
export type DarkRoomRecording = {
  readonly ranges: Readonly<Record<string, string>>;
};

/**
 * Put a recorded dark room into a memory image: Link in it, the room dark,
 * the map and the Lamp as the recording held them (none, in Link's House).
 * @param memory - A memory image, as `seedMemory` makes
 * @param recording - packs/alttpr/test/dark-room/links-house.json
 */
export const putDarkRoom = (
  memory: Uint8Array,
  recording: DarkRoomRecording,
) => {
  for (const [id, text] of Object.entries(recording.ranges)) {
    const { address } = MEMORY_RANGE[id as MemoryRangeId];
    for (let i = 0; i < text.length; i += 2) {
      memory[address + i / 2] = Number.parseInt(text.slice(i, i + 2), 16);
    }
  }
  return memory;
};

/** Where the synthetic sheets lie: sheet `s` at $91:8000 + s * $10. */
const SHEET_AT = (sheet: number) => 0x91_8000 + sheet * 0x10;

/**
 * Lay out what the dark room's picture is drawn from, all synthetic, never a
 * byte of the game's: the base patch's guard and tables in ROM, every sheet a
 * fill of $AA (stripes of colour 7, 15 in a high sheet), every blockset the
 * same eight sheets; in WRAM, a palette (colour 15 gold, sprites' colour 1
 * white), a BG2 tilemap naming tile 0 everywhere, and one 16 x 16 sprite of
 * Link's at screen (100, 80), drawn from a body piece of ROM.
 * @param memory - A memory image holding a dark room (`putDarkRoom`)
 */
export const putDarkRoomArt = (memory: Uint8Array) => {
  const put = (busAddress: number, bytes: ArrayLike<number>) =>
    memory.set(bytes, bus(busAddress));
  put(ART_ROM.guard, GUARD);
  const pointers = new Uint8Array(SHEETS * 3);
  for (let s = 0; s < SHEETS; s++) {
    const address = SHEET_AT(s);
    pointers[s] = address >> 16;
    pointers[SHEETS + s] = (address >> 8) & 0xff;
    pointers[2 * SHEETS + s] = address & 0xff;
    // 0x400 then 0x200 bytes of $AA, then the end
    put(address, [0xe7, 0xff, 0xaa, 0xe5, 0xff, 0xaa, 0xff]);
  }
  put(ART_ROM.sheetPointers, pointers);
  const main = new Uint8Array(MAIN_ROWS * 8);
  for (let row = 0; row < MAIN_ROWS; row++) {
    main.set([1, 2, 3, 4, 5, 6, 7, 8], row * 8);
  }
  put(ART_ROM.mainTilesets, main);
  put(ART_ROM.auxTilesets, new Uint8Array(AUX_ROWS * 4));
  const palette = new Uint8Array(0x200);
  palette.set([0x3f, 0x03], 2 * 15); // gold
  palette.set([0xff, 0x7f], 2 * (128 + 7 * 16 + 1)); // white
  memory.set(palette, MEMORY_RANGE["dark-room-art-palette"].address);
  // OAM: every sprite hidden, but one 16 x 16 of tile 0 in palette 7
  const oam = new Uint8Array(0x220);
  for (let i = 0; i < 128; i++) oam[i * 4 + 1] = 0xf0;
  oam.set([100, 80, 0x00, 7 << 1], 0);
  oam[0x200] = 0b10;
  const sprites = MEMORY_RANGE["dark-room-art-sprites"].address;
  memory.set(oam, sprites);
  // Its four tiles: 0 and 1 from body piece 3 ($0ACC), 16 and 17 from body
  // piece 0 ($0ACE), both at $10:8000, a tile of colour 1
  memory.set([0x00, 0x80], sprites + (0x0acc - 0x0800));
  memory.set([0x00, 0x80], sprites + (0x0ace - 0x0800));
  // The sprite bank, $BC; BG2's scroll ($E2, $E8) puts the sprite on Link's
  // footprint in the recorded Link's House (tiles 40-41 by 44-45): its top left at
  // (100 + 220, 80 + 1 + 263) = (320, 344)
  const view = MEMORY_RANGE["dark-room-art-view"].address;
  memory[view + (0xbc - 0xa2)] = 0x10;
  memory.set([220, 0], view + (0xe2 - 0xa2));
  memory.set([263 & 0xff, 263 >> 8], view + (0xe8 - 0xa2));
  put(
    0x10_8000,
    Array.from({ length: 0x40 }, (_, i) =>
      i % 32 < 16 && i % 2 === 0 ? 0xff : 0,
    ),
  );
  return memory;
};
