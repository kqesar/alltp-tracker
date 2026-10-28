// The packed form of a run's link (format 2). A save spends most of its link
// on text that deflate cannot predict: the ids of the locations checked, the
// instants of a timeline. A game's *codec* swaps those fields for bytes
// indexed by the pack's ordered tables (a bitset, varints), written as
// base64url inside the same JSON, which deflate then carries at about the
// size of the bytes. The link names the sizes of the tables it was indexed
// by and a digest of their contents: the tables only ever grow at the end, so
// a link made against a prefix of today's tables still reads (what the link
// does not hold stays as a fresh run has it), while one made against tables
// that were reordered or cut would put its bits on the wrong places, and is
// refused instead of read. It also names its layout version: a codec whose
// bytes changed writes a later one and still reads every one before.

import * as z from "zod/mini";
import type { GameId } from "@/games/registry";
import { BASE64URL, fromBase64Url, toBase64Url } from "@/share/bytes";

/** What a packed link's JSON is, in place of a save's. */
export const LINK_FORMAT = "alltp-tracker-link";

/** What a save file's JSON is (every game's export). */
export const SAVE_FORMAT = "alltp-tracker-save";

/**
 * The packed layout's first version, which every codec reads. A codec that
 * changes a field's bytes writes a later one (`PackCodec.version`) and reads
 * every one from this up; a link of any other is another tracker's.
 */
export const LINK_VERSION = 2;

/** Shown for a link written against other tables than these or their prefixes. */
export const OTHER_VERSION =
  "This link comes from another version of the tracker.";

/**
 * Shown for a link a later tracker wrote: a layout version past this one's,
 * or a table longer than this one's. Reloading the page fetches the latest
 * release, which reads it, so the link's address is kept for it.
 */
export const NEWER_VERSION =
  "This link comes from a newer version of the tracker: reload to update.";

const MALFORMED = "This link does not hold a tracker run.";

/** One field of a run's progress, as bytes. */
export interface FieldCodec {
  /** The field's bytes, or null when the value is not what the tracker writes. */
  pack: (value: unknown) => Uint8Array | null;
  /** The value the bytes stand for, or undefined when they cannot be one's. */
  unpack: (bytes: Uint8Array) => unknown;
}

/** Ordered tables of ids: what a field's indices and bits stand for. */
export type Tables = readonly (readonly string[])[];

/** A codec's fields over some tables, and the tables a digest is made of. */
export interface Layout {
  /** The fields of `progress` that travel as bytes, by name. */
  readonly fields: Readonly<Record<string, FieldCodec>>;
  /**
   * What the link's digest covers: the tables the layout was made over and
   * any table derived from them, which the fields index too.
   */
  readonly digested: Tables;
}

/** How a game's links are packed. */
export interface PackCodec {
  readonly game: GameId;
  /**
   * The ordered tables the fields index (locations, items…), as this version
   * has them. They are append-only: a new entry goes at the end, never in
   * the middle, and none is removed or moved. The link carries their sizes
   * and the digest of their contents, so a link made against a prefix of
   * these still reads, and one made against any other order is refused.
   */
  readonly tables: Tables;
  /**
   * The sizes the tables had when links carried none, which the first
   * version of the packed form did not write.
   */
  readonly legacySizes: readonly number[];
  /**
   * The layout version this codec writes, `LINK_VERSION` when absent: it
   * reads every version from `LINK_VERSION` up to it, and refuses a later
   * one, a newer tracker's.
   */
  readonly version?: number;
  /**
   * The layout version a save is written in, `version` when absent: the
   * earliest whose bytes for it are the latest's, so a tracker that reads
   * only that one still opens the link. Between `LINK_VERSION` and `version`.
   */
  readonly versionFor?: (progress: Record<string, unknown>) => number;
  /**
   * How many of `tables`, from the first, a layout version indexes, all of
   * them when absent: a version that packs another field over a table of its
   * own adds it at the end, and a link of an earlier one names the sizes of
   * the tables it had.
   */
  readonly tablesIn?: (version: number) => number;
  /**
   * The fields over the tables of `version`, or over a prefix of each (an
   * older link's), in the layout of `version`.
   */
  readonly at: (tables: Tables, version: number) => Layout;
}

/** The layout version a codec writes. */
const versionOf = (codec: PackCodec): number => codec.version ?? LINK_VERSION;

/** The tables a layout version of a codec indexes, as this tracker has them. */
const tablesOf = (codec: PackCodec, version: number): Tables =>
  codec.tables.slice(0, codec.tablesIn?.(version) ?? codec.tables.length);

/**
 * A 32-bit FNV-1a of the tables, as six base64url characters. It guards
 * against a mismatch by accident, not by malice: a link opens nothing
 * unchecked anyway, the game's own import validates the run afterwards.
 */
