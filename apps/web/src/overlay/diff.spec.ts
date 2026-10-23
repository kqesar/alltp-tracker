import { describe, expect, it } from "vitest";
import { diffOverlay, timerReadingAt } from "@/overlay/diff";
import type {
  OverlayGoMode,
  OverlayReading,
  OverlayTimer,
} from "@/overlay/protocol";

const IDLE: OverlayTimer = { elapsedMs: 0, startedAt: null, state: "idle" };

/** A reading of two items and two objectives, changed as the test says. */
const reading = ({
  fresh = false,
  game = "alttpr",
  goMode = null,
  hookshot = 0,
  sword = 0,
  boss0 = false,
  boss1 = false,
  timer = IDLE as OverlayTimer | null,
}: {
  fresh?: boolean;
  game?: "alttpr" | "sm";
  goMode?: OverlayGoMode | null;
  hookshot?: number;
  sword?: number;
  boss0?: boolean;
  boss1?: boolean;
  timer?: OverlayTimer | null;
} = {}): OverlayReading => ({
  fresh,
  state: {
    game,
    goMode,
    items: [
      { id: "hookshot", level: hookshot, max: 1, name: "Hookshot" },
      { id: "sword", level: sword, max: 4, name: "Sword" },
    ],
    objectives: [
      { done: boss0, id: "boss0", ms: null, name: "Eastern Palace" },
      { done: boss1, id: "boss1", ms: 7_000, name: "Desert Palace" },
    ],
    timer,
  },
});

const running = (startedAt: number, elapsedMs = 0): OverlayTimer => ({
  elapsedMs,
  startedAt,
  state: "running",
});

