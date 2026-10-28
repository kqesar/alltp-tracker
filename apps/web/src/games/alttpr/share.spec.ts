import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { items as freshItems } from "@/games/alttpr/data/items";
import {
  packLink,
  SHARE_ITEMS,
  TIMELINE_KEYS,
  unpackLink,
} from "@/games/alttpr/share";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { parseSave, withoutTimeline } from "@/games/alttpr/stores/persistence";
import {
  BitWriter,
  ByteWriter,
  MAX_FIELD_NUMBER,
  toBase64Url,
  zigzag,
} from "@/share/bytes";
import legacyLink from "@/share/fixtures/link-alttpr-before-sizes.json";
import firstLayout from "@/share/fixtures/links-alttpr-v2.json";
import { LINK_FORMAT, OTHER_VERSION } from "@/share/packed";
import {
  play,
  playOnGameClock,
  randoms,
  SEEDS,
  STAGES,
} from "@/share/playedRuns";
import { decodeRun, sharedPayload } from "@/share/runLink";
import { CHAT_LINK_CHARS, makeLink } from "@/share/shareRun";

const MALFORMED = "This link does not hold a tracker run.";

/** A save with `progress` replaced field by field, as a hand-made file. */
const withProgress = (save: string, change: Record<string, unknown>) => {
  const file = JSON.parse(save);
  file.progress = { ...file.progress, ...change };
  return JSON.stringify(file);
};

/**
 * A link with one of its packed fields replaced by these bytes, read as the
 * layout `version` (the one it was made with, by default).
 */
const withBytes = (
  link: string,
  field: string,
  bytes: Uint8Array,
  version?: number,
) => {
  const file = JSON.parse(link);
  file.progress[field] = toBase64Url(bytes);
  if (version !== undefined) file.link = version;
  return JSON.stringify(file);
};

/** The run a save holds, read as an import reads it. */
const runOf = (save: string) => {
  const parsed = parseSave(save);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.progress;
};

const KEY_BITS = Math.ceil(Math.log2(TIMELINE_KEYS.length));

/** The parts of a timeline's bytes in link 2, written as its writer wrote them. */
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

/**
 * A timeline's bytes in link 2: the varints, each run's drift whole, then
 * the bits. Defaults make one find.
 */
