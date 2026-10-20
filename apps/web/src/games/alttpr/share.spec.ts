import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { items as freshItems } from "@/games/alttpr/data/items";
import { packLink, TIMELINE_KEYS, unpackLink } from "@/games/alttpr/share";
import { parseSave } from "@/games/alttpr/stores/persistence";
import { BitWriter, ByteWriter, toBase64Url } from "@/share/bytes";
import { LINK_FORMAT, OTHER_VERSION } from "@/share/packed";
import { play, randoms, STAGES } from "@/share/playedRuns";

const MALFORMED = "This link does not hold a tracker run.";

/** A save with `progress` replaced field by field, as a hand-made file. */
const withProgress = (save: string, change: Record<string, unknown>) => {
  const file = JSON.parse(save);
  file.progress = { ...file.progress, ...change };
  return JSON.stringify(file);
};

/** A link with one of its packed fields replaced by these bytes. */
const withBytes = (link: string, field: string, bytes: Uint8Array) => {
  const file = JSON.parse(link);
  file.progress[field] = toBase64Url(bytes);
  return JSON.stringify(file);
};

/** The run a save holds, read as an import reads it. */
const runOf = (save: string) => {
  const parsed = parseSave(save);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.progress;
};

const KEY_BITS = Math.ceil(Math.log2(TIMELINE_KEYS.length));

/** The parts of a timeline's bytes, written as a writer writes them. */
type Parts = {
  count?: number;
  first?: number;
  k?: number;
  /** Each run: how many finds, and their drift (null: no reading) */
  runs?: [number, number | null][];
  keys?: number[];
  /** The times between finds, as the Rice codes carry them */
  gaps?: number[];
  /** What follows the bits, which a writer never writes */
  extra?: number[];
};

/** A timeline's bytes: the varints, then the bits. Defaults make one find. */
const timeline = ({
  count = 1,
  first = 5,
  k = 3,
  runs = [[1, 2]],
  keys = [0],
  gaps = [],
  extra = [],
}: Parts) => {
  const head = new ByteWriter();
  head.uint(count);
  head.uint(first);
  head.uint(k);
  head.uint(runs.length);
  for (const [length, drift] of runs) {
    head.uint(length);
    if (drift === null) head.uint(0);
    else {
      head.uint(1);
      head.int(drift);
    }
  }
  const bits = new BitWriter();
  for (const key of keys) bits.bits(key, KEY_BITS);
  for (const gap of gaps) bits.rice(gap, k);
  return Uint8Array.from([...head.done(), ...bits.done(), ...extra]);
};

