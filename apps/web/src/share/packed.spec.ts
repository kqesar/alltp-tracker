import { describe, expect, it } from "vitest";
import {
  ByteReader,
  ByteWriter,
  fromBase64Url,
  isCount,
  isSigned,
  MAX_FIELD_NUMBER,
  toBase64Url,
  zigzag,
} from "@/share/bytes";
import {
  bitsetField,
  digestOf,
  LINK_FORMAT,
  LINK_VERSION,
  OTHER_VERSION,
  type PackCodec,
  packRun,
  unpackRun,
} from "@/share/packed";

const MALFORMED = "This link does not hold a tracker run.";
const PLACES = ["a/one", "a/two", "b/one", "b/two", "b/three"];

/** A codec over a table of places, the checked ones kept as `form`. */
const codecOver = (
  places: readonly string[],
  form: "list" | "record" = "list",
): PackCodec => ({
  at: ([prefix]) => ({
    digested: [prefix],
    fields: { checked: bitsetField(prefix, form) },
  }),
  game: "smz3",
  legacySizes: [PLACES.length],
  tables: [places],
});

/** A codec over five places, the checked ones as a list. */
const codec = codecOver(PLACES);

const save = (checked: unknown) =>
  JSON.stringify({
    format: "alltp-tracker-save",
    game: "smz3",
    progress: { checked, other: 1 },
    version: 1,
  });

/** The link's JSON with `change` applied to it, as a hostile link would. */
const tampered = (
  link: string,
  change: (file: Record<string, unknown>) => void,
) => {
  const file = JSON.parse(link);
  change(file);
  return JSON.stringify(file);
};

describe("bytes", () => {
  it("round-trips varints from one byte to an epoch", () => {
    const numbers = [0, 1, 127, 128, 300, 2 ** 31, 1_760_000_000_000, 2 ** 50];
    const out = new ByteWriter();
    for (const number of numbers) out.uint(number);
    for (const number of [0, -1, 1, -64, 2 ** 40, -(2 ** 50)]) out.int(number);

    const read = new ByteReader(out.done());
    for (const number of numbers) expect(read.uint()).toBe(number);
    for (const number of [0, -1, 1, -64, 2 ** 40, -(2 ** 50)]) {
      expect(read.int()).toBe(number);
    }
    expect(read.done).toBe(true);
  });

  it("writes small numbers small", () => {
    expect(new ByteWriter().done()).toHaveLength(0);
    const out = new ByteWriter();
    out.uint(127);
    out.int(-3);
    expect([...out.done()]).toEqual([127, zigzag(-3)]);
  });

  it("reads null where the bytes are not a number", () => {
    // Ends mid-number
    expect(new ByteReader(Uint8Array.of(0x80)).uint()).toBeNull();
    expect(new ByteReader(new Uint8Array()).int()).toBeNull();
    // Longer than any number a writer writes
    expect(new ByteReader(new Uint8Array(9).fill(0x80)).uint()).toBeNull();
    // Shorter than the longest, but beyond what a field holds
    expect(new ByteReader(new Uint8Array(8).fill(0xff)).uint()).toBeNull();
  });

  it("accepts only the whole numbers a varint holds", () => {
    expect(isCount(MAX_FIELD_NUMBER)).toBe(true);
    for (const value of [
      -1,
      1.5,
      MAX_FIELD_NUMBER + 1,
      "1",
      null,
      Number.NaN,
    ]) {
      expect(isCount(value)).toBe(false);
    }
    expect(isSigned(-MAX_FIELD_NUMBER)).toBe(true);
    expect(isSigned(-MAX_FIELD_NUMBER - 1)).toBe(false);
    expect(isSigned(0.5)).toBe(false);
  });

  it("round-trips base64url", () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 37) % 256);

    const text = toBase64Url(bytes);

    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect([...fromBase64Url(text)]).toEqual([...bytes]);
  });
});

