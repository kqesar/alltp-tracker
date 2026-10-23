import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applySnapshot,
  CLOSE,
  type FollowStatus,
  follow,
  parseSnapshot,
  retryDelay,
  type Snapshot,
} from "@/follow/client";
import type { RunStore } from "@/games/registry";

/** A socket the test drives: what the relay sends, and how it closes. */
class FakeSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {}
  receive(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
  drop(code = 1006) {
    this.onclose?.({ code } as CloseEvent);
  }
  close() {
    this.closed = true;
  }
}

const frame = (fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    game: "alttpr",
    key: "alltp-tracker-state",
    sentAt: 1_000_000,
    value: '{"state":{},"version":1}',
    ...fields,
  });

describe("parseSnapshot", () => {
  it("takes a run of a known game", () => {
    expect(parseSnapshot(frame())).toEqual({
      game: "alttpr",
      sentAt: 1_000_000,
      value: '{"state":{},"version":1}',
    });
  });

  it("ignores anything else", () => {
    expect(parseSnapshot("not json")).toBeNull();
    expect(parseSnapshot(new ArrayBuffer(2))).toBeNull();
    expect(parseSnapshot("null")).toBeNull();
    expect(parseSnapshot(frame({ game: "zelda1" }))).toBeNull();
    expect(parseSnapshot(frame({ value: 3 }))).toBeNull();
    expect(parseSnapshot(frame({ value: "{broken" }))).toBeNull();
    expect(parseSnapshot(frame({ value: `"${"a".repeat(1 << 20)}"` }))).toBe(
      null,
    );
    expect(parseSnapshot(frame({ sentAt: "now" }))).toBeNull();
    expect(parseSnapshot(frame({ sentAt: null }))).toBeNull();
  });
});

describe("applySnapshot", () => {
  const store = (name?: string): RunStore => ({
    persist: { getOptions: () => ({ name }), rehydrate: vi.fn() },
    setState: vi.fn(),
    subscribe: vi.fn(),
  });

  beforeEach(() => localStorage.clear());

  it("writes the run under the game's key, then reloads the store", () => {
    const run = store("alltp-tracker-sm");

    expect(applySnapshot('{"state":{"a":1}}', run)).toBe(true);

    expect(localStorage.getItem("alltp-tracker-sm")).toBe('{"state":{"a":1}}');
    expect(run.persist.rehydrate).toHaveBeenCalledOnce();
  });

  it("does nothing for a store without a key, or when storage refuses", () => {
    const keyless = store();
    expect(applySnapshot("{}", keyless)).toBe(false);
    expect(keyless.persist.rehydrate).not.toHaveBeenCalled();

    const full = store("alltp-tracker-state");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    try {
      expect(applySnapshot("{}", full)).toBe(false);
      expect(full.persist.rehydrate).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("retryDelay", () => {
  it("doubles from a second up to thirty", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => retryDelay(n))).toEqual([
      1000, 2000, 4000, 8000, 16_000, 30_000, 30_000,
    ]);
  });

  it("waits at least five seconds for a seat", () => {
    expect(retryDelay(0, true)).toBe(5000);
    expect(retryDelay(4, true)).toBe(16_000);
  });
});

describe("follow", () => {
  let sockets: FakeSocket[];
  let statuses: FollowStatus[];
  let received: [Snapshot, number][];
  let stop: () => void;

  const latest = () => sockets[sockets.length - 1];

  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    sockets = [];
    statuses = [];
    received = [];
    stop = follow({
      onSnapshot: (snapshot, offset) => received.push([snapshot, offset]),
      onStatus: (status) => statuses.push(status),
      open: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      url: "ws://192.168.1.20:23075/follow?token=abc",
    });
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it("connects, then is live with the first run", () => {
    expect(sockets.map((socket) => socket.url)).toEqual([
      "ws://192.168.1.20:23075/follow?token=abc",
    ]);
    expect(statuses).toEqual(["connecting"]);

    latest().receive(frame());

    expect(statuses).toEqual(["connecting", "live"]);
    expect(received.map(([snapshot]) => snapshot.game)).toEqual(["alttpr"]);
  });

  it("ignores a frame that is no run", () => {
    latest().receive("hello");

    expect(statuses).toEqual(["connecting"]);
    expect(received).toEqual([]);
  });

  it("takes the player's clock offset from the freshest run", () => {
    // The run kept by the relay, sent a minute ago
    latest().receive(frame({ sentAt: 1_000_000 - 60_000 }));
    // A fresh one: the player's clock is 2 s ahead, 30 ms on the way
    latest().receive(frame({ sentAt: 1_000_000 + 2000 - 30 }));
    // Slower on the network: the estimate keeps the closer one
    latest().receive(frame({ sentAt: 1_000_000 + 2000 - 400 }));

    expect(received.map(([, offset]) => offset)).toEqual([-60_000, 1970, 1970]);
  });

  it("tries again after a drop, waiting longer each time, sooner once live", () => {
    latest().drop();
    expect(statuses.at(-1)).toBe("reconnecting");
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    latest().drop();
    vi.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);

    // Live again: the next drop waits a second again
    latest().receive(frame());
    expect(statuses.at(-1)).toBe("live");
    latest().drop();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(4);
  });

  it("tries at once when the device is back online or the page in view", () => {
    latest().drop();
    window.dispatchEvent(new Event("online"));
    expect(sockets).toHaveLength(2);

    latest().drop();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(sockets).toHaveLength(3);
  });

  it("waits for a seat while the relay is full", () => {
    latest().drop(CLOSE.FULL);

    expect(statuses.at(-1)).toBe("full");
    vi.advanceTimersByTime(4999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
  });

  it.each([
    [CLOSE.TOKEN, "expired"],
    [CLOSE.STOPPED, "stopped"],
  ] as const)("ends on close code %i: %s", (code, status) => {
    latest().receive(frame());
    latest().drop(code);

    expect(statuses.at(-1)).toBe(status);
    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event("online"));
    expect(sockets).toHaveLength(1);
  });

  it("closes its socket and tries no more once stopped", () => {
    const first = latest();
    first.drop();
    stop();

    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);

    stop = follow({
      onSnapshot: () => {},
      onStatus: () => {},
      open: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      url: "ws://host/follow?token=abc",
    });
    const second = latest();
    stop();
    expect(second.closed).toBe(true);
    // A close after stopping says nothing more
    const count = statuses.length;
    second.drop();
    expect(statuses).toHaveLength(count);
  });
});