describe("an ALttPR run in a packed link", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_760_000_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it.each(Object.entries(STAGES))(
    "comes back as it left, with its timeline (%s)",
    (_stage, share) => {
      const save = play.alttpr(share, randoms());

      const link = packLink(save);
      const unpacked = unpackLink(link);

      expect(JSON.parse(link).format).toBe(LINK_FORMAT);
      expect(unpacked.ok).toBe(true);
      if (!unpacked.ok) return;
      expect(runOf(unpacked.save)).toEqual(runOf(save));
      expect(Object.keys(runOf(save).timeline ?? {}).length).toBeGreaterThan(0);
    },
  );

  it("is a good deal shorter than the save it packs", () => {
    const save = play.alttpr(0.95, randoms());

    expect(packLink(save).length).toBeLessThan(save.length / 2);
  });

  it("keeps the instants and readings of a run that paused and a timer not started", () => {
    const save = withProgress(play.alttpr(0.15, randoms()), {
      timeline: {
        "check:kings-tomb": { at: 1_760_000_050_000, ms: 50_000 },
        // 40 s of pause later: the reading falls behind the clock
        "item:flippers": { at: 1_760_000_190_000, ms: 100_000 },
        "item:hookshot": { at: 1_760_000_050_000, ms: 50_000 },
        "item:lantern": { at: 1_760_000_020_000, ms: null },
        // A reading ahead of the clock too (a hand-set timer)
        "item:mirror": { at: 1_760_000_200_000, ms: 1_900_000_000_000 },
      },
    });

    const unpacked = unpackLink(packLink(save));

    expect(unpacked.ok && runOf(unpacked.save).timeline).toEqual(
      runOf(save).timeline,
    );
    expect(Object.keys(runOf(save).timeline ?? {})).toHaveLength(5);
  });

  it("keeps an empty timeline, as the link without it writes", () => {
    const save = withProgress(play.alttpr(0.5, randoms()), { timeline: {} });

    const unpacked = unpackLink(packLink(save));

    expect(unpacked.ok && runOf(unpacked.save).timeline).toEqual({});
  });

  it("opens a plain link as it always did", () => {
    const save = play.alttpr(0.5, randoms());

    expect(unpackLink(save)).toEqual({ ok: true, save });
  });

  it("leaves a save the packing cannot hold as it is", () => {
    const save = play.alttpr(0.5, randoms());

    for (const change of [
      { checked: { "no-such-place": true } },
      { checked: { "kings-tomb": false } },
      { items: { hookshot: true } },
      { items: { ...freshItems, bombos: "yes", hookshot: 1.5 } },
      { timeline: { "item:no-such": { at: 1, ms: null } } },
      { timeline: { "check:kings-tomb": { at: 1.5, ms: null } } },
      { timeline: { "check:kings-tomb": { at: -1, ms: null } } },
      { timeline: { "check:kings-tomb": { at: 1, ms: 2 ** 51 } } },
      { timeline: "none" },
    ]) {
      const odd = withProgress(save, change);
      expect(packLink(odd)).toBe(odd);
    }
  });

  it("refuses a link made against other tables", () => {
    const link = JSON.parse(packLink(play.alttpr(0.5, randoms())));

    link.table = "AAAAAA";

    expect(unpackLink(JSON.stringify(link))).toEqual({
      ok: false,
      reason: OTHER_VERSION,
    });
  });

  it("refuses checked locations of the wrong length, or past the table", () => {
    const link = packLink(play.alttpr(0.5, randoms()));
    const length = Math.ceil(MAP_LOCATIONS.size / 8);
    const full = new Uint8Array(length);

    for (const bytes of [
      new Uint8Array(length - 1),
      new Uint8Array(length + 1),
      // The padding bits of the last byte are never set by a writer
      full.fill(255),
    ]) {
      expect(unpackLink(withBytes(link, "checked", bytes))).toEqual({
        ok: false,
        reason: MALFORMED,
      });
    }
  });

  it("refuses item values that are not the table's", () => {
    const link = packLink(play.alttpr(0.5, randoms()));
    const flags = Object.values(freshItems).map((fresh) =>
      typeof fresh === "boolean" ? 1 : 0,
    );

    for (const bytes of [
      new Uint8Array(),
      // Too many values: one byte more than the table has
      Uint8Array.of(...flags, 0),
      // A flag that is neither 0 nor 1
      Uint8Array.of(...flags.map((flag) => (flag === 1 ? 2 : 0))),
    ]) {
      expect(unpackLink(withBytes(link, "items", bytes))).toEqual({
        ok: false,
        reason: MALFORMED,
      });
    }
  });

  it("refuses a timeline that is not one a writer writes", () => {
    const link = packLink(play.alttpr(0.5, randoms()));
    const off = 2 ** KEY_BITS - 1;
    expect(off).toBeGreaterThanOrEqual(TIMELINE_KEYS.length);

    const refused: Record<string, Uint8Array> = {
      "a first instant past what a field holds": timeline({
        first: 2 ** 50 + 1,
      }),
      "a gap that takes it past what a field holds": timeline({
        count: 2,
        first: 2 ** 50,
        gaps: [2 ** 50],
        k: 40,
        keys: [1, 2],
        runs: [[2, 2]],
      }),
      "a key past the table": timeline({ keys: [off] }),
      "a Rice parameter above any a writer picks": timeline({ k: 41 }),
      "a reading ahead of its own instant": timeline({
        first: 5,
        runs: [[1, 6]],
      }),
      "a reading that is neither none nor one": Uint8Array.of(
        1,
        5,
        3,
        1,
        1,
        2,
        0,
      ),
      "a run longer than the finds": timeline({ runs: [[2, 2]] }),
      "a run of none": timeline({
        runs: [
          [0, 2],
          [1, 2],
        ],
      }),
      "a timer reading past what a field holds": timeline({
        first: 5,
        runs: [[1, -(2 ** 50)]],
      }),
      "bits left over after the last gap": timeline({ extra: [0, 0] }),
      "its count only": Uint8Array.of(1),
      "more finds than the table has keys": timeline({
        count: TIMELINE_KEYS.length + 1,
      }),
      "no bits for its gaps": timeline({
        count: 2,
        k: 20,
        keys: [1, 2],
        runs: [[2, 2]],
      }),
      "no bits for its keys": Uint8Array.of(1, 5, 3, 1, 1, 0),
      "no bytes": new Uint8Array(),
      "padding that is not zero": timeline({}).map((byte, at, all) =>
        at === all.length - 1 ? byte | 1 : byte,
      ),
      "runs that are not as long as the finds": timeline({
        count: 2,
        gaps: [1],
        keys: [1, 2],
        runs: [[1, 2]],
      }),
      "the same key twice": timeline({
        count: 2,
        gaps: [5],
        keys: [3, 3],
        runs: [[2, 2]],
      }),
    };

    for (const [name, bytes] of Object.entries(refused)) {
      expect(unpackLink(withBytes(link, "timeline", bytes)), name).toEqual({
        ok: false,
        reason: MALFORMED,
      });
    }
  });

  it("reads a find as it was written", () => {
    const link = packLink(play.alttpr(0.5, randoms()));

    const unpacked = unpackLink(
      withBytes(
        link,
        "timeline",
        timeline({
          count: 3,
          first: 1000,
          gaps: [0, 70_000],
          k: 4,
          keys: [0, 1, 2],
          // A timer not started, then one running 400 ms behind the clock
          runs: [
            [1, null],
            [2, 400],
          ],
        }),
      ),
    );

    expect(unpacked.ok).toBe(true);
    if (!unpacked.ok) return;
    expect(Object.values(JSON.parse(unpacked.save).progress.timeline)).toEqual([
      { at: 1000, ms: null },
      { at: 1000, ms: 600 },
      { at: 71_000, ms: 70_600 },
    ]);
  });
});
