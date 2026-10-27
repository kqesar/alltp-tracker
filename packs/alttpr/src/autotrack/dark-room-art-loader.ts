// Gathers what the dark room's picture is drawn from and draws it: the
// `dark-room-art-…` ranges the poller reads, and the ROM's tables, sheets and
// the graphics Link is drawn from, which only the game's own pointers locate
// and which the loader asks for as on-demand reads (category `navigation`,
// which no race permits: the session refuses them in Race Mode).
//
// Held in memory only, per session: the ROM's tables and sheets once per ROM
// (its header tells one ROM from another), the sheets that do not unpack too,
// Link's body pieces once per ROM, his WRAM pieces once per room, ROM and
// sword and shield, the animated frame once per room. Nothing is stored, and
// nothing here goes anywhere but back to the caller.

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
  /**
   * Link as the game draws him, or null: no sprite of his on screen, or his
   * graphics not read.
   */
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
  /** A read failed: tried again after a pause that doubles each time. */
  | "read-failed"
  /**
   * Given up on this ROM: its reads failed `ART_MAX_FAILURES` times, or the
   * device cannot serve the picture's memory (the runtime says so).
   */
  | "unreadable";

/** The ranges the picture needs read before anything is drawn. */
export const ART_RANGES = [
  "dark-room-art-screens",
  "dark-room-art-sprites",
  "dark-room-art-view",
  "dark-room-art-palette",
  "dark-room-art-bg2",
  "dark-room-room",
] as const;

/** Where `dark-room-art-view` ($7E:00A2) holds the sprite bank and BG2's scroll. */
const VIEW = { bank: 0xbc - 0xa2, scrollX: 0xe2 - 0xa2, scrollY: 0xe8 - 0xa2 };

/** The sword's and the shield's levels in `equipment-c` ($7E:F359-F35A). */
const ARMS = 0xf359 - 0xf350;

/** The first pause after a failed read; each failure after doubles it. */
export const ART_RETRY_MS = 5000;

/**
 * Failed reads after which the loader gives up on a ROM: over usb2snes a read
 * the device refuses closes the socket, so retrying it for ever would drop and
 * reconnect the whole session again and again.
 */
export const ART_MAX_FAILURES = 4;

const pak = (address: number) => bus(address);

