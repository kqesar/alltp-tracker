import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunStore } from "@/games/registry";

const tauri = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: tauri.listen }));

const { attachStream, useStreamStore } = await import("@/desktop/streamTools");
const { setRun } = await import("@/desktop/runFeed");

const SESSION = {
  address: "http://127.0.0.1:23076/",
  moved: false,
  port: 23076,
  token: "abcdefghijklmnopqrstuv",
  viewers: 0,
};

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

const calls = (command: string) =>
  tauri.invoke.mock.calls.filter(([name]) => name === command);

/** The `stream-viewers` handler `attachStream` registered. */
let viewersEvent: (event: { payload: { count: number } }) => void;

const answer = (running: typeof SESSION | null) => {
  tauri.invoke.mockImplementation(async (command: string) => {
    if (command === "stream_start") return SESSION;
    if (command === "stream_state") return running;
    if (command === "stream_new_tokens")
      return { ...SESSION, token: "ZYXWVUTSRQPONMLKJIHGFE" };
    return undefined;
  });
};

beforeEach(async () => {
  vi.useFakeTimers({ now: 9000 });
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("alltp-tracker-state", "run");
  tauri.listen.mockImplementation(async (_name, handler) => {
    viewersEvent = handler;
    return () => {};
  });
  answer(null);
  setRun("alttpr", store);
  await attachStream();
});

afterEach(async () => {
  await useStreamStore.getState().stop();
  useStreamStore.setState(useStreamStore.getInitialState(), true);
  vi.useRealTimers();
});

describe("the stream view in the desktop app", () => {
  it("is off, and publishes nothing, until the app says it runs", () => {
    expect(useStreamStore.getState().session).toBeNull();
    expect(calls("run_publish")).toEqual([]);
    expect(tauri.listen).toHaveBeenCalledWith(
      "stream-viewers",
      expect.any(Function),
    );
  });

  it("starts the stream, then publishes the run at once", async () => {
    await useStreamStore.getState().start();

    expect(useStreamStore.getState().session).toEqual(SESSION);
    expect(calls("run_publish")).toEqual([
      [
        "run_publish",
        {
          game: "alttpr",
          key: "alltp-tracker-state",
          sentAt: 9000,
          value: "run",
        },
      ],
    ]);
  });

  it("picks up the stream the app started by itself at launch", async () => {
    answer({ ...SESSION, viewers: 1 });

    await attachStream();

    expect(useStreamStore.getState().session?.viewers).toBe(1);
    expect(calls("stream_start")).toEqual([]);
    expect(calls("run_publish")).toHaveLength(1);
  });

  it("stops publishing when it stops", async () => {
    await useStreamStore.getState().start();
    await useStreamStore.getState().stop();
    vi.advanceTimersByTime(1000);

    expect(calls("stream_stop")).toHaveLength(1);
    expect(useStreamStore.getState().session).toBeNull();
    expect(listeners.size).toBe(0);
  });

  it("counts the sources, and sends a fresh run to each that joins", async () => {
    await useStreamStore.getState().start();
    vi.advanceTimersByTime(3000);

    viewersEvent({ payload: { count: 1 } });
    expect(useStreamStore.getState().session?.viewers).toBe(1);
    expect(calls("run_publish").map(([, { sentAt }]) => sentAt)).toEqual([
      9000, 12_000,
    ]);

    viewersEvent({ payload: { count: 0 } });
    expect(useStreamStore.getState().session?.viewers).toBe(0);
    expect(calls("run_publish")).toHaveLength(2);
  });

  it("ignores a count while it is off", () => {
    viewersEvent({ payload: { count: 3 } });

    expect(useStreamStore.getState().session).toBeNull();
  });

  it("takes the new addresses the app hands back, and keeps publishing", async () => {
    await useStreamStore.getState().start();

    await useStreamStore.getState().newTokens();

    expect(useStreamStore.getState().session?.token).toBe(
      "ZYXWVUTSRQPONMLKJIHGFE",
    );
    expect(calls("stream_new_tokens")).toHaveLength(1);
    expect(listeners.size).toBe(1);
  });

  it("says why it could not start", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.invoke.mockRejectedValue("Permission denied");

    await useStreamStore.getState().start();

    expect(useStreamStore.getState()).toMatchObject({
      error: "Permission denied",
      pending: false,
      session: null,
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps running, and publishing, when it could not stop", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await useStreamStore.getState().start();
    tauri.invoke.mockRejectedValue("busy");

    await useStreamStore.getState().stop();

    expect(useStreamStore.getState().session).toEqual(SESSION);
    expect(useStreamStore.getState().error).toBe("busy");
    expect(listeners.size).toBe(1);
    warn.mockRestore();
  });

  it("does nothing while a change is under way", async () => {
    let finish: (session: typeof SESSION) => void = () => {};
    tauri.invoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = useStreamStore.getState().start();
    await useStreamStore.getState().start();
    await useStreamStore.getState().stop();
    await useStreamStore.getState().newTokens();

    expect(calls("stream_start")).toHaveLength(1);
    expect(calls("stream_stop")).toEqual([]);
    expect(calls("stream_new_tokens")).toEqual([]);
    finish(SESSION);
    await first;
    // The mock no longer hangs, so the cleanup can stop the stream
    answer(null);
  });
});
