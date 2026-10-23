import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Publication, publishRun } from "@/follow/publish";
import type { RunStore } from "@/games/registry";

/** A store whose saved run the test writes, and whose changes it fires. */
const fakeStore = () => {
  const listeners = new Set<() => void>();
  const saved = new Map<string, string>();
  const store: RunStore = {
    persist: {
      getOptions: () => ({ name: "alltp-tracker-sm" }),
      rehydrate: vi.fn(),
    },
    // As persist does: saving the run as it stands
    setState: vi.fn(() => {
      saved.set("alltp-tracker-sm", "fresh");
      for (const listener of listeners) listener();
    }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    change: (value: string) => {
      for (const listener of listeners) listener();
      saved.set("alltp-tracker-sm", value);
    },
    listeners,
    read: (key: string) => saved.get(key) ?? null,
    saved,
    store,
  };
};

describe("publishRun", () => {
  let sent: Publication[];
  const send = (publication: Publication) => sent.push(publication);

  beforeEach(() => {
    vi.useFakeTimers({ now: 5000 });
    sent = [];
  });
  afterEach(() => vi.useRealTimers());

  it("publishes the saved run at once", () => {
    const run = fakeStore();
    run.saved.set("alltp-tracker-sm", "v1");

    publishRun({ game: "sm", read: run.read, send, store: run.store });

    expect(sent).toEqual([
      { game: "sm", key: "alltp-tracker-sm", sentAt: 5000, value: "v1" },
    ]);
  });

  it("saves a run never saved before publishing it", () => {
    const run = fakeStore();

    publishRun({ game: "sm", read: run.read, send, store: run.store });

    expect(run.store.setState).toHaveBeenCalledWith({});
    expect(sent.map(({ value }) => value)).toEqual(["fresh"]);
  });

  it("sends a burst of changes once, 250 ms after the first, as last saved", () => {
    const run = fakeStore();
    run.saved.set("alltp-tracker-sm", "v1");
    publishRun({ game: "sm", read: run.read, send, store: run.store });

    run.change("v2");
    vi.advanceTimersByTime(100);
    run.change("v3");
    vi.advanceTimersByTime(149);
    expect(sent).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(sent.map(({ value }) => value)).toEqual(["v1", "v3"]);
    expect(sent[1].sentAt).toBe(5250);

    // The next change waits again
    run.change("v4");
    vi.advanceTimersByTime(250);
    expect(sent.map(({ value }) => value)).toEqual(["v1", "v3", "v4"]);
  });

  it("does not send a run unchanged, unless asked to", () => {
    const run = fakeStore();
    run.saved.set("alltp-tracker-sm", "v1");
    const publisher = publishRun({
      game: "sm",
      read: run.read,
      send,
      store: run.store,
    });

    // A change the save does not show (the undo history)
    run.change("v1");
    vi.advanceTimersByTime(250);
    expect(sent).toHaveLength(1);

    vi.advanceTimersByTime(750);
    publisher.now();
    expect(sent.map(({ sentAt }) => sentAt)).toEqual([5000, 6000]);
  });

  it("sends nothing more once stopped, not even a change in flight", () => {
    const run = fakeStore();
    run.saved.set("alltp-tracker-sm", "v1");
    const publisher = publishRun({
      game: "sm",
      read: run.read,
      send,
      store: run.store,
    });

    run.change("v2");
    publisher.stop();
    vi.advanceTimersByTime(1000);
    run.change("v3");
    vi.advanceTimersByTime(1000);

    expect(sent).toHaveLength(1);
    expect(run.listeners.size).toBe(0);
  });

  it("skips a run storage cannot read", () => {
    const run = fakeStore();
    publishRun({
      game: "sm",
      read: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      send,
      store: run.store,
    });

    expect(sent).toEqual([]);
  });
});