const sameBytes = (a: Uint8Array | null, b: Uint8Array | null) => {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const hexOf = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** A pause that holds reads back after failures, doubling, then gives up. */
function backoff(now: () => number) {
  let failures = 0;
  let until = Number.NEGATIVE_INFINITY;
  return {
    failed() {
      failures++;
      until = now() + ART_RETRY_MS * 2 ** (failures - 1);
    },
    get gaveUp() {
      return failures >= ART_MAX_FAILURES;
    },
    reset() {
      failures = 0;
      until = Number.NEGATIVE_INFINITY;
    },
    succeeded() {
      failures = 0;
    },
    /** Whether reads are held back now. */
    get waiting() {
      return failures > 0 && now() < until;
    },
  };
}

/**
 * A loader for one session: `update` draws the room from the memory as the
 * poll left it, reading on demand what it has not cached. Calls are to be
 * made one at a time (the runtime waits for each); `now` is the clock the
 * pauses are measured on.
 */
export function createArtLoader(read: ArtRead, now: () => number = Date.now) {
  let romKey: string | null = null;
  let tables: ArtTables | null | "bad" = null;
  const sheets = new Map<number, Uint8Array>();
  /** Sheets of this ROM that do not unpack: never asked for again. */
  const badSheets = new Set<number>();
  const romPieces = new Map<string, Uint8Array>();
  let wramKey = "";
  const wramPieces = new Map<string, Uint8Array>();
  let animated: { key: string; bytes: Uint8Array } | null = null;
  /** The room's reads (tables, sheets, the animated frame), and Link's. */
  const roomPause = backoff(now);
  const linkPause = backoff(now);
  let drawn: {
    key: string;
    bg2: Uint8Array;
    bg1: Uint8Array | null;
    palette: Uint8Array;
    background: Uint32Array;
    version: number;
    room: number;
  } | null = null;
  let version = 0;

  const unavailable = (reason: ArtFailure): ArtOutcome => ({
    reason,
    status: "unavailable",
  });

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
      if (!ART_RANGES.every((id) => view.has(id))) return null;
      // The snapshot's bytes change under a read: copy what is used
      const copy = (id: string) => view.bytes(id).slice();
      const header = view.has("rom-header")
        ? hexOf(view.bytes("rom-header"))
        : "";
      const roomBytes = view.bytes("dark-room-room");
      const room = (roomBytes[0] | (roomBytes[1] << 8)) & 0x1ff;
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
      const arms = view.has("equipment-c")
        ? hexOf(view.bytes("equipment-c").subarray(ARMS, ARMS + 2))
        : "";

      // Another ROM: nothing of the last one holds
      if (header !== romKey) {
        romKey = header;
        tables = null;
        sheets.clear();
        badSheets.clear();
        romPieces.clear();
        wramPieces.clear();
        wramKey = "";
        animated = null;
        drawn = null;
        roomPause.reset();
        linkPause.reset();
      }
      if (tables === "bad") return unavailable("other-base-patch");
      if (roomPause.gaveUp) return unavailable("unreadable");
      // Link's WRAM graphics are unpacked into the same buffers whatever the
      // sword and shield: a new one in the room is new bytes at the same place
      const pieceKey = `${room}:${arms}`;
      if (pieceKey !== wramKey) {
        wramKey = pieceKey;
        wramPieces.clear();
      }

      // The room: tables, sheets, the animated frame
      const main = gfx[0];
      const aux = gfx[1];
      const animatedSource =
        gfx[0x0adc - GFX_BASE] | (gfx[0x0add - GFX_BASE] << 8);
      const animatedKey = `${room}:${main}:${aux}`;
      let slots = tables === null ? null : sheetSlots(tables, main, aux);
      const roomReady =
        slots?.every((sheet) => sheets.has(sheet)) === true &&
        animated?.key === animatedKey;
      if (!roomReady) {
        if (roomPause.waiting) return unavailable("read-failed");
        try {
          const loaded = await loadTables();
          if (loaded === null) return unavailable("other-base-patch");
          slots = sheetSlots(loaded, main, aux);
          if (slots === null) return unavailable("unknown-graphics");
          if (slots.some((sheet) => badSheets.has(sheet))) {
            return unavailable("unknown-graphics");
          }
          const asks: { address: number; size: number }[] = [];
          const landing: ((bytes: Uint8Array) => void)[] = [];
          for (const sheet of new Set(slots)) {
            if (sheets.has(sheet)) continue;
            const address = sheetAddress(loaded, sheet);
            if (address === null) {
              badSheets.add(sheet);
              continue;
            }
            asks.push({ address: pak(address), size: SHEET_WINDOW });
            landing.push((bytes) => {
              const unpacked = decompress(bytes);
              if (unpacked === null || unpacked.length < SHEET_BYTES) {
                badSheets.add(sheet);
              } else sheets.set(sheet, unpacked);
            });
          }
          if (animated?.key !== animatedKey) {
            asks.push({
              address: pak(0x7e_0000 | animatedSource),
              size: ANIMATED_BYTES,
            });
            landing.push((bytes) => {
              animated = { bytes, key: animatedKey };
            });
          }
          if (asks.length > 0) {
            const got = await read(asks);
            for (const [k, bytes] of got.entries()) landing[k](bytes);
          }
          roomPause.succeeded();
        } catch {
          roomPause.failed();
          return unavailable(roomPause.gaveUp ? "unreadable" : "read-failed");
        }
        if (slots.some((sheet) => badSheets.has(sheet))) {
          return unavailable("unknown-graphics");
        }
      }
      if (slots === null) return unavailable("unknown-graphics");

      const colours = paletteColours(palette);
      const key = `${room}:${main}:${aux}:${animated?.key}`;
      if (
        drawn === null ||
        drawn.key !== key ||
        !sameBytes(drawn.bg2, bg2) ||
        !sameBytes(drawn.bg1, bg1) ||
        !sameBytes(drawn.palette.subarray(0, 0x100), palette.subarray(0, 0x100))
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
          room,
          version,
        };
      }

      // Link: what his uploads need, read unless his reads are paused; a
      // failure there drops his sprite, never the room
      const sources = LINK_UPLOADS.map((upload) => {
        const source = uploadSource(upload, gfx, bank);
        return source === null ? null : `${source}:${upload.size}`;
      });
      const cacheOf = (k: number) =>
        LINK_UPLOADS[k].rom ? romPieces : wramPieces;
      const missing = sources.flatMap((source, k) =>
        source !== null && !cacheOf(k).has(source) ? [k] : [],
      );
      if (missing.length > 0 && !linkPause.waiting && !linkPause.gaveUp) {
        try {
          const got = await read(
            missing.map((k) => ({
              address: pak(Number((sources[k] ?? "0").split(":")[0])),
              size: LINK_UPLOADS[k].size,
            })),
          );
          for (const [i, bytes] of got.entries()) {
            const k = missing[i];
            cacheOf(k).set(sources[k] ?? "", bytes);
          }
          linkPause.succeeded();
        } catch {
          linkPause.failed();
        }
      }
      const pieces = sources.map((source, k) =>
        source === null ? null : (cacheOf(k).get(source) ?? null),
      );
      // A piece still missing: no sprite rather than half a Link
      const whole = pieces.every(
        (piece, k) => sources[k] === null || piece !== null,
      );
      let link: SpriteImage | null = null;
      if (whole) {
        const { filled, tiles } = linkTiles(pieces);
        link = renderLink({ colours, filled, oam, scrollX, scrollY, tiles });
      }
      return {
        art: {
          background: drawn.background,
          link,
          room,
          version: drawn.version,
        },
        status: "ready",
      };
    },
  };
}
