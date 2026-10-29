// The bosses the game shows the player, outside Race Mode: under boss
// shuffle, a dungeon's boss is told as soon as Link stands in its boss room
// with the boss there, never earlier.
//
// The enemizer writes each dungeon's boss into the ROM (vt Enemizer.php:
// 222-245, ManualBosses), but the tracker never reads that table: it would
// name every boss before the player met one. It reads what is on screen
// instead:
// - the room Link is in, `room` ($7E:00A0, z3 ram.asm:107), one of the ten
//   rooms the base patch knows as boss rooms (heartpieces.asm:345-378,
//   CheckIfBossRoom, which the enemizer leaves where they are: it moves the
//   boss, not the room), in a dungeon (game mode $07);
// - the sprites loaded there: a slot whose state is not 0 (zelda3
//   variables.h:724) holding one of the bosses' sprite types (variables.h:
//   729), named by zelda3's sprite table (sprite_main.c:466-711).
// Ganon's Tower's three bosses fight in rooms CheckIfBossRoom does not list,
// so the decoder tells none of them. A room holding two bosses' sprites, or
// none, tells nothing: it never guesses.
//
// Race Mode reads neither range: `room` is `entrances` and the sprites are
// `navigation`, which no race permits (the race admins' clarification of
// June 2026 bars identifying Link's room). A race leaves the boss to the
// player.

import {
  BOSS_PLACES,
  type BossPlaceId,
  bossPlaceOf,
  type ShuffledBoss,
} from "../bosses";
import type { DungeonId } from "../dungeons";
import type { MemoryView, Unsettled } from "./decode";
import { MEMORY_RANGE, type MemoryRangeId } from "./memory";

/** The boss the game shows, by slot; or why none is known. */
export type BossReading =
  | Readonly<Partial<Record<BossPlaceId, ShuffledBoss>>>
  | Unsettled;

/** Each boss room, by room index (heartpieces.asm:351-360, 366-378). */
export const BOSS_ROOMS: Readonly<Record<number, DungeonId>> = {
  6: "swamp-palace",
  7: "tower-of-hera",
  41: "skull-woods",
  51: "desert-palace",
  90: "palace-of-darkness",
  144: "misery-mire",
  164: "turtle-rock",
  172: "thieves-town",
  200: "eastern-palace",
  222: "ice-palace",
};

/**
 * Each boss's sprite types (zelda3 sprite_main.c: the table's entries are
 * named by type): one for most, Kholdstare's shell beside him, Trinexx's
 * three heads.
 */
export const BOSS_SPRITES: Readonly<Record<number, ShuffledBoss>> = {
  9: "moldorm", // Sprite_09_GiantMoldorm, sprite_main.c:475
  83: "armosKnights", // Sprite_53_ArmosKnight, :550
  84: "lanmolas", // Sprite_54_Lanmolas, :551
  136: "mothula", // Sprite_88_Mothula, :604
  140: "arrghus", // Sprite_8C_Arrghus, :608
  146: "helmasaurKing", // Sprite_92_HelmasaurKing, :614
  162: "kholdstare", // Sprite_A2_Kholdstare, :630
  163: "kholdstare", // Sprite_A3_KholdstareShell, :631
  189: "vitreous", // Sprite_BD_Vitreous, :658
  203: "trinexx", // Sprite_CB_TrinexxRockHead, :672
  204: "trinexx", // Sprite_CC, Trinexx's fire head (Sprite_Sidenexx), :673
  205: "trinexx", // Sprite_CD, its ice head, :674
  206: "blind", // Sprite_CE_Blind, :675
};

/** The game mode of a dungeon (ram.asm:41, GAME_MODES in memory.ts). */
const DUNGEON_MODE = 0x07;

/** The sprite slots, and where the types start in the range. */
const SLOTS = 16;
const TYPES = 0x50;

/** A range's bytes, or null when not read. */
function bytesOf(memory: MemoryView, id: MemoryRangeId): Uint8Array | null {
  if (!memory.has(id)) return null;
  const bytes = memory.bytes(id);
  return bytes.length < MEMORY_RANGE[id].size ? null : bytes;
}

/**
 * The boss the game shows now: Link in a dungeon's boss room with one
 * boss's sprites loaded. Pure and total. In Race Mode it reads nothing
 * ("race-mode"); a range not read tells nothing ("not-read"). The board
 * keeps what was shown: a later reading, out of the room, shows none.
 * @param memory - The ranges read, by id: the session's snapshot
 */
export function decodeBosses(
  memory: MemoryView,
  options: { readonly race: boolean },
): BossReading {
  if (options.race) return "race-mode";
  const mode = bytesOf(memory, "game-mode");
  const room = bytesOf(memory, "room");
  const sprites = bytesOf(memory, "boss-sprites");
  if (mode === null || room === null || sprites === null) return "not-read";
  // The dungeon's mode ($07): a menu over the room keeps it unread
  if (mode[0] !== DUNGEON_MODE) return {};
  const dungeon = BOSS_ROOMS[room[0] | (room[1] << 8)];
  const place = dungeon === undefined ? undefined : bossPlaceOf(dungeon);
  if (place === undefined) return {};
  const seen = new Set<ShuffledBoss>();
  for (let slot = 0; slot < SLOTS; slot++) {
    const boss = BOSS_SPRITES[sprites[TYPES + slot]];
    if (sprites[slot] !== 0 && boss !== undefined) seen.add(boss);
  }
  if (seen.size !== 1) return {};
  const [boss] = seen;
  // A boss its slot cannot hold is no boss a seed puts there
  return BOSS_PLACES[place].refuses.some((refused) => refused === boss)
    ? {}
    : { [place]: boss };
}
