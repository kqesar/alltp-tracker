// The dungeon prizes the game shows the player, outside Race Mode: a
// dungeon's prize is told as soon as the player could know it in game, never
// earlier.
//
// The ROM names every dungeon's prize: the bit it sets in the pendants' or
// the crystals' field (CrystalPendantFlags, $02:A09D, the memory map's
// `prize-bits`) and whether it is a pendant or a crystal
// (CrystalPendantFlags_2, $30:8052, `prize-kinds`), one byte per dungeon in
// the order DungeonID / 2 - 2 (newitems.asm:1141-1157): Eastern Palace,
// Desert Palace, Castle Tower (no prize), Swamp Palace, Palace of Darkness,
// Misery Mire, Skull Woods, Ice Palace, Tower of Hera, Thieves' Town, Turtle
// Rock. vt writes both for every world (the Standard dungeons' Prize
// locations, which Open, Inverted and Retro reuse: World/Open.php:32-50,
// World/Inverted.php:33-51, whose dungeons extend Standard's without new
// prize locations; Location.php:271-278 writes each item byte at its
// address), and so does the entrance randomizer vt hands shuffled entrances
// to (er Regions.py:624-633, Rom.py:473-476, Items.py:64-76: the same
// addresses and bytes). Checked against four alttpr.com seeds' spoilers
// (two Open, Standard with mc, Inverted with full; test/prize-tables.json):
// every prize matched.
//
// The game shows a prize in two ways, and the decoder follows them:
// - its dungeon is finished: the prize was taken (DungeonsCompleted);
// - the world map draws it (overworldmap.asm:59-87, 122-141): in the world
//   Link is in, for that world's dungeons (Eastern Palace, Desert Palace and
//   Tower of Hera in the Light World, the seven others in the Dark World),
//   and either always (MapMode $00, vt's default) or once the dungeon's map
//   is held or revealed (MapMode $01: dungeon items mc, mcs and full, and
//   Crosskeys; MapField or MapOverlay, which Sahasrahla and the Bomb
//   Merchant fill). The map draws no icon for a finished dungeon, whose
//   prize is told anyway.
// What the reading keeps is only those prizes: the others never leave the
// decoder. Race Mode reads none of these ranges (their category, `prizes`,
// is one no race permits), and the decoder asks for none then.

import { PRIZES, type Prize } from "../tracker";
import type { MemoryView, Unsettled } from "./decode";
import {
  CRYSTAL_BITS,
  DUNGEON,
  type DungeonCode,
  MEMORY_RANGE,
  type MemoryRangeId,
  PENDANT_BITS,
} from "./memory";

/** The ten dungeons with a prize, by the memory map's codes. */
export type PrizeDungeon = Exclude<DungeonCode, "H2" | "A1" | "A2">;

/** The prizes the game shows, by dungeon; or why none is known. */
export type PrizeReading =
  | Readonly<Partial<Record<PrizeDungeon, Prize>>>
  | Unsettled;

/** The ROM tables' order, from Eastern Palace; null for Castle Tower. */
const TABLE_ORDER: readonly (PrizeDungeon | null)[] = [
  "P1",
  "P2",
  null,
  "D2",
  "D1",
  "D6",
  "D3",
  "D5",
  "P3",
  "D4",
  "D7",
];

/** The Light World's dungeons; the others lie in the Dark World. */
const LIGHT_WORLD: ReadonlySet<PrizeDungeon> = new Set(["P1", "P2", "P3"]);

/** CurrentWorld's Dark World bit (sram.asm:206, overworldmap.asm:75). */
const DARK_WORLD = 0x40;

/**
 * The bits of MapField and MapOverlay that show every prize of the Light
 * World or the Dark World (overworldmap.asm:127-129). Nothing in v31 sets
 * them (sram.asm:120-122: MapField's low byte leaves them unused, vt's reveals are a
 * dungeon's bit), but the map honours them, and so does the decoder.
 */
const WHOLE_WORLD = { dark: 0x02, light: 0x01 } as const;

/** CrystalPendantFlags_2's values: $00 a pendant, $40 a crystal (tables.asm:229-230). */
const KINDS: Readonly<Record<number, Readonly<Record<string, number>>>> = {
  0: PENDANT_BITS,
  64: CRYSTAL_BITS,
};

const PRIZE_CLASSES = Object.keys(PRIZES) as Prize[];

/**
 * The prize class of a table's bytes: the item whose bit it is in its
 * kind's field, and that item's class. Null for bytes vt never writes.
 */
export function prizeClass(bit: number, kind: number): Prize | null {
  const bits = KINDS[kind];
  if (bits === undefined) return null;
  const item = Object.keys(bits).find((name) => bits[name] === bit);
  if (item === undefined) return null;
  return (
    PRIZE_CLASSES.find((prize) =>
      (PRIZES[prize] as readonly string[]).includes(item),
    ) ?? null
  );
}

/** A range's bytes, or null when not read. */
function bytesOf(memory: MemoryView, id: MemoryRangeId): Uint8Array | null {
  if (!memory.has(id)) return null;
  const bytes = memory.bytes(id);
  return bytes.length < MEMORY_RANGE[id].size ? null : bytes;
}

/** A range's first word (or byte, for a one-byte range), or null. */
function numberOf(memory: MemoryView, id: MemoryRangeId): number | null {
  const bytes = bytesOf(memory, id);
  if (bytes === null) return null;
  return bytes.length > 1 ? bytes[0] | (bytes[1] << 8) : bytes[0];
}

/**
 * The prizes the game shows the player, from its ROM and save data. Pure
 * and total. In Race Mode it reads nothing and tells nothing ("race-mode").
 * Without the ROM's two prize tables ("not-read": not read yet, or a
 * device that serves no ROM) it tells nothing either. A condition whose
 * range is not read is taken as not met: the decoder never shows a prize
 * the game may not.
 * @param memory - The ranges read, by id: the session's snapshot
 */
export function decodePrizes(
  memory: MemoryView,
  options: { readonly race: boolean },
): PrizeReading {
  if (options.race) return "race-mode";
  const bits = bytesOf(memory, "prize-bits");
  const kinds = bytesOf(memory, "prize-kinds");
  if (bits === null || kinds === null) return "not-read";
  const completed = numberOf(memory, "dungeons-completed") ?? 0;
  const mapMode = numberOf(memory, "map-mode");
  const world = numberOf(memory, "current-world");
  const maps =
    (numberOf(memory, "maps") ?? 0) | (numberOf(memory, "map-overlay") ?? 0);
  const dark = world === null ? null : (world & DARK_WORLD) !== 0;
  const whole = dark ? WHOLE_WORLD.dark : WHOLE_WORLD.light;
  const shown: Partial<Record<PrizeDungeon, Prize>> = {};
  TABLE_ORDER.forEach((code, index) => {
    if (code === null) return;
    const prize = prizeClass(bits[index], kinds[index]);
    if (prize === null) return;
    const { bit } = DUNGEON[code];
    const onMap =
      dark !== null &&
      dark !== LIGHT_WORLD.has(code) &&
      mapMode !== null &&
      (mapMode === 0x00 || (maps & (bit | whole)) !== 0);
    if ((completed & bit) !== 0 || onMap) shown[code] = prize;
  });
  return shown;
}