const wholeDrifts = ({
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

/** The parts of a timeline's bytes in link 3, written as its writer writes them. */
type CompactParts = {
  count?: number;
  first?: number;
  /** The gaps' Rice parameter, and whether a bit marks a shared instant */
  k?: number;
  shared?: boolean;
  kRun?: number;
  kChange?: number;
  keys?: number[];
  /** The times between finds */
  gaps?: number[];
  /** Each run: how many finds, and the change of drift (null: no reading) */
  runs?: [number, number | null][];
  /** What follows the bits, which a writer never writes */
  extra?: number[];
};

/**
 * A timeline's bytes in link 3: five varints, then the keys, the gaps and
 * the runs as bits. Defaults make one find, at 5 with a reading of 2.
 */
const compact = ({
  count = 1,
  first = 5,
  k = 3,
  shared = false,
  kRun = 2,
  kChange = 3,
  keys = [0],
  gaps = [],
  runs = [[1, -2]],
  extra = [],
}: CompactParts) => {
  const head = new ByteWriter();
  for (const value of [count, first, k * 2 + (shared ? 1 : 0), kRun, kChange]) {
    head.uint(value);
  }
  const bits = new BitWriter();
  for (const key of keys) bits.bits(key, KEY_BITS);
  for (const gap of gaps) {
    if (!shared) bits.rice(gap, k);
    else if (gap === 0) bits.bits(0, 1);
    else {
      bits.bits(1, 1);
      bits.rice(gap - 1, k);
    }
  }
  for (const [length, change] of runs) {
    bits.rice(length - 1, kRun);
    bits.bits(change === null ? 0 : 1, 1);
    if (change !== null) bits.rice(zigzag(change), kChange);
  }
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
      // The seed travels with the run
      expect(runOf(unpacked.save).seed).toBe(SEEDS.alttpr);
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

  it("writes link 2 for a run with no find, which a tracker before link 3 opens, and link 3 for any other", () => {
    const played = play.alttpr(0.5, randoms());
    const bare = JSON.parse(packLink(withProgress(played, { timeline: {} })));
    const { timeline: _, ...progress } = JSON.parse(played).progress;
    const none = JSON.parse(
      packLink(JSON.stringify({ ...JSON.parse(played), progress })),
    );

    // The short link Share falls back to: the byte both layouts share
    expect(bare.link).toBe(2);
    expect(bare.progress.timeline).toBe("AA");
    expect(none.link).toBe(2);
    expect(JSON.parse(packLink(played)).link).toBe(3);
    // As v2.58.0, the last tracker to read link 2 alone, wrote it
    const recorded = firstLayout.links.find(
      ({ name }) => name === "an empty timeline",
    );
    expect(recorded).toBeDefined();
    expect(JSON.parse(packLink(JSON.stringify(recorded?.save)))).toEqual(
      recorded?.link,
    );
  });

  /** The run a link's address opens to. */
  const runIn = async (url: string) => {
    const unpacked = unpackLink(
      await decodeRun(sharedPayload(new URL(url).hash) ?? ""),
    );
    if (!unpacked.ok) throw new Error(unpacked.reason);
    return runOf(unpacked.save);
  };

  it("shares a run of 270 finds on the game's clock whole, its timeline in the link", async () => {
    const save = playOnGameClock(270, randoms());
    // What Share makes of a run: the full export, then the one without timeline
    const link = await makeLink([save, withoutTimeline(save)].map(packLink));

    expect(link.full).toBeNull();
    expect(link.url.length).toBeLessThanOrEqual(CHAT_LINK_CHARS);
    expect(await runIn(link.url)).toEqual(runOf(save));
    expect(Object.keys(runOf(save).timeline ?? {})).toHaveLength(270);
  });

  it("shares a longer one short, without its timeline, and keeps the full link with it all", async () => {
    const save = playOnGameClock(300, randoms());
    const link = await makeLink([save, withoutTimeline(save)].map(packLink));

    expect(link.url.length).toBeLessThanOrEqual(CHAT_LINK_CHARS);
    expect(link.full).not.toBeNull();
    const short = await runIn(link.url);
    const full = await runIn(link.full ?? "");
    expect(short.timeline).toEqual({});
    expect({ ...short, timeline: undefined }).toEqual({
      ...runOf(save),
      timeline: undefined,
    });
    expect(full).toEqual(runOf(save));
    expect(Object.keys(full.timeline ?? {})).toHaveLength(300);
  });

  it("writes link 3, whose timeline comes back exactly whatever its timer did", () => {
    const base = play.alttpr(0.15, randoms());
    const T = 1_793_179_725_000;
    const cases: Record<string, Record<string, unknown>> = {
      // The game ran ahead (the timer set back), stopped, then resumed
      // exactly where it was: a change of 0 from the last drift written
      "a drift back, and the same drift after the timer stopped": {
        "check:kings-tomb": { at: T, ms: 1000 },
        "check:library": { at: T + 60_000, ms: 61_251 },
        "check:links-house": { at: T + 70_000, ms: null },
        "check:sanctuary": { at: T + 80_000, ms: 81_251 },
      },
      "finds before the timer, a reset, a pause and a hand-set timer": {
        "check:kings-tomb": { at: T, ms: null },
        "check:library": { at: T + 175_000, ms: 3000 },
        "check:links-house": { at: T + 5000, ms: null },
        "check:mushroom": { at: T + 375_000, ms: 202_499 },
        "check:sanctuary": { at: T + 65_000, ms: 20_000 },
        "check:spectacle-rock": { at: T + 475_001, ms: null },
        "item:boots": { at: T + 235_000, ms: 62_750 },
        "item:flippers": { at: T + 475_000, ms: 1_900_000_000_000 },
        "item:hookshot": { at: T + 65_000, ms: 20_000 },
        "item:lantern": { at: T + 125_000, ms: 75_000 },
      },
      "one find": { "check:kings-tomb": { at: T, ms: 0 } },
      "the largest values a field holds": {
        "check:kings-tomb": { at: 0, ms: MAX_FIELD_NUMBER },
        "check:library": { at: 1, ms: null },
        "check:links-house": { at: MAX_FIELD_NUMBER, ms: 0 },
        "item:hookshot": { at: MAX_FIELD_NUMBER, ms: MAX_FIELD_NUMBER },
      },
      // One instant, two readings: the timer started between two marks
      "two readings at one instant": {
        "item:hookshot": { at: T, ms: null },
        "item:lantern": { at: T, ms: 0 },
      },
    };

    for (const [name, timeline] of Object.entries(cases)) {
      const save = withProgress(base, { timeline });
      const link = packLink(save);
      expect(JSON.parse(link).link, name).toBe(3);
      const unpacked = unpackLink(link);
      expect(unpacked.ok && runOf(unpacked.save).timeline, name).toEqual(
        timeline,
      );
    }
    // Runs on the game's clock, short and long, and on real time
    for (const save of [
      playOnGameClock(66, randoms()),
      playOnGameClock(300, randoms()),
      play.alttpr(STAGES.late, randoms()),
    ]) {
      const unpacked = unpackLink(packLink(save));
      expect(unpacked.ok && runOf(unpacked.save)).toEqual(runOf(save));
    }
  });

  // Recorded from the first layout's own writer (fixtures/), never edited:
  // links already shared, which must keep opening as they were made
  it.each(firstLayout.links.map((recorded) => [recorded.name, recorded]))(
    "opens a link of the first layout as it was made (%s)",
    (_name, { link, save }) => {
      expect(link.link).toBe(2);
      const unpacked = unpackLink(JSON.stringify(link));

      expect(unpacked.ok).toBe(true);
      if (!unpacked.ok) return;
      expect(runOf(unpacked.save)).toEqual(runOf(JSON.stringify(save)));
    },
  );

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

  it("indexes the items by a table of its own, which the grid does not reorder", () => {
    // A new item is appended to SHARE_ITEMS: moving one breaks every link
    expect(new Set(SHARE_ITEMS)).toEqual(new Set(Object.keys(freshItems)));
    expect(SHARE_ITEMS).toHaveLength(new Set(SHARE_ITEMS).size);
    expect(SHARE_ITEMS.slice(-7)).toEqual([
      "hearts",
      "tenbombs",
      "escape",
      "fluteactive",
      "heldcrystals",
      "heldgreen",
      "heldpendants",
    ]);
    expect(JSON.parse(packLink(play.alttpr(0.5, randoms()))).sizes).toEqual([
      MAP_LOCATIONS.size,
      SHARE_ITEMS.length,
    ]);
  });

  // Made by the tracker before the half magic cell, as it wrote links then:
  // the item table one shorter, no sizes in the link (fixtures/).
  it("opens a link made before an item was added, the new item as a fresh run has it", () => {
    const unpacked = unpackLink(JSON.stringify(legacyLink));

    expect(unpacked.ok).toBe(true);
    if (!unpacked.ok) return;
    const run = runOf(unpacked.save);
    // Made before runs kept their seed: none
    expect(run.seed).toBeUndefined();
    expect(run.items).toMatchObject({
      boots: true,
      hookshot: true,
      lantern: true,
      sword: 2,
    });
    expect(run.items).not.toHaveProperty("magic");
    // Laid on the board, the item the link lacks starts as in a fresh run
    useGameStore.setState(useGameStore.getInitialState(), true);
    useGameStore.getState().loadProgress(run);
    expect(useGameStore.getState().items).toMatchObject({
      lantern: true,
      magic: 0,
    });
    expect(Object.keys(run.checked ?? {})).toHaveLength(4);
    // The timeline's keys are the old table's, whatever the new one holds
    expect(Object.keys(run.timeline ?? {}).sort()).toEqual(
      [
        "item:boots",
        "item:bow:1",
        "item:hookshot",
        "item:lantern",
        "item:sword:1",
        "item:sword:2",
        ...Object.keys(run.checked ?? {}).map((id) => `check:${id}`),
      ].sort(),
    );
  });

  it("opens that link with its sizes written, as the tracker now writes them", () => {
    const { sizes: _, ...bare } = legacyLink as typeof legacyLink & {
      sizes?: number[];
    };

    expect(
      unpackLink(JSON.stringify({ ...bare, sizes: [217, 98] })),
    ).toMatchObject({ ok: true });
    // Sizes that do not fit the digest it carries are another tracker's
    expect(unpackLink(JSON.stringify({ ...bare, sizes: [217, 97] }))).toEqual({
      ok: false,
      reason: OTHER_VERSION,
    });
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
    const flags = SHARE_ITEMS.map((id) =>
      typeof freshItems[id] === "boolean" ? 1 : 0,
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

  it("refuses a timeline of the first layout that its writer never wrote", () => {
    const link = packLink(play.alttpr(0.5, randoms()));
    const off = 2 ** KEY_BITS - 1;
    expect(off).toBeGreaterThanOrEqual(TIMELINE_KEYS.length);

    const refused: Record<string, Uint8Array> = {
      "a first instant past what a field holds": wholeDrifts({
        first: 2 ** 50 + 1,
      }),
      "a gap that takes it past what a field holds": wholeDrifts({
        count: 2,
        first: 2 ** 50,
        gaps: [2 ** 50],
        k: 40,
        keys: [1, 2],
        runs: [[2, 2]],
      }),
      "a key past the table": wholeDrifts({ keys: [off] }),
      "a Rice parameter above any a writer picks": wholeDrifts({ k: 41 }),
      "a reading ahead of its own instant": wholeDrifts({
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
      "a run longer than the finds": wholeDrifts({ runs: [[2, 2]] }),
      "a run of none": wholeDrifts({
        runs: [
          [0, 2],
          [1, 2],
        ],
      }),
      "a timer reading past what a field holds": wholeDrifts({
        first: 5,
        runs: [[1, -(2 ** 50)]],
      }),
      "an empty timeline with bytes after it": Uint8Array.of(0, 0),
      "bits left over after the last gap": wholeDrifts({ extra: [0, 0] }),
      "its count only": Uint8Array.of(1),
      "more finds than the table has keys": wholeDrifts({
        count: TIMELINE_KEYS.length + 1,
      }),
      "no bits for its gaps": wholeDrifts({
        count: 2,
        k: 20,
        keys: [1, 2],
        runs: [[2, 2]],
      }),
      "no bits for its keys": Uint8Array.of(1, 5, 3, 1, 1, 0),
      "no bytes": new Uint8Array(),
      "padding that is not zero": wholeDrifts({}).map((byte, at, all) =>
        at === all.length - 1 ? byte | 1 : byte,
      ),
      "runs that are not as long as the finds": wholeDrifts({
        count: 2,
        gaps: [1],
        keys: [1, 2],
        runs: [[1, 2]],
      }),
      "the same key twice": wholeDrifts({
        count: 2,
        gaps: [5],
        keys: [3, 3],
        runs: [[2, 2]],
      }),
    };

    // A sound one first, so the refusals are the bytes', not the link's
    expect(unpackLink(withBytes(link, "timeline", wholeDrifts({}), 2)).ok).toBe(
      true,
    );
    for (const [name, bytes] of Object.entries(refused)) {
      expect(unpackLink(withBytes(link, "timeline", bytes, 2)), name).toEqual({
        ok: false,
        reason: MALFORMED,
      });
    }
  });

  it("refuses a timeline of link 3 that its writer never writes", () => {
    const link = packLink(play.alttpr(0.5, randoms()));
    const off = 2 ** KEY_BITS - 1;
    const two = { count: 2, gaps: [5], keys: [1, 2] };
    const eight = {
      count: 8,
      keys: [0, 1, 2, 3, 4, 5, 6, 7],
      shared: true,
    };
    expect(KEY_BITS * 8).toBe(72);

    const refused: Record<string, Uint8Array> = {
      "a changes' Rice parameter above any a writer picks": compact({
        kChange: 41,
      }),
      "a first instant past what a field holds": compact({
        first: MAX_FIELD_NUMBER + 1,
      }),
      "a gap that takes it past what a field holds": compact({
        ...two,
        first: MAX_FIELD_NUMBER,
        gaps: [1],
        k: 0,
        runs: [[2, null]],
      }),
      "a gaps' Rice parameter above any a writer picks": compact({ k: 41 }),
      "a key past the table": compact({ keys: [off] }),
      "a reading ahead of its own instant": compact({ runs: [[1, 1]] }),
      "a reading behind it by more than a field holds": compact({
        first: 0,
        kChange: 40,
        runs: [[1, -(MAX_FIELD_NUMBER + 1)]],
      }),
      "a run longer than the finds": compact({ runs: [[2, -2]] }),
      "a runs' Rice parameter above any a writer picks": compact({ kRun: 41 }),
      "an empty timeline with bytes after it": Uint8Array.of(0, 0),
      "bits left over after the last run": compact({ extra: [0, 0] }),
      "its count only": Uint8Array.of(1),
      "more finds than the table has keys": compact({
        count: TIMELINE_KEYS.length + 1,
      }),
      // Eight keys of nine bits end on a byte: nothing pads what follows
      "no bit to say a shared instant": compact({ ...eight, runs: [] }),
      "no bits for a drift's change": compact({ kChange: 20 }).slice(0, 5 + 2),
      "no bits for a gap after its bit": compact({
        ...eight,
        gaps: [5, 0, 0, 0, 0, 0, 0],
        k: 20,
        runs: [],
      }).slice(0, 5 + 10),
      "no bits for its gaps": compact({ ...two, gaps: [], k: 20, runs: [] }),
      "no bits for its keys": Uint8Array.of(1, 5, 6, 2, 3),
      "no bits for its runs": compact({ kRun: 20, runs: [] }),
      "no bytes": new Uint8Array(),
      "padding that is not zero": compact({}).map((byte, at, all) =>
        at === all.length - 1 ? byte | 1 : byte,
      ),
      "runs that are not as long as the finds": compact({
        ...two,
        runs: [[1, -2]],
      }),
      "the same key twice": compact({ ...two, keys: [3, 3], runs: [[2, -2]] }),
      "two runs side by side with none": compact({
        ...two,
        runs: [
          [1, null],
          [1, null],
        ],
      }),
      // A writer makes one run of two finds that share a reading
      "two runs side by side with one reading": compact({
        ...two,
        runs: [
          [1, -2],
          [1, 0],
        ],
      }),
    };

    expect(unpackLink(withBytes(link, "timeline", compact({}))).ok).toBe(true);
    for (const [name, bytes] of Object.entries(refused)) {
      expect(unpackLink(withBytes(link, "timeline", bytes)), name).toEqual({
        ok: false,
        reason: MALFORMED,
      });
    }
  });

  it("reads a find as each layout wrote it", () => {
    const link = packLink(play.alttpr(0.5, randoms()));
    const read = (bytes: Uint8Array, version: number) => {
      const unpacked = unpackLink(withBytes(link, "timeline", bytes, version));
      return unpacked.ok
        ? Object.values(JSON.parse(unpacked.save).progress.timeline)
        : unpacked;
    };
    // A timer not started, then one running 400 ms behind the clock
    const written = [
      { at: 1000, ms: null },
      { at: 1000, ms: 600 },
      { at: 71_000, ms: 70_600 },
    ];

    expect(
      read(
        wholeDrifts({
          count: 3,
          first: 1000,
          gaps: [0, 70_000],
          k: 4,
          keys: [0, 1, 2],
          runs: [
            [1, null],
            [2, 400],
          ],
        }),
        2,
      ),
    ).toEqual(written);
    // The drift as its change from the first instant, the shared instant a bit
    for (const shared of [false, true]) {
      expect(
        read(
          compact({
            count: 3,
            first: 1000,
            gaps: [0, 70_000],
            k: 4,
            keys: [0, 1, 2],
            runs: [
              [1, null],
              [2, 400 - 1000],
            ],
            shared,
          }),
          3,
        ),
      ).toEqual(written);
    }
  });
});
