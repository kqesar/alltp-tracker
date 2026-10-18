import { describe, expect, it } from "vitest";
import { items as freshItems, type ItemState } from "@/data/items";
import {
  isStamp,
  isTimelineKey,
  type Stamp,
  stampOf,
  stampTimeline,
  type Timeline,
} from "@/logic/timeline";
import { IDLE_TIMER, pauseTimer, startTimer } from "@/logic/timer";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const STAMP: Stamp = { at: T0 + 60_000, ms: 60_000 };

const run = (
  items: Record<string, boolean | number> = {},
  checked: Record<string, true> = {},
) => ({ checked, items: { ...freshItems, ...items } as ItemState });

describe("stampOf", () => {
  it("reads the timer, or none before it started", () => {
    expect(stampOf(IDLE_TIMER, T0)).toEqual({ at: T0, ms: null });
    const running = startTimer(IDLE_TIMER, T0);
    expect(stampOf(running, T0 + 5000)).toEqual({ at: T0 + 5000, ms: 5000 });
    // A paused timer gives its pause's time
    const paused = pauseTimer(running, T0 + 5000);
    expect(stampOf(paused, T0 + 9000)).toEqual({ at: T0 + 9000, ms: 5000 });
  });
});

describe("stampTimeline", () => {
  it("stamps an item found, and drops it once it is not held", () => {
    const found = stampTimeline({}, run(), run({ hookshot: true }), STAMP);
    expect(found).toEqual({ "item:hookshot": STAMP });

    const later: Stamp = { at: STAMP.at + 1, ms: 1 };
    expect(stampTimeline(found, run({ hookshot: true }), run(), later)).toEqual(
      {},
    );
  });

  it("stamps each level a progressive item gains, and drops those it loses", () => {
    const two = stampTimeline({}, run(), run({ sword: 2 }), STAMP);
    expect(two).toEqual({ "item:sword:1": STAMP, "item:sword:2": STAMP });

    // A click past the top wraps to none: every level goes
    expect(
      stampTimeline(two, run({ sword: 2 }), run({ sword: 0 }), STAMP),
    ).toEqual({});
    // A boss's 2 is beaten, its 1 alive: only the 2 is a find
    expect(stampTimeline({}, run(), run({ boss3: 2 }), STAMP)).toEqual({
      "item:boss3:2": STAMP,
    });
  });

  it("stamps each bit that is an item: the bow's and the boomerangs'", () => {
    // 2 is the bow alone: no silver arrows yet
    const bow = stampTimeline({}, run(), run({ bow: 2 }), STAMP);
    expect(bow).toEqual({ "item:bow:2": STAMP });

    const later: Stamp = { at: STAMP.at + 1000, ms: 61_000 };
    const both = stampTimeline(bow, run({ bow: 2 }), run({ bow: 3 }), later);
    expect(both).toEqual({ "item:bow:1": later, "item:bow:2": STAMP });
    // Down to the silver arrows alone: the bow goes, the arrows stay
    expect(
      stampTimeline(both, run({ bow: 3 }), run({ bow: 1 }), later),
    ).toEqual({ "item:bow:1": later });
    expect(stampTimeline({}, run(), run({ boomerang: 2 }), STAMP)).toEqual({
      "item:boomerang:2": STAMP,
    });
  });

  it("keeps a level's first time when a higher one comes", () => {
    const first = stampTimeline({}, run(), run({ glove: 1 }), STAMP);
    const later: Stamp = { at: STAMP.at + 1000, ms: 61_000 };
    expect(
      stampTimeline(first, run({ glove: 1 }), run({ glove: 2 }), later),
    ).toEqual({ "item:glove:1": STAMP, "item:glove:2": later });
  });

  it("stamps a location checked, and drops it once unchecked", () => {
    const checked = stampTimeline(
      {},
      run(),
      run({}, { "kings-tomb": true }),
      STAMP,
    );
    expect(checked).toEqual({ "check:kings-tomb": STAMP });
    expect(
      stampTimeline(checked, run({}, { "kings-tomb": true }), run(), STAMP),
    ).toEqual({});
  });

  it("takes an item the run before lacked (an older save's) as not held", () => {
    const { hookshot, sword, ...older } = freshItems;
    const before = { checked: {}, items: older as ItemState };
    expect(
      stampTimeline({}, before, run({ hookshot, sword: 1 }), STAMP),
    ).toEqual({ "item:sword:1": STAMP });
  });

  it("dates no counter, picked prize or spacer", () => {
    const before = run();
    const after = run({ blank: true, chest3: 1, reward3: 2 });
    expect(stampTimeline({}, before, after, STAMP)).toEqual({});
  });

  it("gives back the same timeline when nothing dated changed", () => {
    const timeline: Timeline = { "item:hookshot": STAMP };
    const same = run({ hookshot: true });
    expect(stampTimeline(timeline, same, same, STAMP)).toBe(timeline);
    expect(
      stampTimeline(timeline, same, run({ chest0: 1, hookshot: true }), STAMP),
    ).toBe(timeline);
  });
});

describe("isTimelineKey", () => {
  it.each([
    "item:hookshot",
    "item:sword:4",
    "item:boss0:2",
    "item:agahnim2:1",
    "item:bow:1",
    "item:bow:2",
    "check:kings-tomb",
  ])("knows %s", (key) => {
    expect(isTimelineKey(key)).toBe(true);
  });

  it.each([
    // A boolean item has no level, a progressive one needs one in range
    "item:hookshot:1",
    "item:sword",
    "item:sword:5",
    "item:sword:0",
    // The bow's bits are 1 and 2: its 3 is both, never one find
    "item:bow:3",
    // Not finds, or not items at all
    "item:chest3:1",
    "item:reward3:2",
    "item:blank",
    "item:constructor",
    "item:hammer2",
    "check:nowhere",
    "kings-tomb",
  ])("refuses %s", (key) => {
    expect(isTimelineKey(key)).toBe(false);
  });
});

describe("isStamp", () => {
  it("takes an instant and a timer reading, or none", () => {
    expect(isStamp({ at: T0, ms: 0 })).toBe(true);
    expect(isStamp({ at: T0, ms: null })).toBe(true);
  });

  it.each([
    [null],
    [T0],
    [{ at: T0 }],
    [{ at: -1, ms: null }],
    [{ at: T0, ms: -5 }],
    [{ at: Number.NaN, ms: null }],
    [{ at: "today", ms: null }],
  ])("refuses %j", (value) => {
    expect(isStamp(value)).toBe(false);
  });
});