describe("diffOverlay", () => {
  it("says nothing on the first reading", () => {
    expect(diffOverlay(null, reading({ hookshot: 1 }), 0)).toEqual([]);
  });

  it("says nothing when the game changed", () => {
    expect(
      diffOverlay(reading({ game: "sm" }), reading({ hookshot: 1 }), 0),
    ).toEqual([]);
  });

  it("says nothing when nothing changed", () => {
    expect(diffOverlay(reading(), reading(), 0)).toEqual([]);
  });

  it("gives one event per item that changed, with its levels", () => {
    const events = diffOverlay(
      reading({ sword: 1 }),
      reading({ hookshot: 1, sword: 3 }),
      0,
    );
    expect(events).toEqual([
      {
        id: "hookshot",
        level: 1,
        ms: null,
        name: "Hookshot",
        previous: 0,
        type: "item",
      },
      {
        id: "sword",
        level: 3,
        ms: null,
        name: "Sword",
        previous: 1,
        type: "item",
      },
    ]);
  });

  it("gives a loss as an event too", () => {
    const [event] = diffOverlay(reading({ hookshot: 1 }), reading(), 0);
    expect(event).toMatchObject({ level: 0, previous: 1, type: "item" });
  });

  it("dates an item with the run time while the timer runs", () => {
    const timer = running(10_000, 5_000);
    const [event] = diffOverlay(
      reading({ timer }),
      reading({ hookshot: 1, timer }),
      12_500,
    );
    expect(event).toMatchObject({ id: "hookshot", ms: 7_500 });
  });

  it("dates an item at the paused time, and with none before the timer", () => {
    const paused: OverlayTimer = {
      elapsedMs: 4_000,
      startedAt: null,
      state: "paused",
    };
    expect(
      diffOverlay(
        reading({ timer: paused }),
        reading({ hookshot: 1, timer: paused }),
        99,
      )[0],
    ).toMatchObject({ ms: 4_000 });
    expect(
      diffOverlay(reading(), reading({ hookshot: 1 }), 99)[0],
    ).toMatchObject({ ms: null });
    expect(
      diffOverlay(
        reading({ timer: null }),
        reading({ hookshot: 1, timer: null }),
        99,
      )[0],
    ).toMatchObject({ ms: null });
  });

  it("gives an objective done, with the time its split has", () => {
    expect(
      diffOverlay(reading(), reading({ boss0: true, boss1: true }), 0),
    ).toEqual([
      {
        done: true,
        id: "boss0",
        ms: null,
        name: "Eastern Palace",
        type: "objective",
      },
      {
        done: true,
        id: "boss1",
        ms: 7_000,
        name: "Desert Palace",
        type: "objective",
      },
    ]);
  });

  it("dates an objective with no split time with the run's", () => {
    const timer = running(1_000);
    const [event] = diffOverlay(
      reading({ timer }),
      reading({ boss0: true, timer }),
      4_000,
    );
    expect(event).toMatchObject({ id: "boss0", ms: 3_000 });
  });

  it("gives an objective undone, with no time", () => {
    const [event] = diffOverlay(reading({ boss1: true }), reading(), 0);
    expect(event).toMatchObject({ done: false, id: "boss1", ms: 7_000 });
  });

  it("orders the items, then the objectives, the timer, the go mode", () => {
    const events = diffOverlay(
      reading({ goMode: "no" }),
      reading({
        boss0: true,
        goMode: "yes",
        hookshot: 1,
        timer: running(1),
      }),
      2,
    );
    expect(events.map(({ type }) => type)).toEqual([
      "item",
      "objective",
      "timer",
      "goMode",
    ]);
  });

  describe("the timer", () => {
    const action = (before: OverlayTimer | null, after: OverlayTimer | null) =>
      diffOverlay(reading({ timer: before }), reading({ timer: after }), 0);

    const paused: OverlayTimer = {
      elapsedMs: 3_000,
      startedAt: null,
      state: "paused",
    };
    const finished: OverlayTimer = {
      elapsedMs: 9_000,
      startedAt: null,
      state: "finished",
    };

    it("starts, pauses and resumes", () => {
      expect(action(IDLE, running(1))).toEqual([
        { action: "start", type: "timer" },
      ]);
      expect(action(running(1), paused)).toEqual([
        { action: "pause", type: "timer" },
      ]);
      expect(action(paused, running(5, 3_000))).toEqual([
        { action: "resume", type: "timer" },
      ]);
    });

    it("finishes, from running or from idle", () => {
      expect(action(running(1), finished)).toEqual([
        { action: "finish", type: "timer" },
      ]);
      expect(action(IDLE, finished)).toEqual([
        { action: "finish", type: "timer" },
      ]);
    });

    it("resets, from anywhere", () => {
      for (const before of [running(1), paused, finished]) {
        expect(action(before, IDLE)).toEqual([
          { action: "reset", type: "timer" },
        ]);
      }
    });

    it("says nothing while the state is the same, or the game has no timer", () => {
      expect(action(running(1), running(1))).toEqual([]);
      expect(action(running(1), running(50, 20))).toEqual([]);
      expect(action(null, null)).toEqual([]);
      expect(action(null, running(1))).toEqual([]);
    });
  });

  describe("the go mode", () => {
    it("gives the change with what it was", () => {
      expect(
        diffOverlay(reading({ goMode: "no" }), reading({ goMode: "maybe" }), 0),
      ).toEqual([{ goMode: "maybe", previous: "no", type: "goMode" }]);
    });

    it("gives its loss and its arrival, null on one side", () => {
      expect(
        diffOverlay(reading({ goMode: "yes" }), reading({ goMode: null }), 0),
      ).toEqual([{ goMode: null, previous: "yes", type: "goMode" }]);
      expect(
        diffOverlay(reading({ goMode: null }), reading({ goMode: "no" }), 0),
      ).toEqual([{ goMode: "no", previous: null, type: "goMode" }]);
    });
  });

  describe("a reset", () => {
    const loaded = reading({ boss0: true, hookshot: 1, sword: 2 });

    it("is one event, nothing else, when a run falls back to its start", () => {
      expect(diffOverlay(loaded, reading({ fresh: true }), 0)).toEqual([
        { type: "reset" },
      ]);
    });

    it("counts the timer going back to idle among what changed", () => {
      const before = reading({ hookshot: 1, timer: running(1) });
      expect(diffOverlay(before, reading({ fresh: true }), 5)).toEqual([
        { type: "reset" },
      ]);
    });

    it("is not one when a single thing is undone to the start", () => {
      const events = diffOverlay(
        reading({ hookshot: 1 }),
        reading({ fresh: true }),
        0,
      );
      expect(events).toEqual([
        {
          id: "hookshot",
          level: 0,
          ms: null,
          name: "Hookshot",
          previous: 1,
          type: "item",
        },
      ]);
    });

    it("is not one for a run that was fresh already", () => {
      expect(
        diffOverlay(
          reading({ fresh: true }),
          reading({ fresh: true, hookshot: 1 }),
          0,
        ).map(({ type }) => type),
      ).toEqual(["item"]);
    });

    it("is not one for a run that is not fresh after it (a starting item kept)", () => {
      const events = diffOverlay(loaded, reading({ sword: 1 }), 0);
      expect(events.map(({ type }) => type)).toEqual([
        "item",
        "item",
        "objective",
      ]);
    });
  });
});

describe("timerReadingAt", () => {
  it("is the time shown, or null before the timer started", () => {
    expect(timerReadingAt(null, 5)).toBeNull();
    expect(timerReadingAt(IDLE, 5)).toBeNull();
    expect(timerReadingAt(running(1_000, 500), 3_000)).toBe(2_500);
    expect(
      timerReadingAt(
        { elapsedMs: 4_000, startedAt: null, state: "finished" },
        9,
      ),
    ).toBe(4_000);
  });

  it("never counts a clock that went back", () => {
    expect(timerReadingAt(running(5_000, 100), 1_000)).toBe(100);
  });
});