describe("a packed link", () => {
  it("holds the ids checked as bits, and everything else as it was", () => {
    const link = packRun(save(["b/one", "a/two"]), codec);

    const file = JSON.parse(link);
    expect(file.format).toBe(LINK_FORMAT);
    expect(file.link).toBe(LINK_VERSION);
    expect(file.table).toBe(digestOf(codec.tables));
    expect(file.sizes).toEqual([5]);
    expect(file.progress.checked).toBe(toBase64Url(Uint8Array.of(0b00000110)));
    expect(file.progress.other).toBe(1);
  });

  it("reads back the save it came from, the ids in the table's order", () => {
    const link = packRun(save(["b/one", "a/two"]), codec);

    const unpacked = unpackRun(link, codec);

    expect(unpacked.ok && JSON.parse(unpacked.save)).toEqual({
      format: "alltp-tracker-save",
      game: "smz3",
      progress: { checked: ["a/two", "b/one"], other: 1 },
      version: 1,
    });
  });

  it("holds an empty field, and a run that has none", () => {
    for (const checked of [[], undefined]) {
      const unpacked = unpackRun(packRun(save(checked), codec), codec);

      expect(unpacked.ok).toBe(true);
    }
  });

  it("leaves a save the codec cannot read exactly as it is", () => {
    for (const checked of [["a/one", "a/one"], ["not/a/place"], "a/one", [1]]) {
      expect(packRun(save(checked), codec)).toBe(save(checked));
    }
    const other = JSON.stringify({ format: "other", game: "smz3" });
    expect(packRun(other, codec)).toBe(other);
    expect(packRun(JSON.stringify([]), codec)).toBe("[]");
    const sm = save([]).replace("smz3", "sm");
    expect(packRun(sm, codec)).toBe(sm);
  });

  it("lets a plain save through for the game's own import to read", () => {
    for (const text of [save(["a/one"]), "not json", "[1]", "null"]) {
      expect(unpackRun(text, codec)).toEqual({ ok: true, save: text });
    }
  });

  it("reads a link made before the tables grew, the places it lacks unchecked", () => {
    const link = packRun(save(["b/one", "a/two"]), codec);
    const grown = codecOver([...PLACES, "c/one", "c/two"]);

    const unpacked = unpackRun(link, grown);

    expect(unpacked.ok && JSON.parse(unpacked.save).progress.checked).toEqual([
      "a/two",
      "b/one",
    ]);
    // And the grown tracker's own link reads back whole, in a bitset of its size
    const own = packRun(save(["c/two", "a/one"]), grown);
    expect(JSON.parse(own).sizes).toEqual([7]);
    const back = unpackRun(own, grown);
    expect(back.ok && JSON.parse(back.save).progress.checked).toEqual([
      "a/one",
      "c/two",
    ]);
  });

  it("refuses a link made against tables that were reordered, cut or changed", () => {
    const link = packRun(save(["a/one"]), codec);

    for (const places of [
      // The same places in another order mean other bits
      [...PLACES].reverse(),
      // A place moved, one put in the middle, one renamed
      [PLACES[1], PLACES[0], ...PLACES.slice(2), "c/one"],
      ["a/one", "a/two", "x/new", ...PLACES.slice(2)],
      [...PLACES.slice(0, 4), "b/renamed"],
      // Cut: the link holds a place the table no longer has
      PLACES.slice(0, 4),
      [],
    ]) {
      expect(unpackRun(link, codecOver(places))).toEqual({
        ok: false,
        reason: OTHER_VERSION,
      });
    }
    expect(
      unpackRun(
        tampered(link, (file) => {
          file.sizes = [6];
        }),
        codec,
      ),
    ).toEqual({ ok: false, reason: OTHER_VERSION });
    expect(
      unpackRun(
        tampered(link, (file) => {
          file.link = LINK_VERSION + 1;
        }),
        codec,
      ),
    ).toEqual({ ok: false, reason: OTHER_VERSION });
  });

  it("reads a link that carries no sizes as the tables the first version had", () => {
    const link = tampered(packRun(save(["b/one"]), codec), (file) => {
      delete file.sizes;
    });

    expect(unpackRun(link, codec).ok).toBe(true);
    // Its digest was of those five places: against a grown table it still reads
    expect(unpackRun(link, codecOver([...PLACES, "c/one"])).ok).toBe(true);
    // Against a table that has since been reordered it does not
    expect(unpackRun(link, codecOver([...PLACES].reverse()))).toEqual({
      ok: false,
      reason: OTHER_VERSION,
    });
  });

  it("refuses sizes that name no tables of this tracker's", () => {
    const link = packRun(save(["a/one"]), codec);

    for (const sizes of [[], [5, 5], [-1], [2.5], ["5"], "5", null]) {
      const unpacked = unpackRun(
        tampered(link, (file) => {
          file.sizes = sizes;
        }),
        codec,
      );
      expect(unpacked.ok).toBe(false);
    }
  });

  it("refuses a bitset of the wrong length, or with a bit past the table", () => {
    const link = packRun(save(["a/one"]), codec);
    const withChecked = (bytes: Uint8Array) =>
      tampered(link, (file) => {
        (file.progress as Record<string, unknown>).checked = toBase64Url(bytes);
      });

    for (const bytes of [
      new Uint8Array(),
      new Uint8Array(2),
      Uint8Array.of(0b00100000),
    ]) {
      expect(unpackRun(withChecked(bytes), codec)).toEqual({
        ok: false,
        reason: MALFORMED,
      });
    }
  });

  it("refuses a field that is not base64url, or not text", () => {
    const link = packRun(save(["a/one"]), codec);

    for (const checked of ["", "no spaces!", 7, null, ["a/one"], "a"]) {
      expect(
        unpackRun(
          tampered(link, (file) => {
            (file.progress as Record<string, unknown>).checked = checked;
          }),
          codec,
        ),
      ).toEqual({ ok: false, reason: MALFORMED });
    }
  });

  it("refuses an envelope that is not a link's, or another game's", () => {
    const link = packRun(save(["a/one"]), codec);

    for (const change of [
      (file: Record<string, unknown>) => {
        file.game = "sm";
      },
      (file: Record<string, unknown>) => {
        delete file.table;
      },
      (file: Record<string, unknown>) => {
        file.progress = [];
      },
      (file: Record<string, unknown>) => {
        file.link = "2";
      },
    ]) {
      expect(unpackRun(tampered(link, change), codec)).toEqual({
        ok: false,
        reason: MALFORMED,
      });
    }
  });

  it("packs a field kept as `{ id: true }` as the list's bits", () => {
    const record = codecOver(PLACES, "record");

    const link = packRun(save({ "a/two": true, "b/one": true }), record);
    const unpacked = unpackRun(link, record);

    expect(unpacked.ok && JSON.parse(unpacked.save).progress.checked).toEqual({
      "a/two": true,
      "b/one": true,
    });
    expect(packRun(save({ "a/one": false }), record)).toBe(
      save({ "a/one": false }),
    );
  });
});
