// Gathers what the dark room's picture is drawn from and draws it: the
// `dark-room-art-…` ranges the poller reads, and the ROM's tables, sheets and
// the graphics Link is drawn from, which only the game's own pointers locate
// and which the loader asks for as on-demand reads (category `navigation`,
// which no race permits: the session refuses them in Race Mode).
//
// Held in memory only, per session: the ROM's tables and sheets once per ROM
// (its header tells one ROM from another), Link's body pieces once per ROM,
// his WRAM pieces and the animated frame once per room. Nothing is stored,
// and nothing here goes anywhere but back to the caller.

import { bus } from "@alltp/autotrack";
import {
  ANIMATED_BYTES,
  ART_ROM,
  type ArtTables,
  AUX_ROWS,
  backgroundTiles,
  decompress,
  GFX_BASE,
  GUARD,
  LINK_UPLOADS,
  linkTiles,
  MAIN_ROWS,
  paletteColours,
  renderBackground,
  renderLink,
  SHEET_BYTES,
  SHEET_WINDOW,
  SHEETS,
  type SpriteImage,
  sheetAddress,
  sheetSlots,
  uploadSource,
} from "./dark-room-art";
import { backgroundWanted } from "./dark-room-gate";
import type { MemoryView } from "./decode";

/** Reads FX Pak Pro ranges on demand: the session's `request`, bound. */
export type ArtRead = (
  ranges: readonly { readonly address: number; readonly size: number }[],
) => Promise<Uint8Array[]>;

/** The room's picture and Link in it. */
export interface DarkRoomArt {
  /** The room's id, as `DarkRoomReading.room`. */
  readonly room: number;
  /** The room drawn lit, 512 x 512 pixels, 0xAABBGGRR. */
  readonly background: Uint32Array;
  /** Changes each time `background` is drawn again. */
  readonly version: number;
  /** Link as the game draws him, or null when no sprite of his is on screen. */
  readonly link: SpriteImage | null;
}

/** What the loader concludes from one update. */
export type ArtOutcome =
  | { readonly status: "ready"; readonly art: DarkRoomArt }
  /** Not drawn: the plan is shown instead, with why. */
  | { readonly status: "unavailable"; readonly reason: ArtFailure };

export type ArtFailure =
  /** The ROM's code at the tables' reader is not the one expected. */
  | "other-base-patch"
  /** A blockset or a sheet the tables do not hold, or that does not unpack. */
  | "unknown-graphics"
  /** A read failed: the next update past the pause tries again. */
  | "read-failed";

/** The ranges the picture needs read before anything is drawn. */
const NEEDED = [
  "dark-room-art-screens",
  "dark-room-art-sprites",
  "dark-room-art-view",
  "dark-room-art-palette",
  "dark-room-art-bg2",
  "dark-room-room",
] as const;

/** Where `dark-room-art-view` ($7E:00A2) holds the sprite bank and BG2's scroll. */
const VIEW = { bank: 0xbc - 0xa2, scrollX: 0xe2 - 0xa2, scrollY: 0xe8 - 0xa2 };

/** How long a failed read keeps the loader from asking again. */
export const ART_RETRY_MS = 5000;

const pak = (address: number) => bus(address);

