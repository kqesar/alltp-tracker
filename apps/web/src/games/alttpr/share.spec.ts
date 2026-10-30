import { BONK_DROP_IDS, MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOOR_LOCATION_IDS, DOOR_OPTIONS } from "@/games/alttpr/data/doorRando";
import { items as freshItems } from "@/games/alttpr/data/items";
import {
  ACCESSIBILITY_LABELS,
  BOSS_SHUFFLE_LABELS,
  DUNGEON_ITEM_LABELS,
  ENEMY_HEALTH_LABELS,
  ENTRANCE_LABELS,
  FUNCTIONALITY_LABELS,
  GLITCHES_LABELS,
  GOAL_LABELS,
  getPreset,
  HIDEABLE,
  MODE_LABELS,
  PLACEMENT_LABELS,
  POOL_LABELS,
  presets,
  SWORDS_LABELS,
} from "@/games/alttpr/data/presets";
import {
  packLink,
  SHARE_ITEMS,
  SHARE_SETTINGS,
  TIMELINE_KEYS,
  unpackLink,
} from "@/games/alttpr/share";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { parseSave, withoutTimeline } from "@/games/alttpr/stores/persistence";
import {
  BitWriter,
  ByteWriter,
  fromBase64Url,
  MAX_FIELD_NUMBER,
  toBase64Url,
  zigzag,
} from "@/share/bytes";
import legacyLink from "@/share/fixtures/link-alttpr-before-sizes.json";
import doorBranchLink from "@/share/fixtures/link-alttpr-door-branch.json";
import firstLayout from "@/share/fixtures/links-alttpr-v2.json";
import thirdLayout from "@/share/fixtures/links-alttpr-v3.json";
import fourthLayout from "@/share/fixtures/links-alttpr-v4.json";
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

/** The locations links index: the map's, then the Door Randomizer's. */
const LINK_LOCATIONS = MAP_LOCATIONS.size + DOOR_LOCATION_IDS.size;

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

/**
 * A link of each layout to lay bytes in: one its own writer recorded for 2
 * and 3 (fixtures/), today's for 4.
 */
