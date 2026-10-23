import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OverlayPublication,
  OverlayReading,
  OverlaySource,
} from "@/overlay/protocol";
import { OVERLAY_DELAY_MS, publishOverlay } from "@/overlay/publish";

const readingOf = (hookshot: number, game: "alttpr" | "sm" = "alttpr") =>
  ({
    fresh: hookshot === 0,
    state: {
      game,
      goMode: null,
      items: [{ id: "hookshot", level: hookshot, max: 1, name: "Hookshot" }],
      objectives: [],
      timer: null,
    },
  }) satisfies OverlayReading;

/** A source whose run the test changes, firing its listeners as a store does. */
const fakeSource = (first: OverlayReading) => {
  const listeners = new Set<() => void>();
  let current = first;
  const source: OverlaySource = {
    read: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    change: (next: OverlayReading) => {
      current = next;
      for (const listener of listeners) listener();
    },
    listeners,
    source,
  };
};

describe("publishOverlay", () => {
  let sent: OverlayPublication[];
  const send = (publication: OverlayPublication) => sent.push(publication);
  const events = () => sent.map(({ events: json }) => JSON.parse(json));

  beforeEach(() => {
    vi.useFakeTimers({ now: 5_000 });
    sent = [];
  });
  afterEach(() => vi.useRealTimers());

  it("publishes the state at once, with no events", () => {
    const run = fakeSource(readingOf(0));

    publishOverlay({ send, source: run.source });

    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]?.state ?? "").items[0].level).toBe(0);
    expect(events()).toEqual([[]]);
  });

  it("publishes a change after the wait, with its event", () => {
    const run = fakeSource(readingOf(0));
    publishOverlay({ send, source: run.source });

    run.change(readingOf(1));
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(OVERLAY_DELAY_MS);

    expect(sent).toHaveLength(2);
    expect(events()[1]).toEqual([
      {
        id: "hookshot",
        level: 1,
        ms: null,
        name: "Hookshot",
        previous: 0,
        type: "item",
      },
    ]);
  });

  it("sends a burst once, with the events since the last publication", () => {
    const run = fakeSource(readingOf(0));
    publishOverlay({ send, source: run.source });

    run.change(readingOf(1));
    vi.advanceTimersByTime(100);
    run.change(readingOf(0));
    run.change(readingOf(1));
    vi.advanceTimersByTime(OVERLAY_DELAY_MS);

    expect(sent).toHaveLength(2);
    expect(events()[1]).toHaveLength(1);
  });

  it("does not send a change that leaves the state as it was", () => {
    const run = fakeSource(readingOf(0));
    publishOverlay({ send, source: run.source });

    run.change(readingOf(1));
    vi.advanceTimersByTime(50);
    run.change(readingOf(0));
    vi.advanceTimersByTime(OVERLAY_DELAY_MS);

    expect(sent).toHaveLength(1);
  });

  it("sends the first reading of a run of another game with no events", () => {
    const run = fakeSource(readingOf(1));
    publishOverlay({ send, source: run.source });
    run.change(readingOf(1, "sm"));
    vi.advanceTimersByTime(OVERLAY_DELAY_MS);

    expect(events()[1]).toEqual([]);
  });

  it("stops: nothing is sent, and the store is no longer listened to", () => {
    const run = fakeSource(readingOf(0));
    const stop = publishOverlay({ send, source: run.source });
    run.change(readingOf(1));

    stop();
    vi.advanceTimersByTime(1_000);

    expect(sent).toHaveLength(1);
    expect(run.listeners.size).toBe(0);
  });

  it("dates what is found with the clock it is given", () => {
    const run = fakeSource({
      ...readingOf(0),
      state: {
        ...readingOf(0).state,
        timer: { elapsedMs: 0, startedAt: 1_000, state: "running" },
      },
    });
    publishOverlay({ now: () => 4_000, send, source: run.source });
    const next = readingOf(1);
    run.change({
      ...next,
      state: {
        ...next.state,
        timer: { elapsedMs: 0, startedAt: 1_000, state: "running" },
      },
    });
    vi.advanceTimersByTime(OVERLAY_DELAY_MS);

    expect(events()[1][0].ms).toBe(3_000);
  });

  it("goes on after a reading that failed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const run = fakeSource(readingOf(0));
    let broken = false;
    const source: OverlaySource = {
      read: () => {
        if (broken) throw new Error("not now");
        return run.source.read();
      },
      subscribe: run.source.subscribe,
    };
    publishOverlay({ send, source });

    broken = true;
    run.change(readingOf(1));
    vi.advanceTimersByTime(OVERLAY_DELAY_MS);
    expect(sent).toHaveLength(1);
    expect(warn).toHaveBeenCalled();

    broken = false;
    run.change(readingOf(1));
    vi.advanceTimersByTime(OVERLAY_DELAY_MS);
    expect(sent).toHaveLength(2);
    warn.mockRestore();
  });
});