const sameBytes = (a: Uint8Array | null, b: Uint8Array | null) => {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const hexOf = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * A loader for one session: `update` draws the room from the memory as the
 * poll left it, reading on demand what it has not cached. Calls are to be
 * made one at a time (the runtime waits for each); `now` is the clock the
 * retry pause is measured on.
 */
export function createArtLoader(read: ArtRead, now: () => number = Date.now) {
  let romKey: string | null = null;
  let tables: ArtTables | null | "bad" = null;
  const sheets = new Map<number, Uint8Array>();
  const romPieces = new Map<string, Uint8Array>();
  let wramRoom = -1;
  const wramPieces = new Map<string, Uint8Array>();
  let animated: { key: string; bytes: Uint8Array } | null = null;
  let failedAt = Number.NEGATIVE_INFINITY;
  let drawn: {
    key: string;
    bg2: Uint8Array;
    bg1: Uint8Array | null;
    palette: Uint8Array;
    background: Uint32Array;
    version: number;
  } | null = null;
  let version = 0;

  const fail = (reason: ArtFailure): ArtOutcome => {
    if (reason === "read-failed") failedAt = now();
    return { reason, status: "unavailable" };
  };

  /** The ROM's tables, once per ROM: null when the guard says another patch. */
  const loadTables = async (): Promise<ArtTables | null> => {
    if (tables === "bad") return null;
    if (tables !== null) return tables;
    const [guard, pointers, aux, main] = await read([
      { address: pak(ART_ROM.guard), size: GUARD.length },
      { address: pak(ART_ROM.sheetPointers), size: SHEETS * 3 },
      { address: pak(ART_ROM.auxTilesets), size: AUX_ROWS * 4 },
      { address: pak(ART_ROM.mainTilesets), size: MAIN_ROWS * 8 },
    ]);
    if (!sameBytes(guard, GUARD)) {
      tables = "bad";
      return null;
    }
    tables = { aux, main, pointers };
    return tables;
  };

  return {
    /**
     * Draws the room from `view`. Null while the picture's ranges are not all
     * read (the room just entered, the style just turned on).
     */
    async update(view: MemoryView): Promise<ArtOutcome | null> {
      if (!NEEDED.every((id) => view.has(id))) return null;
      // The snapshot's bytes change under a read: copy what is used
      const copy = (id: string) => view.bytes(id).slice();
      const header = view.has("rom-header")
        ? hexOf(view.bytes("rom-header"))
        : "";
      const room =
        (view.bytes("dark-room-room")[0] |
          (view.bytes("dark-room-room")[1] << 8)) &
        0x1ff;
      const sprites = copy("dark-room-art-sprites");
      const oam = sprites.subarray(0, 0x220);
      const gfx = sprites.subarray(GFX_BASE - 0x0800);
      const at = view.bytes("dark-room-art-view");
      const bank = at[VIEW.bank];
      const scrollX = at[VIEW.scrollX] | (at[VIEW.scrollX + 1] << 8);
      const scrollY = at[VIEW.scrollY] | (at[VIEW.scrollY + 1] << 8);
      const palette = copy("dark-room-art-palette");
      const bg2 = copy("dark-room-art-bg2");
      const bg1 =
        backgroundWanted(view) && view.has("dark-room-art-bg1")
          ? copy("dark-room-art-bg1")
          : null;

      if (header !== romKey) {
        romKey = header;
        tables = null;
        sheets.clear();
        romPieces.clear();
        drawn = null;
      }
      if (tables === "bad") return fail("other-base-patch");
      if (now() - failedAt < ART_RETRY_MS) return fail("read-failed");
      if (room !== wramRoom) {
        wramRoom = room;
        wramPieces.clear();
      }

      try {
        const loaded = await loadTables();
        if (loaded === null) return fail("other-base-patch");
        const main = gfx[0];
        const aux = gfx[1];
        const slots = sheetSlots(loaded, main, aux);
        if (slots === null) return fail("unknown-graphics");

        // What is missing, asked for in one read: sheets, the animated frame,
        // Link's pieces
        const asks: { address: number; size: number }[] = [];
        const landing: ((bytes: Uint8Array) => void)[] = [];
        const ask = (
          address: number,
          size: number,
          land: (b: Uint8Array) => void,
        ) => {
          asks.push({ address: pak(address), size });
          landing.push(land);
        };
        const sheetBad: number[] = [];
        for (const sheet of new Set(slots)) {
          if (sheets.has(sheet)) continue;
          const address = sheetAddress(loaded, sheet);
          if (address === null) {
            sheetBad.push(sheet);
            continue;
          }
          ask(address, SHEET_WINDOW, (bytes) => {
            const unpacked = decompress(bytes);
            if (unpacked === null || unpacked.length < SHEET_BYTES) {
              sheetBad.push(sheet);
            } else sheets.set(sheet, unpacked);
          });
        }
        const animatedSource =
          gfx[0x0adc - GFX_BASE] | (gfx[0x0add - GFX_BASE] << 8);
        const animatedKey = `${room}:${main}:${aux}`;
        if (animated?.key !== animatedKey) {
          ask(0x7e_0000 | animatedSource, ANIMATED_BYTES, (bytes) => {
            animated = { bytes, key: animatedKey };
          });
        }
        const sources = LINK_UPLOADS.map((upload) => {
          const source = uploadSource(upload, gfx, bank);
          return source === null ? null : `${source}:${upload.size}`;
        });
        LINK_UPLOADS.forEach((upload, k) => {
          const key = sources[k];
          if (key === null) return;
          const cache = upload.rom ? romPieces : wramPieces;
          if (cache.has(key)) return;
          const [address] = key.split(":").map(Number);
          ask(address, upload.size, (bytes) => cache.set(key, bytes));
        });
        if (asks.length > 0) {
          const got = await read(asks);
          for (const [k, bytes] of got.entries()) landing[k](bytes);
        }
        if (sheetBad.length > 0) return fail("unknown-graphics");

        const colours = paletteColours(palette);
        const key = `${room}:${main}:${aux}:${animated?.key}`;
        if (
          drawn === null ||
          drawn.key !== key ||
          !sameBytes(drawn.bg2, bg2) ||
          !sameBytes(drawn.bg1, bg1) ||
          !sameBytes(
            drawn.palette.subarray(0, 0x100),
            palette.subarray(0, 0x100),
          )
        ) {
          const tiles = backgroundTiles(
            slots.map((sheet) => sheets.get(sheet) ?? new Uint8Array(0)),
            main,
            animated?.key === animatedKey ? animated.bytes : null,
          );
          version++;
          drawn = {
            background: renderBackground({ bg1, bg2, colours, tiles }),
            bg1,
            bg2,
            key,
            palette,
            version,
          };
        }
        const pieces = LINK_UPLOADS.map((upload, k) => {
          const pieceKey = sources[k];
          if (pieceKey === null) return null;
          return (upload.rom ? romPieces : wramPieces).get(pieceKey) ?? null;
        });
        const { filled, tiles } = linkTiles(pieces);
        const link = renderLink({
          colours,
          filled,
          oam,
          scrollX,
          scrollY,
          tiles,
        });
        return {
          art: {
            background: drawn.background,
            link,
            room,
            version: drawn.version,
          },
          status: "ready",
        };
      } catch {
        return fail("read-failed");
      }
    },
  };
}
