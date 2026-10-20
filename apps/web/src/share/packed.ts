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
// refused instead of read.

import * as z from "zod/mini";
import type { GameId } from "@/games/registry";
import { BASE64URL, fromBase64Url, toBase64Url } from "@/share/bytes";

/** What a packed link's JSON is, in place of a save's. */
export const LINK_FORMAT = "alltp-tracker-link";

/** What a save file's JSON is (every game's export). */
export const SAVE_FORMAT = "alltp-tracker-save";

/** The packed layout's version; a link of another one is another tracker's. */
export const LINK_VERSION = 2;

/** Shown for a link written against other tables, or by a newer packing. */
export const OTHER_VERSION =
  "This link comes from another version of the tracker.";

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
  /** The fields over `tables`, or over a prefix of each: an older link's. */
  readonly at: (tables: Tables) => Layout;
}

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
  const layout = codec.at(codec.tables);
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
    link: LINK_VERSION,
    progress,
    sizes: codec.tables.map((table) => table.length),
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
 * The tables as a link was made against them, or null when this version
 * cannot have them: a link of a newer tracker, whose tables are longer, or
 * one that names another number of tables.
 */
const prefixes = (codec: PackCodec, sizes: readonly number[]): Tables | null =>
  sizes.length === codec.tables.length &&
  sizes.every(
    (size, at) =>
      Number.isInteger(size) && size >= 0 && size <= codec.tables[at].length,
  )
    ? codec.tables.map((table, at) => table.slice(0, sizes[at]))
    : null;

/** A link read back: the save it stands for, or why it cannot be one. */
export type Unpacked =
  | { ok: true; save: string }
  | { ok: false; reason: string };

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
  const made = prefixes(codec, sizes ?? codec.legacySizes);
  const layout = made && codec.at(made);
  if (
    version !== LINK_VERSION ||
    layout === null ||
    table !== digestOf(layout.digested)
  ) {
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