export const digestOf = (tables: Tables): string => {
  const text = JSON.stringify(tables);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return toBase64Url(
    Uint8Array.of(
      hash >>> 24,
      (hash >>> 16) & 255,
      (hash >>> 8) & 255,
      hash & 255,
    ),
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A save written as a packed link: its heavy fields as bytes, the rest as it
 * is. A save that is not what the tracker writes (a field the codec cannot
 * read) comes back unchanged, which opens as a plain link always has.
 * @param save - A game's export (JSON)
 */
export const packRun = (save: string, codec: PackCodec): string => {
  const file: unknown = JSON.parse(save);
  if (!isRecord(file) || file.format !== SAVE_FORMAT) return save;
  if (file.game !== codec.game || !isRecord(file.progress)) return save;
  const version = Math.min(
    versionOf(codec),
    Math.max(
      LINK_VERSION,
      codec.versionFor?.(file.progress) ?? versionOf(codec),
    ),
  );
  const tables = tablesOf(codec, version);
  const layout = codec.at(tables, version);
  const progress: Record<string, unknown> = { ...file.progress };
  for (const [name, field] of Object.entries(layout.fields)) {
    if (!(name in progress)) continue;
    const bytes = field.pack(progress[name]);
    if (bytes === null) return save;
    progress[name] = toBase64Url(bytes);
  }
  return JSON.stringify({
    ...file,
    format: LINK_FORMAT,
    link: version,
    progress,
    sizes: tables.map((table) => table.length),
    table: digestOf(layout.digested),
  });
};

/** What a packed link's JSON must be, before any field is read. */
const linkSchema = z.looseObject({
  format: z.literal(LINK_FORMAT),
  game: z.string(),
  link: z.number(),
  progress: z.record(z.string(), z.unknown()),
  sizes: z.optional(z.array(z.number())),
  table: z.string(),
});

/**
 * The tables as a link was made against them; `"newer"` for a link of a
 * newer tracker, a table of it longer than this one's; null for sizes that
 * are none a tracker writes, another number of tables than its layout
 * indexes among them.
 * @param tables - The tables of the link's layout version, as this tracker has them
 */
const prefixes = (
  tables: Tables,
  sizes: readonly number[],
): Tables | "newer" | null => {
  if (sizes.length !== tables.length) return null;
  if (!sizes.every((size) => Number.isInteger(size) && size >= 0)) return null;
  if (sizes.some((size, at) => size > tables[at].length)) return "newer";
  return tables.map((table, at) => table.slice(0, sizes[at]));
};

/**
 * A link read back: the save it stands for, or why it cannot be one, and
 * whether a newer tracker wrote it (a reload may then open it).
 */
export type Unpacked =
  | { ok: true; save: string }
  | { ok: false; reason: string; newer?: true };

const NEWER = { newer: true, ok: false, reason: NEWER_VERSION } as const;

/**
 * The save a link's text stands for. Text that is not a packed link (a plain
 * link's save, a file, anything else) passes through untouched for the
 * game's own import to read or refuse, so a plain link opens exactly as it
 * did before packing existed.
 */
export const unpackRun = (text: string, codec: PackCodec): Unpacked => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: true, save: text };
  }
  if (!isRecord(parsed) || parsed.format !== LINK_FORMAT) {
    return { ok: true, save: text };
  }
  const link = linkSchema.safeParse(parsed);
  if (!link.success || link.data.game !== codec.game) {
    return { ok: false, reason: MALFORMED };
  }
  const {
    format: _,
    link: version,
    progress,
    sizes,
    table,
    ...rest
  } = link.data;
  if (!Number.isInteger(version) || version < LINK_VERSION) {
    return { ok: false, reason: OTHER_VERSION };
  }
  if (version > versionOf(codec)) return NEWER;
  const made = prefixes(tablesOf(codec, version), sizes ?? codec.legacySizes);
  if (made === "newer") return NEWER;
  const layout = made && codec.at(made, version);
  if (layout === null || table !== digestOf(layout.digested)) {
    return { ok: false, reason: OTHER_VERSION };
  }
  const unpacked: Record<string, unknown> = { ...progress };
  for (const [name, field] of Object.entries(layout.fields)) {
    if (!(name in unpacked)) continue;
    const packed = unpacked[name];
    if (typeof packed !== "string" || !BASE64URL.test(packed)) {
      return { ok: false, reason: MALFORMED };
    }
    let value: unknown;
    try {
      value = field.unpack(fromBase64Url(packed));
    } catch {
      return { ok: false, reason: MALFORMED };
    }
    if (value === undefined) return { ok: false, reason: MALFORMED };
    unpacked[name] = value;
  }
  return {
    ok: true,
    save: JSON.stringify({ ...rest, format: SAVE_FORMAT, progress: unpacked }),
  };
};

/**
 * A field of ids, set or not, as a bitset over an ordered table: bit `i` of
 * byte `i / 8` says whether `ids[i]` is in. A bitset of any other length, or
 * with a bit beyond the table, is refused: it was made against another table.
 * @param form - How the game holds the field: its ids as a list, or as
 *   `{ id: true }`
 */
export const bitsetField = (
  ids: readonly string[],
  form: "list" | "record",
): FieldCodec => {
  const index = new Map(ids.map((id, at) => [id, at]));
  const length = Math.ceil(ids.length / 8);
  return {
    pack: (value) => {
      const present =
        form === "list"
          ? Array.isArray(value) && value.every((id) => typeof id === "string")
            ? (value as string[])
            : null
          : isRecord(value) && Object.values(value).every((on) => on === true)
            ? Object.keys(value)
            : null;
      if (present === null) return null;
      const bits = new Uint8Array(length);
      for (const id of present) {
        const at = index.get(id);
        if (at === undefined) return null;
        bits[at >> 3] |= 1 << (at & 7);
      }
      // A list with a repeated id would come back shorter: keep it as it is
      return new Set(present).size === present.length ? bits : null;
    },
    unpack: (bytes) => {
      if (bytes.length !== length) return undefined;
      const present = ids.filter((_, at) => bytes[at >> 3] & (1 << (at & 7)));
      // Bits past the table's end are never set by a writer
      const set = present.length;
      let count = 0;
      for (const byte of bytes) {
        for (let bit = byte; bit; bit &= bit - 1) count++;
      }
      if (count !== set) return undefined;
      return form === "list"
        ? present
        : Object.fromEntries(present.map((id) => [id, true]));
    },
  };
};
