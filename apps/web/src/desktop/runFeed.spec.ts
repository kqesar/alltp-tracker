import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunStore } from "@/games/registry";

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));

const { holdRun, publishNow, releaseRun, setRun } = await import(
  "@/desktop/runFeed"
);

/** A store whose run the test changes; it saves as persist does. */
const listeners = new Set<() => void>();
const store: RunStore = {
  persist: {
    getOptions: () => ({ name: "alltp-tracker-state" }),
    rehydrate: vi.fn(),
  },
  setState: vi.fn(),
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
const change = (value: string) => {
  localStorage.setItem("alltp-tracker-state", value);
  for (const listener of listeners) listener();
};

const published = () =>
  tauri.invoke.mock.calls.filter(([name]) => name === "run_publish");

beforeEach(() => {
  vi.useFakeTimers({ now: 5000 });
  vi.clearAllMocks();
  tauri.invoke.mockResolvedValue(undefined);
  localStorage.clear();
  localStorage.setItem("alltp-tracker-state", "v1");
});

afterEach(() => {
  releaseRun("follow");
  releaseRun("stream");
  vi.useRealTimers();
});

describe("the run feed", () => {
  it("publishes nothing until a server needs the run", () => {
    setRun("alttpr", store);
    change("v2");
    vi.advanceTimersByTime(1000);

    expect(published()).toEqual([]);
    expect(listeners.size).toBe(0);
  });

  it("publishes the run at once to the app, whichever server holds it", () => {
    setRun("alttpr", store);

    holdRun("stream");

    expect(published()).toEqual([
      [
        "run_publish",
        {
          game: "alttpr",
          key: "alltp-tracker-state",
          sentAt: 5000,
          value: "v1",
        },
      ],
    ]);
  });

  it("runs one publisher for both holders, and stops with the last", () => {
    setRun("alttpr", store);
    holdRun("follow");
    holdRun("stream");
    // One subscription, one publication: not one per holder
    expect(listeners.size).toBe(1);
    expect(published()).toHaveLength(1);

    change("v2");
    vi.advanceTimersByTime(250);
    expect(published()).toHaveLength(2);

    // Live follow stops: the stream still gets the run
    releaseRun("follow");
    expect(listeners.size).toBe(1);
    change("v3");
    vi.advanceTimersByTime(250);
    expect(published().map(([, { value }]) => value)).toEqual([
      "v1",
      "v2",
      "v3",
    ]);

    releaseRun("stream");
    expect(listeners.size).toBe(0);
    change("v4");
    vi.advanceTimersByTime(1000);
    expect(published()).toHaveLength(3);
  });

  it("holds the same server twice as once", () => {
    setRun("alttpr", store);
    holdRun("stream");
    holdRun("stream");
    expect(listeners.size).toBe(1);

    releaseRun("stream");
    expect(listeners.size).toBe(0);
  });

  it("starts when the run arrives after a server asked for it", async () => {
    // A feed no run was given yet
    vi.resetModules();
    const fresh = await import("@/desktop/runFeed");
    fresh.holdRun("stream");
    expect(published()).toEqual([]);

    fresh.setRun("alttpr", store);

    expect(published()).toHaveLength(1);
    fresh.releaseRun("stream");
  });

  it("publishes again, freshly stamped, when asked", () => {
    setRun("alttpr", store);
    holdRun("stream");
    vi.advanceTimersByTime(3000);

    publishNow();

    expect(published().map(([, { sentAt }]) => sentAt)).toEqual([5000, 8000]);
  });

  it("asks for nothing when nobody holds the run", () => {
    expect(() => publishNow()).not.toThrow();
  });

  it("says when the app refused a run, and carries on", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.invoke.mockRejectedValue("the run is over 1048576 bytes");
    setRun("alttpr", store);

    holdRun("stream");
    await vi.advanceTimersByTimeAsync(0);

    expect(warn).toHaveBeenCalledWith(
      "Could not publish the run:",
      "the run is over 1048576 bytes",
    );
    warn.mockRestore();
  });
});