const linkOf = (version: 2 | 3 | 4): string => {
  if (version === 4) return packLink(play.alttpr(0.5, randoms()));
  const [recorded] = (version === 2 ? firstLayout : thirdLayout).links;
  expect(recorded.link.link).toBe(version);
  return JSON.stringify(recorded.link);
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

  it("writes link 2 for a run with no find, which every tracker since the packed form opens, and link 4 for any other", () => {
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
    expect(JSON.parse(packLink(played)).link).toBe(4);
    // As v2.58.0, the last tracker to read link 2 alone, wrote it, but for
    // the items appended to the table since (heartquarters, the hunt's
    // pieces, the known bosses, then the bottles' contents and the
    // capacities), at the end
    const recorded = firstLayout.links.find(
      ({ name }) => name === "an empty timeline",
    );
    if (recorded === undefined) throw new Error("No empty timeline recorded");
    const since = SHARE_ITEMS.slice(recorded.link.sizes[1]);
    expect(since).toEqual([
      "heartquarters",
      "triforce",
      "goalpieces",
      ...Array.from({ length: 10 }, (_, index) => `knownboss${index}`),
      "bottlecontents1",
      "bottlecontents2",
      "bottlecontents3",
      "bottlecontents4",
      "bombcapacity",
      "arrowcapacity",
    ]);
    const save = recorded.save as { progress: { items: object } };
    const written = JSON.parse(
      packLink(
        JSON.stringify({
          ...save,
          progress: {
            ...save.progress,
            items: {
              ...save.progress.items,
              ...Object.fromEntries(since.map((id) => [id, freshItems[id]])),
            },
          },
        }),
      ),
    );
    const {
      checked: writtenChecked,
      items: writtenItems,
      ...writtenRest
    } = written.progress;
    const {
      checked: recordedChecked,
      items: recordedItems,
      ...recordedRest
    } = recorded.link.progress;
    expect(writtenRest).toEqual(recordedRest);
    // The recorded checks' bits, then the Door Randomizer's locations
    // appended to the table, none set
    expect([...fromBase64Url(writtenChecked)]).toEqual([
      ...fromBase64Url(recordedChecked),
      ...Array(
        Math.ceil(LINK_LOCATIONS / 8) - Math.ceil(MAP_LOCATIONS.size / 8),
      ).fill(0),
    ]);
    expect({ ...written, progress: null, sizes: null, table: null }).toEqual({
      ...recorded.link,
      progress: null,
      sizes: null,
      table: null,
    });
    expect(written.sizes).toEqual([LINK_LOCATIONS, SHARE_ITEMS.length]);
    // The recorded items' bytes, then each item appended at its fresh value
    // (a signed varint: twice a small count)
    expect([...fromBase64Url(writtenItems)]).toEqual([
      ...fromBase64Url(recordedItems),
      ...since.map((id) => 2 * Number(freshItems[id])),
    ]);
  });

  /** The run a link's address opens to. */
  const runIn = async (url: string) => {
    const unpacked = unpackLink(
      await decodeRun(sharedPayload(new URL(url).hash) ?? ""),
    );
    if (!unpacked.ok) throw new Error(unpacked.reason);
    return runOf(unpacked.save);
  };

  it("shares a run of 300 finds on the game's clock whole, its timeline in the link", async () => {
    const save = playOnGameClock(300, randoms());
    // What Share makes of a run: the full export, then the one without timeline
    const link = await makeLink([save, withoutTimeline(save)].map(packLink));

    expect(link.full).toBeNull();
    expect(link.url.length).toBeLessThanOrEqual(CHAT_LINK_CHARS);
    expect(await runIn(link.url)).toEqual(runOf(save));
    expect(Object.keys(runOf(save).timeline ?? {})).toHaveLength(300);
  });

  it("shares one too long short, without its timeline, and keeps the full link with it all", async () => {
    // 300 finds minutes apart, each read anew after a pause of up to a minute
    const t0 = 1_793_179_725_000;
    let at = t0;
    let paused = 0;
    const save = withProgress(playOnGameClock(0, randoms()), {
      timeline: Object.fromEntries(
        TIMELINE_KEYS.slice(0, 300).map((key, index) => {
          at += 1000 + ((index * 104_729) % 299_000);
          paused += 200 + ((index * 7919) % 59_000);
          return [key, { at, ms: at - t0 - paused }];
        }),
      ),
    });
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

  it("writes link 4, whose timeline comes back exactly whatever its timer did", () => {
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
      expect(JSON.parse(link).link, name).toBe(4);
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

  /** A link its layout's own writer recorded, beside the save it was made from. */
  type Recorded = {
    readonly link: { readonly link: number };
    readonly name: string;
    readonly save: { readonly progress: { readonly settings: unknown } };
  };

  // Recorded from each earlier layout's own writer (fixtures/), never
  // changed: links already shared, which must keep opening as they were made
  // (link 4 by v2.67.0, before the Door Randomizer's settings joined the
  // table after its own)
  it.each(
    (
      [
        [2, firstLayout.links],
        [3, thirdLayout.links],
        [4, fourthLayout.links],
      ] as const
    ).flatMap(([version, links]) =>
      (links as readonly Recorded[]).map(
        (recorded) => [version, recorded.name, recorded] as const,
      ),
    ),
  )(
    "opens a link of layout %i as it was made (%s)",
    (version, _name, { link, save }) => {
      expect(link.link).toBe(version);
      const unpacked = unpackLink(JSON.stringify(link));

      expect(unpacked.ok).toBe(true);
      if (!unpacked.ok) return;
      expect(runOf(unpacked.save)).toEqual(runOf(JSON.stringify(save)));
      // Each setting as the save had it, its hidden list in its order
      expect(JSON.parse(unpacked.save).progress.settings).toStrictEqual(
        save.progress.settings,
      );
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
    expect(SHARE_ITEMS.slice(-26)).toEqual([
      "hearts",
      "tenbombs",
      "escape",
      "fluteactive",
      "heldcrystals",
      "heldgreen",
      "heldpendants",
      "heartquarters",
      "triforce",
      "goalpieces",
      ...Array.from({ length: 10 }, (_, index) => `knownboss${index}`),
      "bottlecontents1",
      "bottlecontents2",
      "bottlecontents3",
      "bottlecontents4",
      "bombcapacity",
      "arrowcapacity",
    ]);
    expect(JSON.parse(packLink(play.alttpr(0.5, randoms()))).sizes).toEqual([
      LINK_LOCATIONS,
      SHARE_ITEMS.length,
      SHARE_SETTINGS.length,
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
    expect(run.items).not.toHaveProperty("heartquarters");
    // Laid on the board, the items the link lacks start as in a fresh run
    useGameStore.setState(useGameStore.getInitialState(), true);
    useGameStore.getState().loadProgress(run);
    expect(useGameStore.getState().items).toMatchObject({
      heartquarters: 0,
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

  it("refuses, as another version's, a link the unreleased Door Randomizer branch made", () => {
    // Its settings followed v2.66.0's where v2.67.0's own now stand: the
    // digest tells them apart, so it is never misread
    // (made before the bonk drops' ids were appended to the locations)
    expect(doorBranchLink.link.sizes).toEqual([
      LINK_LOCATIONS - BONK_DROP_IDS.length,
      125,
      116,
    ]);
    expect(unpackLink(JSON.stringify(doorBranchLink.link))).toEqual({
      ok: false,
      reason: OTHER_VERSION,
    });
  });

  it("keeps v2.67.0's settings table first, the Door Randomizer's after it", () => {
    const [recorded] = fourthLayout.links;
    const [, , settings] = recorded.link.sizes;
    // Every entry v2.67.0 had, in its places: the first a DR run adds is past them
    expect(SHARE_SETTINGS[settings - 1]).toBe("enemyHealth:expert");
    expect(SHARE_SETTINGS[settings]).toBe("randomizer:dr");
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
    const length = Math.ceil(LINK_LOCATIONS / 8);
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
    const link = linkOf(2);
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
    expect(unpackLink(withBytes(link, "timeline", wholeDrifts({}))).ok).toBe(
      true,
    );
    for (const [name, bytes] of Object.entries(refused)) {
      expect(unpackLink(withBytes(link, "timeline", bytes)), name).toEqual({
        ok: false,
        reason: MALFORMED,
      });
    }
  });

  it("refuses a timeline of link 3 and later that its writer never writes", () => {
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
    const read = (bytes: Uint8Array, version: 2 | 3 | 4) => {
      const unpacked = unpackLink(
        withBytes(linkOf(version), "timeline", bytes),
      );
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
    for (const version of [3, 4] as const) {
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
            version,
          ),
        ).toEqual(written);
      }
    }
  });
});

describe("the settings in a link (link 4)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_793_179_725_000);
  });
  afterEach(() => vi.useRealTimers());

  /** A run with a find, so its link is link 4, under these settings. */
  const runWith = (settings: Record<string, unknown>, presetId = "open") =>
    withProgress(playOnGameClock(3, randoms()), { presetId, settings });

  /** What a link makes of a save's settings, key order and all. */
  const settingsBack = (save: string) => {
    const link = JSON.parse(packLink(save));
    expect(link.link).toBe(4);
    expect(typeof link.progress.settings).toBe("string");
    const unpacked = unpackLink(JSON.stringify(link));
    if (!unpacked.ok) throw new Error(unpacked.reason);
    return JSON.parse(unpacked.save).progress.settings;
  };

  const base = getPreset("open").settings as unknown as Record<string, unknown>;

  it("carries a Door Randomizer run's settings and its own checks", () => {
    const settings = {
      ...getPreset("door-randomizer").settings,
      dropShuffle: "underworld",
      pottery: "lottery",
      shopsanity: true,
    };
    const save = withProgress(runWith(settings, "door-randomizer"), {
      checked: {
        "eastern-palace/dark-square-pot-key": true,
        "kakariko-shop/left": true,
        "links-house": true,
      },
    });
    const link = JSON.parse(packLink(save));
    expect(link.link).toBe(4);
    const unpacked = unpackLink(JSON.stringify(link));
    if (!unpacked.ok) throw new Error(unpacked.reason);
    const back = JSON.parse(unpacked.save).progress;
    expect(back.settings).toEqual(settings);
    expect(Object.keys(back.checked).sort()).toEqual([
      "eastern-palace/dark-square-pot-key",
      "kakariko-shop/left",
      "links-house",
    ]);
  });

  it("carries an Overworld Randomizer run's settings and bonk drops taken", () => {
    const settings = {
      ...getPreset("door-randomizer").settings,
      bombBag: false,
      bonkDrops: true,
      customGoals: true,
      prizeShuffle: "nearby",
      randomizer: "owr",
      shuffleFollowers: true,
    };
    const save = withProgress(runWith(settings, "door-randomizer"), {
      checked: { "links-house": true, "pyramid-tree": true },
    });
    const unpacked = unpackLink(packLink(save));
    if (!unpacked.ok) throw new Error(unpacked.reason);
    const back = JSON.parse(unpacked.save).progress;
    expect(back.settings).toEqual(settings);
    expect(Object.keys(back.checked).sort()).toEqual([
      "links-house",
      "pyramid-tree",
    ]);
  });

  it("carries a door-shuffled run's door notes as they are", () => {
    const settings = {
      ...getPreset("door-randomizer").settings,
      doorIntensity: "3",
      doorShuffle: "crossed",
    };
    const doors = {
      keys: { "Eastern Palace": 3 },
      kinds: { "eastern-cannonball-n": "big" },
      links: { "eastern-cannonball-n": "gt-big-chest-sw" },
      lobbies: { eastern: "pod-lobby-s" },
    };
    const save = withProgress(runWith(settings, "door-randomizer"), { doors });
    const unpacked = unpackLink(packLink(save));
    if (!unpacked.ok) throw new Error(unpacked.reason);
    const back = JSON.parse(unpacked.save).progress;
    expect(back.doors).toEqual(doors);
    expect(back.settings).toEqual(settings);
    expect(runOf(unpacked.save).doors).toEqual(doors);
  });

  it("carries an OWR run's overworld notes as they are", () => {
    const settings = {
      ...getPreset("door-randomizer").settings,
      owCrossed: "grouped",
      owFluteShuffle: "random",
      owMixed: true,
      owWhirlpool: true,
      randomizer: "owr",
    };
    const overworld = {
      crossings: { "Lost Woods SC": false, "Lost Woods SW": true },
      flips: { "0": true, "44": false },
      flute: [0x30, 0x18],
      whirlpools: {
        "C Whirlpool": "Zora Whirlpool",
        "Zora Whirlpool": "C Whirlpool",
      },
    };
    const save = withProgress(runWith(settings, "door-randomizer"), {
      overworld,
    });
    const unpacked = unpackLink(packLink(save));
    if (!unpacked.ok) throw new Error(unpacked.reason);
    expect(JSON.parse(unpacked.save).progress.overworld).toEqual(overworld);
    expect(runOf(unpacked.save).overworld).toEqual(overworld);
  });

  it("holds every option the tracker has, each once, each setting's own", () => {
    const options = [
      ...Object.keys(MODE_LABELS).map((value) => `mode:${value}`),
      ...Object.keys(GOAL_LABELS).map((value) => `goal:${value}`),
      ...Object.keys(DUNGEON_ITEM_LABELS).map((v) => `dungeonItems:${v}`),
      ...Object.keys(ENTRANCE_LABELS).map((v) => `entranceShuffle:${v}`),
      "swordless:false",
      "swordless:true",
      ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((count) => [
        `crystalsTower:${count}`,
        `crystalsGanon:${count}`,
      ]),
      ...Object.keys(PLACEMENT_LABELS).map((v) => `itemPlacement:${v}`),
      ...Object.keys(ACCESSIBILITY_LABELS).map((v) => `accessibility:${v}`),
      ...Object.keys(POOL_LABELS).map((value) => `itemPool:${value}`),
      ...Object.keys(FUNCTIONALITY_LABELS).map(
        (value) => `itemFunctionality:${value}`,
      ),
      // None is said by the absence of `glitches`
      ...Object.keys(GLITCHES_LABELS)
        .filter((value) => value !== "none")
        .map((value) => `glitches:${value}`),
      "hidden:",
      ...HIDEABLE.map((setting) => `hidden:${setting}`),
      ...Object.keys(BOSS_SHUFFLE_LABELS).map((v) => `bossShuffle:${v}`),
      // A No Logic run's: a glitched logic's, None said by its absence
      ...Object.keys(GLITCHES_LABELS)
        .filter((value) => value !== "none" && value !== "no_logic")
        .map((value) => `playGlitches:${value}`),
      // Randomized swords and default health are said by their absence
      ...Object.keys(SWORDS_LABELS)
        .filter((value) => value !== "randomized")
        .map((value) => `swords:${value}`),
      ...Object.keys(ENEMY_HEALTH_LABELS)
        .filter((value) => value !== "default")
        .map((value) => `enemyHealth:${value}`),
      // A Door Randomizer run's own, after v2.67.0's
      ...Object.entries(DOOR_OPTIONS).flatMap(([key, options]) =>
        options.map(([option]) => `${key}:${String(option)}`),
      ),
    ];
    // A new option is appended to SHARE_SETTINGS: moving one breaks links
    expect(new Set(SHARE_SETTINGS)).toEqual(new Set(options));
    expect(SHARE_SETTINGS).toHaveLength(options.length);
    expect(SHARE_SETTINGS.slice(0, 4)).toEqual([
      "mode:open",
      "mode:standard",
      "mode:inverted",
      "mode:retro",
    ]);
  });

  it("brings back every value of every setting exactly, in the save's key order", () => {
    for (const entry of SHARE_SETTINGS) {
      const [key, text] = [
        entry.slice(0, entry.indexOf(":")),
        entry.slice(entry.indexOf(":") + 1),
      ];
      if (key === "hidden") continue;
      const value =
        text === "true" || text === "false"
          ? text === "true"
          : key.startsWith("crystals")
            ? Number(text)
            : text;
      const settings = { ...base, [key]: value };
      const back = settingsBack(runWith(settings));
      expect(back, entry).toStrictEqual(settings);
      expect(Object.keys(back), entry).toEqual(Object.keys(settings));
    }
  });

  it("brings back each run type, a Mystery run's hidden list in its order, and a glitched logic", () => {
    for (const preset of presets) {
      const settings = preset.settings as unknown as Record<string, unknown>;
      expect(settingsBack(runWith(settings, preset.id)), preset.id).toEqual(
        settings,
      );
    }
    const mystery = getPreset("mystery").settings;
    for (const hidden of [
      [...HIDEABLE],
      [...HIDEABLE].reverse(),
      ["accessibility", "goal"],
      // Present and empty is not absent
      [],
    ]) {
      const settings = {
        ...mystery,
        glitches: "hybrid_major_glitches",
        hidden,
      };
      expect(settingsBack(runWith(settings, "mystery"))).toStrictEqual(
        settings,
      );
    }
    // Every run of a seed carries its hash as it is: no field packs it
    const seeded = withProgress(playOnGameClock(3, randoms()), {
      seed: "kveDj1OeMm",
    });
    const opened = unpackLink(packLink(seeded));
    expect(opened.ok && runOf(opened.save).seed).toBe("kveDj1OeMm");
  });

  it("writes the settings in far fewer characters than their JSON", () => {
    const save = playOnGameClock(271, randoms());
    const link = packLink(save);
    const asJson = JSON.parse(link);
    asJson.progress.settings = JSON.parse(save).progress.settings;
    expect(link.length).toBeLessThan(JSON.stringify(asJson).length - 200);
  });

  it("leaves settings the table does not hold as JSON, the save plain", () => {
    for (const settings of [
      { ...base, keysanity: true },
      { ...base, goal: "no-such-goal" },
      { ...base, crystalsTower: "7" },
      { ...base, crystalsGanon: 8 },
      { ...base, swordless: "false" },
      { ...base, glitches: "none" },
      { ...base, hidden: ["goal", "goal"] },
      { ...base, hidden: ["mode"] },
      { ...base, hidden: "goal" },
      {},
      "open",
    ]) {
      const odd = runWith(settings as Record<string, unknown>);
      expect(packLink(odd), JSON.stringify(settings)).toBe(odd);
    }
  });

  it("refuses settings bytes a writer never writes", () => {
    const link = packLink(runWith(base));
    const at = (entry: string) => {
      const index = SHARE_SETTINGS.indexOf(entry);
      expect(index, entry).toBeGreaterThanOrEqual(0);
      return index;
    };
    const bytes = (...entries: (string | number)[]) => {
      const out = new ByteWriter();
      for (const entry of entries) {
        out.uint(typeof entry === "number" ? entry : at(entry));
      }
      return out.done();
    };

    expect(unpackLink(withBytes(link, "settings", bytes("mode:open"))).ok).toBe(
      true,
    );
    const refused: Record<string, Uint8Array> = {
      "a hidden setting away from its list": bytes(
        "hidden:",
        "mode:open",
        "hidden:goal",
      ),
      "a hidden setting twice": bytes("hidden:", "hidden:goal", "hidden:goal"),
      "a hidden setting with no list": bytes("hidden:goal"),
      "a setting twice": bytes("mode:open", "mode:retro"),
      "a varint cut short": Uint8Array.of(0x80),
      "an entry past the table": bytes(SHARE_SETTINGS.length),
      "the list twice": bytes("hidden:", "hidden:"),
    };
    for (const [name, written] of Object.entries(refused)) {
      expect(unpackLink(withBytes(link, "settings", written)), name).toEqual({
        ok: false,
        reason: MALFORMED,
      });
    }
  });

  it("reads link 3 over its two tables only: a third size there is another tracker's", () => {
    const [recorded] = thirdLayout.links;
    const link = JSON.parse(JSON.stringify(recorded.link));
    expect(link.sizes).toHaveLength(2);
    // Link 3 names two tables: three is another tracker's
    link.sizes = [...link.sizes, SHARE_SETTINGS.length];
    expect(unpackLink(JSON.stringify(link))).toEqual({
      ok: false,
      reason: OTHER_VERSION,
    });
  });
});
