import type { DarkRoomReading } from "@alltp/pack-alttpr";
import { create } from "zustand";

/** What of a room changes seldom: its tiles, chests, torches. */
export type DarkRoomMap = Omit<DarkRoomReading, "link">;

type DarkRoomState = {
  /** The dark room Link stands in, or null: no room to show. */
  map: DarkRoomMap | null;
  /** Where Link is in it, which changes several times a second. */
  link: DarkRoomReading["link"] | null;
  /** Show a reading, or clear with null. */
  show: (reading: DarkRoomReading | null) => void;
};

const sameBytes = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const sameBox = (a: DarkRoomReading["bounds"], b: DarkRoomReading["bounds"]) =>
  a.x0 === b.x0 && a.x1 === b.x1 && a.y0 === b.y0 && a.y1 === b.y1;

const sameChests = (
  a: DarkRoomReading["chests"],
  b: DarkRoomReading["chests"],
) =>
  a.length === b.length &&
  a.every((chest, i) => sameBox(chest, b[i]) && chest.big === b[i].big);

/**
 * The dark room the tracker shows: where Link is and what the room holds,
 * read from the game while it is dark and he has no Lamp. Transient and in
 * memory only: never saved, never in the run, an export, a shared link, live
 * follow, the stream view or the overlay API (a spec holds the modules that
 * do any of those to never import it). It is two slices so that the tiles,
 * which change a few times a minute, are not drawn again as Link walks, which
 * moves several times a second; a reading that changes neither keeps both
 * objects, so nothing that subscribes re-renders.
 */
export const useDarkRoomStore = create<DarkRoomState>()((set, get) => ({
  link: null,
  map: null,
  show: (reading) => {
    if (reading === null) {
      if (get().map !== null || get().link !== null) {
        set({ link: null, map: null });
      }
      return;
    }
    const { link, ...rest } = reading;
    const before = get();
    const kept = before.map;
    const same =
      kept !== null &&
      kept.room === rest.room &&
      kept.layer === rest.layer &&
      sameBytes(kept.raw, rest.raw) &&
      sameBox(kept.bounds, rest.bounds) &&
      sameChests(kept.chests, rest.chests) &&
      kept.torches.total === rest.torches.total &&
      kept.torches.unlit === rest.torches.unlit &&
      // A door or a torch can change what a tile means with its byte the same
      sameBytes(kept.kinds, rest.kinds);
    const sameLink =
      before.link !== null &&
      before.link.x === link.x &&
      before.link.y === link.y;
    if (same && sameLink) return;
    set({
      link: sameLink ? before.link : link,
      map: same ? kept : rest,
    });
  },
}));
