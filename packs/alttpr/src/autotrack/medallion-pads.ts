// The medallions Misery Mire's and Turtle Rock's entrances ask for, told as
// soon as the player could know them in game, never earlier, and outside
// Race Mode only.
//
// The ROM names both: MireRequiredMedallion ($30:8022) and
// TRockRequiredMedallion ($30:8023), $00 Bombos, $01 Ether, $02 Quake
// (tables.asm:53-62; vt writes the item's second byte there, Region/
// Standard/Medallions.php:30-31, Item.php:108-110, Location.php:271-278).
// Inverted worlds use the same region (World/Inverted.php:53) and the same
// bytes, and the game checks the same screens for both (medallions.asm:6, 25;
// swordswap.asm:175, 181).
//
// The game shows the medallion nowhere but on the dungeon's entrance, as the
// emblem carved there (the base patch swaps the overworld graphics sheet,
// z3r LTTP_RND_GeneralBugfixes.asm:188-206): not on a map, in the HUD or in
// a menu, and no flag records that the player looked. The decoder follows
// that:
// - the overworld screen of the entrance is in view: OverworldIndex ($7E:008A)
//   is $70 for Misery Mire and $47 for Turtle Rock while the game mode is the
//   overworld's ($09), since the index outlives the screen in a cave or a
//   dungeon;
// - or the entrance is open already (bit $20 of the screen's overworld
//   event byte, $7EF280 + the screen), which only the right medallion cast
//   on the pad does (medallions.asm:9, 28).
// The first is a proxy: the emblem is somewhere on the screen, and standing
// on the screen is the nearest the memory gets to seeing it. What the
// reading keeps is only the medallions shown: the others never leave the
// decoder. It holds what is in view now; the board remembers the rest.
//
// Race Mode reads none of these ranges (their category, `other`, is one no
// race permits; the opened bits' range is read for the checks, but the
// decoder asks for nothing then). The spec (v2.0) says "ROM addresses
// associated with entrance locations ... should not ever be accessed".

import { MEDALLIONS, type Medallion, type Pad } from "../medallions";
import type { MemoryView, Unsettled } from "./decode";
import { GAME_MODES, MEMORY_RANGE, type MemoryRangeId } from "./memory";

/** Why the game shows a medallion: its pad's screen is in view, or its entrance is open. */
export type MedallionShownBy = "on-screen" | "opened";

/** A medallion the game shows, and why. */
export interface ShownMedallion {
  readonly medallion: Medallion;
  readonly shownBy: MedallionShownBy;
}

/** The medallions the game shows, by pad; or why none is known. */
export type MedallionReading =
  | Readonly<Partial<Record<Pad, ShownMedallion>>>
  | Unsettled;

/**
 * Each pad's byte in the ROM table (`medallions`), its overworld screen
 * (medallions.asm:6, 25) and the bit of that screen's event byte that says
 * the entrance is open (medallions.asm:9, 28).
 */
const PADS: readonly {
  readonly pad: Pad;
  readonly index: number;
  readonly screen: number;
}[] = [
  { index: 0, pad: "mire", screen: 0x70 },
  { index: 1, pad: "turtleRock", screen: 0x47 },
];

/** An overworld screen's bit for "this entrance is opened" (medallions.asm:9). */
const OPENED = 0x20;

/** What CrystalPendantFlags_2 holds for a crystal's dungeon ($40, tables.asm:229-230). */
const CRYSTAL_KIND = 0x40;

/** A seed's ten dungeons hold seven crystals (vt's pool: three pendants). */
const CRYSTALS = 7;

/** A range's bytes, or null when not read. */
function bytesOf(memory: MemoryView, id: MemoryRangeId): Uint8Array | null {
  if (!memory.has(id)) return null;
  const bytes = memory.bytes(id);
  return bytes.length < MEMORY_RANGE[id].size ? null : bytes;
}

/**
 * Whether bank $30 is the seed's: a device that serves no ROM there fills
 * it with zeros, which would read as Bombos twice. Every seed's prize
 * table (`prize-kinds`) names seven crystals, which zeros and another
 * bank's bytes do not.
 */
function isSeedsTable(kinds: Uint8Array): boolean {
  return kinds.filter((kind) => kind === CRYSTAL_KIND).length === CRYSTALS;
}

/**
 * The medallions the game shows the player, from its ROM and memory. Pure
 * and total. In Race Mode it reads nothing and tells nothing ("race-mode").
 * Without the ROM's table ("not-read": not read yet, or a device that serves
 * no ROM there) it tells nothing either. A condition whose range is not read
 * is taken as not met: the decoder never shows a medallion the game may not.
 * @param memory - The ranges read, by id: the session's snapshot
 */
export function decodeMedallions(
  memory: MemoryView,
  options: { readonly race: boolean },
): MedallionReading {
  if (options.race) return "race-mode";
  const table = bytesOf(memory, "medallions");
  const kinds = bytesOf(memory, "prize-kinds");
  if (table === null || kinds === null || !isSeedsTable(kinds)) {
    return "not-read";
  }
  const mode = bytesOf(memory, "game-mode");
  const screen = bytesOf(memory, "overworld-screen");
  const events = bytesOf(memory, "overworld");
  const inView =
    mode?.[0] === GAME_MODES.overworld && screen !== null ? screen[0] : null;
  const shown: Partial<Record<Pad, ShownMedallion>> = {};
  for (const { index, pad, screen: padScreen } of PADS) {
    const medallion = MEDALLIONS[table[index]];
    if (medallion === undefined) continue;
    const opened =
      events !== null && (events[padScreen] & OPENED) !== 0 ? "opened" : null;
    const shownBy = opened ?? (inView === padScreen ? "on-screen" : null);
    if (shownBy !== null) shown[pad] = { medallion, shownBy };
  }
  return shown;
}
