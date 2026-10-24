// A join link: `?game=archipelago&room=…&slot=…`, which a player shares to
// open the connect dialog with the room and the slot filled in. It never
// connects on its own and never carries the password: a link travels (a chat,
// a browser's history), and with the address and the slot a password is all
// it takes to join the slot.

import { parseAddress } from "@alltp/archipelago";

const ROOM_PARAM = "room";
const SLOT_PARAM = "slot";
/** Never written; dropped unread when a hand-made link carries one. */
const PASSWORD_PARAM = "password";

/** AP caps slot names at 16 characters; a little slack for what it may allow later. */
const SLOT_MAX = 64;

/** What a join link fills in the dialog. */
export type JoinPrefill = { room: string; slot: string };

/**
 * Reads a join link's room and slot: the room as the Room field takes it (an
 * address, a /connect line or an archipelago.gg room link), the slot as typed.
 * Null when the room is missing or unreadable; the slot may be empty.
 * @param search - The query string, `window.location.search` by default
 */
export const readJoinLink = (
  search: string = window.location.search,
): JoinPrefill | null => {
  const params = new URLSearchParams(search);
  const room = params.get(ROOM_PARAM)?.trim() ?? "";
  if (room === "" || !parseAddress(room).ok) return null;
  const slot = params.get(SLOT_PARAM) ?? "";
  return { room, slot: slot.length <= SLOT_MAX ? slot : "" };
};

/**
 * Takes a join link from the address, then drops its parameters (and a
 * password, should a hand-made link carry one) so a reload or a bookmark
 * does not fill the dialog again, as `takeGameFromAddress` does for `game`.
 */
export const takeJoinLink = (): JoinPrefill | null => {
  const address = new URL(window.location.href);
  const prefill = readJoinLink(address.search);
  const params = [ROOM_PARAM, SLOT_PARAM, PASSWORD_PARAM];
  if (!params.some((name) => address.searchParams.has(name))) return prefill;
  for (const name of params) address.searchParams.delete(name);
  window.history.replaceState(
    window.history.state,
    "",
    `${address.pathname}${address.search}${address.hash}`,
  );
  return prefill;
};

/**
 * The join link for a room and a slot, on `base` (the site's address, also
 * from the desktop app): never the password.
 * @param base - The tracker's address, with no query string
 */
export const joinLinkUrl = (base: string, { room, slot }: JoinPrefill) => {
  const url = new URL(base);
  url.search = new URLSearchParams({
    game: "archipelago",
    [ROOM_PARAM]: room.trim(),
    [SLOT_PARAM]: slot,
  }).toString();
  return url.href;
};
