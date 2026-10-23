import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunStore } from "@/games/registry";

const tauri = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: tauri.listen }));

const overlay = vi.hoisted(() => ({ hold: vi.fn(), release: vi.fn() }));
vi.mock("@/desktop/overlayFeed", () => ({
  holdOverlay: overlay.hold,
  releaseOverlay: overlay.release,
}));

const { attachStream, useStreamStore } = await import("@/desktop/streamTools");
const { setRun } = await import("@/desktop/runFeed");

const SESSION = {
  address: "http://127.0.0.1:23076/",
  apiToken: "ABCDEFGHIJKLMNOPQRSTUV",
  lan: false,
  lanAddress: null,
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
/** The `stream-started` handler: the app opened the stream after launch. */
let startedEvent: (event: { payload: typeof SESSION }) => void;

const answer = (running: typeof SESSION | null) => {
  tauri.invoke.mockImplementation(async (command: string) => {
    if (command === "stream_start") return SESSION;
    if (command === "stream_state") return running;
    if (command === "stream_set_lan") {
      return {
        ...SESSION,
        lan: true,
        lanAddress: "http://192.168.1.20:23076/",
      };
    }
    if (command === "stream_new_tokens")
      return { ...SESSION, token: "ZYXWVUTSRQPONMLKJIHGFE" };
    return undefined;
  });
};

beforeEach(async () => {
  vi.useFakeTimers({ now: 9000 });
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("alltp-tracker-state", "run");
  tauri.listen.mockImplementation(async (name, handler) => {
    if (name === "stream-started") startedEvent = handler;
    else viewersEvent = handler;
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

  it("feeds the overlay API while the stream runs, and only then", async () => {
    expect(overlay.hold).not.toHaveBeenCalled();

    await useStreamStore.getState().start();
    expect(overlay.hold).toHaveBeenCalledTimes(1);
    expect(overlay.release).not.toHaveBeenCalled();

    await useStreamStore.getState().stop();
    expect(overlay.release).toHaveBeenCalled();
  });

  it("feeds the overlay API for a stream the app started by itself", async () => {
    answer(SESSION);
    await attachStream();
    expect(overlay.hold).toHaveBeenCalled();
  });

  it("stops feeding the overlay API when a change answers that the stream is off", async () => {
    await useStreamStore.getState().start();
    overlay.release.mockClear();
    tauri.invoke.mockImplementation(async () => null);

    await useStreamStore.getState().setLan(true);

    expect(overlay.release).toHaveBeenCalled();
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

  describe("after a command failed", () => {
    const warn = vi.spyOn(console, "warn");
    beforeEach(() => warn.mockImplementation(() => {}));
    afterEach(() => warn.mockReset());

    /** The app refuses `command`, and says `state` when asked how it stands. */
    const refuse = (command: string, state: typeof SESSION | null) =>
      tauri.invoke.mockImplementation(async (name: string) => {
        if (name === command) throw "could not open the port";
        if (name === "stream_state") return state;
        return undefined;
      });

    it("asks the app, so a restart that could not reopen shows the stream off", async () => {
      await useStreamStore.getState().start();
      expect(listeners.size).toBe(1);
      refuse("stream_new_tokens", null);

      await useStreamStore.getState().newTokens();

      expect(useStreamStore.getState()).toMatchObject({
        error: "could not open the port",
        pending: false,
        session: null,
      });
      // Nothing runs, so nothing is published
      expect(listeners.size).toBe(0);
    });

    it("shows the stream on when the app says it still runs", async () => {
      refuse("stream_start", { ...SESSION, viewers: 2 });

      await useStreamStore.getState().start();

      expect(useStreamStore.getState()).toMatchObject({
        error: "could not open the port",
        session: { viewers: 2 },
      });
      expect(listeners.size).toBe(1);
    });

    it("does the same after a change of who can reach it", async () => {
      await useStreamStore.getState().start();
      refuse("stream_set_lan", null);

      await useStreamStore.getState().setLan(true);

      expect(useStreamStore.getState().session).toBeNull();
      expect(useStreamStore.getState().error).toBe("could not open the port");
      expect(listeners.size).toBe(0);
    });

    it("shows the stream off when a stop failed and the app says it is off", async () => {
      await useStreamStore.getState().start();
      refuse("stream_stop", null);

      await useStreamStore.getState().stop();

      expect(useStreamStore.getState().session).toBeNull();
      expect(listeners.size).toBe(0);
    });
  });

  it("allows the network, taking the address the app gives for it", async () => {
    await useStreamStore.getState().start();

    await useStreamStore.getState().setLan(true);

    expect(tauri.invoke).toHaveBeenCalledWith("stream_set_lan", { lan: true });
    expect(useStreamStore.getState().session).toMatchObject({
      lan: true,
      lanAddress: "http://192.168.1.20:23076/",
    });
    expect(listeners.size).toBe(1);
  });

  describe("at launch", () => {
    it("learns of a stream the app opened after the page asked", async () => {
      // The page asked first and the app answered "off": it then opens it
      expect(useStreamStore.getState().session).toBeNull();

      startedEvent({ payload: { ...SESSION } });

      expect(useStreamStore.getState().session).toEqual(SESSION);
      expect(calls("run_publish")).toHaveLength(1);
      expect(listeners.size).toBe(1);
    });

    it("takes the same session once when both the answer and the event bring it", async () => {
      answer(SESSION);
      await attachStream();
      expect(calls("run_publish")).toHaveLength(1);

      startedEvent({ payload: { ...SESSION } });

      expect(calls("run_publish")).toHaveLength(1);
      expect(listeners.size).toBe(1);
    });

    it("says a moved port once per launch: not again after a reload, dismissed or not", async () => {
      const moved = { ...SESSION, moved: true, port: 44_897 };
      startedEvent({ payload: moved });
      expect(useStreamStore.getState().movedNotice).toBe(true);

      // A game switch reloads the page: the store is new, the launch is not
      useStreamStore.setState(useStreamStore.getInitialState(), true);
      answer(moved);
      await attachStream();

      expect(useStreamStore.getState().session?.moved).toBe(true);
      expect(useStreamStore.getState().movedNotice).toBe(false);
    });

    it("says it again for another port, and after the app restarts", async () => {
      startedEvent({ payload: { ...SESSION, moved: true, port: 44_897 } });
      useStreamStore.setState(useStreamStore.getInitialState(), true);

      // Another port: news
      answer({ ...SESSION, moved: true, port: 44_898 });
      await attachStream();
      expect(useStreamStore.getState().movedNotice).toBe(true);

      // A new launch has a new webview session
      sessionStorage.clear();
      useStreamStore.setState(useStreamStore.getInitialState(), true);
      answer({ ...SESSION, moved: true, port: 44_898 });
      await attachStream();
      expect(useStreamStore.getState().movedNotice).toBe(true);
    });

    it("does not say it after the player started the stream and saw it in the dialog", async () => {
      tauri.invoke.mockImplementation(async (command: string) =>
        command === "stream_start"
          ? { ...SESSION, moved: true, port: 44_897 }
          : undefined,
      );
      await useStreamStore.getState().start();

      useStreamStore.setState(useStreamStore.getInitialState(), true);
      answer({ ...SESSION, moved: true, port: 44_897 });
      await attachStream();

      expect(useStreamStore.getState().movedNotice).toBe(false);
    });

    it("says a moved port outside the dialog, until it is dismissed", async () => {
      startedEvent({ payload: { ...SESSION, moved: true, port: 44_897 } });

      expect(useStreamStore.getState().movedNotice).toBe(true);
      useStreamStore.getState().dismissMovedNotice();
      expect(useStreamStore.getState().movedNotice).toBe(false);
    });

    it("says nothing when the port held", () => {
      startedEvent({ payload: { ...SESSION } });

      expect(useStreamStore.getState().movedNotice).toBe(false);
    });

    it("says nothing of a port the player just started, the dialog says it", async () => {
      tauri.invoke.mockImplementation(async (command: string) =>
        command === "stream_start" ? { ...SESSION, moved: true } : undefined,
      );

      await useStreamStore.getState().start();

      expect(useStreamStore.getState().session?.moved).toBe(true);
      expect(useStreamStore.getState().movedNotice).toBe(false);
    });

    it("keeps the count of a source that connected before the start answered", async () => {
      let answerStart: (session: typeof SESSION) => void = () => {};
      tauri.invoke.mockImplementation(async (command: string) => {
        if (command !== "stream_start") return undefined;
        return new Promise((resolve) => {
          answerStart = resolve;
        });
      });
      const starting = useStreamStore.getState().start();

      // OBS was quicker than the answer
      viewersEvent({ payload: { count: 1 } });
      answerStart({ ...SESSION });
      await starting;

      expect(useStreamStore.getState().session?.viewers).toBe(1);
    });

    it("keeps the count heard before the page was told of a stream", () => {
      viewersEvent({ payload: { count: 2 } });

      startedEvent({ payload: { ...SESSION } });

      expect(useStreamStore.getState().session?.viewers).toBe(2);
    });
  });

  describe("a failed command", () => {
    const warn = vi.spyOn(console, "warn");
    beforeEach(() => warn.mockImplementation(() => {}));
    afterEach(() => warn.mockReset());

    it("holds every other command until the app has said how the stream stands", async () => {
      let say: (session: typeof SESSION | null) => void = () => {};
      tauri.invoke.mockImplementation(async (command: string) => {
        if (command === "stream_start") throw "could not open the port";
        if (command === "stream_state") {
          return new Promise((resolve) => {
            say = resolve;
          });
        }
        return undefined;
      });

      const starting = useStreamStore.getState().start();
      await vi.waitFor(() => expect(say).not.toBe(undefined));
      // The answer is not in yet: still pending, and a new command waits its turn
      expect(useStreamStore.getState().pending).toBe(true);
      await useStreamStore.getState().setLan(true);
      expect(calls("stream_set_lan")).toEqual([]);

      say(null);
      await starting;

      expect(useStreamStore.getState()).toMatchObject({
        error: "could not open the port",
        pending: false,
        session: null,
      });
    });
  });

  it("stops publishing when a change answers that the stream is off", async () => {
    await useStreamStore.getState().start();
    expect(listeners.size).toBe(1);
    tauri.invoke.mockImplementation(async () => null);

    await useStreamStore.getState().setLan(true);

    expect(useStreamStore.getState().session).toBeNull();
    expect(listeners.size).toBe(0);
  });

  it("asks the app again on demand, for an address that may have changed", async () => {
    await useStreamStore.getState().start();
    tauri.invoke.mockImplementation(async (command: string) =>
      command === "stream_state"
        ? { ...SESSION, lan: true, lanAddress: "http://10.0.0.5:23076/" }
        : undefined,
    );

    await useStreamStore.getState().refresh();

    expect(useStreamStore.getState().session?.lanAddress).toBe(
      "http://10.0.0.5:23076/",
    );
  });
});
