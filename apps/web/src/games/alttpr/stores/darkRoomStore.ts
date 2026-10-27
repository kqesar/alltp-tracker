import type {
  ArtFailure,
  ArtOutcome,
  DarkRoomReading,
  SpriteImage,
} from "@alltp/pack-alttpr";
import { create } from "zustand";

/** What of a room changes seldom: its tiles, chests, torches. */
export type DarkRoomMap = Omit<DarkRoomReading, "link">;

/** The room drawn in the game's graphics, which changes seldom too. */
export type DarkRoomPicture = {
  readonly room: number;
  /** 512 x 512 pixels, 0xAABBGGRR. */
  readonly background: Uint32Array;
  /** Changes each time the background is drawn again. */
  readonly version: number;
};

/** Where the game's graphics stand: drawn, on their way, or not to be. */
export type ArtState =
  | { readonly status: "none" }
  | { readonly status: "ready" }
  | { readonly status: "unavailable"; readonly reason: ArtFailure };

type DarkRoomState = {
  /** The dark room Link stands in, or null: no room to show. */
  map: DarkRoomMap | null;
  /** Where Link is in it, which changes several times a second. */
  link: DarkRoomReading["link"] | null;
  /** Show a reading, or clear with null. */
  show: (reading: DarkRoomReading | null) => void;
  /** The room in the game's graphics, or null: none drawn (the plan shows). */
  picture: DarkRoomPicture | null;
  /** Link as the game draws him, which changes several times a second. */
  sprite: SpriteImage | null;
  art: ArtState;
  /** Show what the loader drew, or clear with null. */
  showArt: (outcome: ArtOutcome | null) => void;
};

const NO_ART: ArtState = { status: "none" };

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
  art: NO_ART,
  link: null,
  map: null,
  picture: null,
  show: (reading) => {
    if (reading === null) {
      // No room: no picture of it either
      const { art, link, map, picture } = get();
      if (map !== null || link !== null || picture !== null || art !== NO_ART) {
        set({
          art: NO_ART,
          link: null,
          map: null,
          picture: null,
          sprite: null,
        });
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
      before.link.y === link.y &&
      before.link.facing === link.facing &&
      before.link.charge === link.charge;
    if (same && sameLink) return;
    set({
      link: sameLink ? before.link : link,
      map: same ? kept : rest,
    });
  },
  showArt: (outcome) => {
    const before = get();
    if (outcome === null) {
      if (before.art !== NO_ART || before.picture !== null) {
        set({ art: NO_ART, picture: null, sprite: null });
      }
      return;
    }
    if (outcome.status === "unavailable") {
      if (
        before.art.status !== "unavailable" ||
        before.art.reason !== outcome.reason
      ) {
        set({ art: outcome, picture: null, sprite: null });
      }
      return;
    }
    const { background, link, room, version } = outcome.art;
    const kept = before.picture;
    const samePicture =
      kept !== null && kept.room === room && kept.version === version;
    const sprite = before.sprite;
    const sameSprite =
      sprite === link ||
      (sprite !== null &&
        link !== null &&
        sprite.x === link.x &&
        sprite.y === link.y &&
        sprite.width === link.width &&
        sprite.height === link.height &&
        sprite.pixels.every((value, i) => value === link.pixels[i]));
    if (samePicture && sameSprite && before.art.status === "ready") return;
    set({
      art: before.art.status === "ready" ? before.art : { status: "ready" },
      picture: samePicture ? kept : { background, room, version },
      sprite: sameSprite ? sprite : link,
    });
  },
  sprite: null,
}));
