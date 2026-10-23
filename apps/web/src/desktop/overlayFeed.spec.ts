import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OverlayReading, OverlaySource } from "@/overlay/protocol";

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));

const reading = (level: number): OverlayReading => ({
  fresh: level === 0,
  state: {
    game: "alttpr",
    goMode: null,
    items: [{ id: "hookshot", level, max: 1, name: "Hookshot" }],
    objectives: [],
    timer: null,
  },
});

/** The game's whitelist, standing in for the real chunk. */
const listeners = new Set<() => void>();
let level = 0;
const source: OverlaySource = {
  read: () => reading(level),
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
vi.mock("@/games/alttpr/overlay", () => ({ overlaySource: source }));

let feed: typeof import("@/desktop/overlayFeed");
const { holdOverlay, releaseOverlay, setOverlayGame } = {
  holdOverlay: () => feed.holdOverlay(),
  releaseOverlay: () => feed.releaseOverlay(),
  setOverlayGame: (id: "alttpr") => feed.setOverlayGame(id),
};

const published = () =>
  tauri.invoke.mock.calls.filter(([name]) => name === "overlay_publish");

/** Lets the lazy import of the game's whitelist settle. */
const loaded = () => vi.advanceTimersByTimeAsync(0);

beforeEach(async () => {
  // The feed keeps the game and the hold in the module: a fresh one per test
  vi.resetModules();
  feed = await import("@/desktop/overlayFeed");
  vi.useFakeTimers({ now: 5_000 });
  vi.clearAllMocks();
  tauri.invoke.mockResolvedValue(undefined);
  level = 0;
});

afterEach(async () => {
  releaseOverlay();
  await loaded();
  vi.useRealTimers();
});

describe("the overlay feed", () => {
  it("has a whitelist for each game", () => {
    expect(Object.keys(feed.OVERLAY_SOURCES).sort()).toEqual([
      "alttpr",
      "sm",
      "smz3",
    ]);
  });

  it("publishes nothing until the stream needs it", async () => {
    setOverlayGame("alttpr");
    await loaded();
    level = 1;
    for (const listener of listeners) listener();
    vi.advanceTimersByTime(1_000);

    expect(published()).toEqual([]);
  });

  it("publishes the state at once, then each change, as text", async () => {
    setOverlayGame("alttpr");
    holdOverlay();
    await loaded();

    expect(published()).toHaveLength(1);
    const [, first] = published()[0] ?? [];
    expect(JSON.parse(first.state).items[0].level).toBe(0);
    expect(first.events).toBe("[]");

    level = 1;
    for (const listener of listeners) listener();
    vi.advanceTimersByTime(300);

    expect(published()).toHaveLength(2);
    const [, second] = published()[1] ?? [];
    expect(JSON.parse(second.events)).toMatchObject([
      { id: "hookshot", level: 1, previous: 0, type: "item" },
    ]);
  });

  it("waits for the game when the stream was on first", async () => {
    holdOverlay();
    await loaded();
    expect(published()).toEqual([]);

    setOverlayGame("alttpr");
    await loaded();
    expect(published()).toHaveLength(1);
  });

  it("holds once, however many times it is asked", async () => {
    setOverlayGame("alttpr");
    holdOverlay();
    holdOverlay();
    await loaded();

    expect(published()).toHaveLength(1);
    expect(listeners.size).toBe(1);
  });

  it("stops: nothing is sent, and the run is no longer listened to", async () => {
    setOverlayGame("alttpr");
    holdOverlay();
    await loaded();

    releaseOverlay();
    level = 1;
    for (const listener of listeners) listener();
    vi.advanceTimersByTime(1_000);

    expect(published()).toHaveLength(1);
    expect(listeners.size).toBe(0);
  });

  it("drops a whitelist that loads after the stream stopped", async () => {
    setOverlayGame("alttpr");
    holdOverlay();
    releaseOverlay();
    await loaded();

    expect(published()).toEqual([]);
    expect(listeners.size).toBe(0);
    // And starts again
    holdOverlay();
    await loaded();
    expect(published()).toHaveLength(1);
  });

  it("goes on after a publication the app refused", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.invoke.mockRejectedValue("the state is over 65536 bytes");
    setOverlayGame("alttpr");
    holdOverlay();
    await loaded();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
