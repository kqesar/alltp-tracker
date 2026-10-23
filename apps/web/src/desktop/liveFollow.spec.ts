import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunStore } from "@/games/registry";

const tauri = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: tauri.listen }));

const { attachRun, useLiveFollowStore } = await import("@/desktop/liveFollow");

const SESSION = {
  lanFound: true,
  port: 23075,
  url: "http://192.168.1.20:23075/?view=follow&token=abcdefghijklmnopqrstuv",
  viewers: 0,
};

/** A store whose run the test changes; it saves as persist does. */
const listeners = new Set<() => void>();
const store: RunStore = {
  persist: {
    getOptions: () => ({ name: "alltp-tracker-sm" }),
    rehydrate: vi.fn(),
  },
  setState: vi.fn(),
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
const change = (value: string) => {
  for (const listener of listeners) listener();
  localStorage.setItem("alltp-tracker-sm", value);
};

/** What the page asked the app, by command. */
const calls = (command: string) =>
  tauri.invoke.mock.calls.filter(([name]) => name === command);

/** The `follow-viewers` handler `attachRun` registered. */
let viewersEvent: (event: { payload: { count: number } }) => void;

const answer = (running: typeof SESSION | null) => {
  tauri.invoke.mockImplementation(async (command: string) => {
    if (command === "follow_start") return SESSION;
    if (command === "follow_state") return running;
    return undefined;
  });
};

beforeEach(async () => {
  vi.useFakeTimers({ now: 9000 });
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("alltp-tracker-sm", "v1");
  tauri.listen.mockImplementation(async (_name, handler) => {
    viewersEvent = handler;
    return () => {};
  });
  answer(null);
  await attachRun("sm", store);
});

afterEach(async () => {
  await useLiveFollowStore.getState().stop();
  useLiveFollowStore.setState(useLiveFollowStore.getInitialState(), true);
  vi.useRealTimers();
});

describe("live follow in the desktop app", () => {
  it("publishes nothing while it is off", () => {
    change("v2");
    vi.advanceTimersByTime(1000);

    expect(calls("follow_publish")).toEqual([]);
    expect(tauri.listen).toHaveBeenCalledWith(
      "follow-viewers",
      expect.any(Function),
    );
  });

  it("starts the relay, then publishes the run at once and after changes", async () => {
    await useLiveFollowStore.getState().start();

    expect(useLiveFollowStore.getState().session).toEqual(SESSION);
    expect(calls("follow_publish")).toEqual([
      [
        "follow_publish",
        { game: "sm", key: "alltp-tracker-sm", sentAt: 9000, value: "v1" },
      ],
    ]);

    change("v2");
    vi.advanceTimersByTime(250);
    expect(calls("follow_publish").map(([, { value }]) => value)).toEqual([
      "v1",
      "v2",
    ]);
  });

  it("stops publishing when it stops", async () => {
    await useLiveFollowStore.getState().start();
    change("v2");
    await useLiveFollowStore.getState().stop();
    vi.advanceTimersByTime(1000);

    expect(calls("follow_stop")).toHaveLength(1);
    expect(useLiveFollowStore.getState().session).toBeNull();
    expect(calls("follow_publish")).toHaveLength(1);
  });

  it("counts the devices, and sends a fresh run to each that joins", async () => {
    await useLiveFollowStore.getState().start();
    vi.advanceTimersByTime(3000);

    viewersEvent({ payload: { count: 1 } });
    expect(useLiveFollowStore.getState().session?.viewers).toBe(1);
    expect(calls("follow_publish").map(([, { sentAt }]) => sentAt)).toEqual([
      9000, 12_000,
    ]);

    // One leaving sends nothing
    viewersEvent({ payload: { count: 0 } });
    expect(useLiveFollowStore.getState().session?.viewers).toBe(0);
    expect(calls("follow_publish")).toHaveLength(2);
  });

  it("says why it could not start", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.invoke.mockRejectedValue("Address in use");

    await useLiveFollowStore.getState().start();

    expect(useLiveFollowStore.getState()).toMatchObject({
      error: "Address in use",
      pending: false,
      session: null,
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("picks up a relay still running when the page loads again", async () => {
    answer({ ...SESSION, viewers: 2 });

    await attachRun("sm", store);

    expect(useLiveFollowStore.getState().session?.viewers).toBe(2);
    expect(calls("follow_start")).toEqual([]);
    expect(calls("follow_publish")).toHaveLength(1);
  });
});
