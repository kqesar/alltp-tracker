// When the dark room map is read, and when it is held. Kept apart from the
// memory map (which names them as the ranges' gates) so neither imports the
// other; `dark-room.spec.ts` holds every address here to the memory map's.
//
// $10 = 07 and $11 = 00 is a dungeon in normal play (the main module and its
// submodule: a scroll between rooms or a text box has another submodule),
// $10 = 0E the menu and the text modules, $1B = 1 indoors. $C005 is the room's
// lights-out flag, from its header (zelda3 dungeon.c:3699): the Lamp does not
// change it, it only draws a cone (hud.c:1343-1349). $F34A is the Lamp
// (sram.asm, the equipment).

import type { MemoryView } from "./decode";

/** Where a byte sits: the range that holds it, and its A-bus address. */
interface Place {
  readonly range: string;
  readonly base: number;
  readonly at: number;
}

export const MODE: Place = {
  at: 0x7e_0010,
  base: 0x7e_0010,
  range: "dark-room-mode",
};
export const SUBMODE: Place = {
  at: 0x7e_0011,
  base: 0x7e_0010,
  range: "dark-room-mode",
};
export const INDOORS: Place = {
  at: 0x7e_001b,
  base: 0x7e_001b,
  range: "dark-room-indoors",
};
export const DARK: Place = {
  at: 0x7e_c005,
  base: 0x7e_c005,
  range: "dark-room-dark",
};
/** The Lamp is in the equipment the items are read from. */
export const LAMP: Place = {
  at: 0x7e_f34a,
  base: 0x7e_f344,
  range: "equipment-b",
};

/** A byte of memory, or undefined while its range is unread. */
export function byteAt(view: MemoryView, place: Place): number | undefined {
  if (!view.has(place.range)) return undefined;
  return view.bytes(place.range)[place.at - place.base];
}

/**
 * Whether the game is in a dark room Link has no Lamp in, in a dungeon's
 * normal play or in the menu and text modules over it. What was read of the
 * room is held while this holds, and shown. A byte not read yet answers no.
 */
export function darkRoomHeld(view: MemoryView): boolean {
  const mode = byteAt(view, MODE);
  return (
    (mode === 0x07 || mode === 0x0e) &&
    byteAt(view, INDOORS) === 0x01 &&
    byteAt(view, DARK) === 0x01 &&
    byteAt(view, LAMP) === 0x00
  );
}

/**
 * Whether the room is read now: held, and in normal play ($10 = 07, $11 = 00),
 * where the attribute table is whole and the position is Link's. A menu, a
 * text box or a scroll between rooms is held over, not read.
 */
export function darkRoomWanted(view: MemoryView): boolean {
  return (
    darkRoomHeld(view) &&
    byteAt(view, MODE) === 0x07 &&
    byteAt(view, SUBMODE) === 0x00
  );
}
