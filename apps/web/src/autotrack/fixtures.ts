// Fixtures for the autotracking specs of every game, not part of the app: one
// status of each diagnostic code, and the clock, page visibility, Web Locks
// and permission the specs drive. A game's console memory is its own
// (games/alttpr/autotrack/fixtures.ts, packs/sm/test/sm-rom.ts).

import type {
  BridgeInfo,
  Clock,
  DeviceDescriptor,
  DeviceInfo,
  LocalNetworkPermission,
  SessionStatus,
  Visibility,
} from "@alltp/autotrack";

export const SNI: BridgeInfo = {
  kind: "sni",
  url: "ws://localhost:23074",
  version: "0.0.103",
};

export const RETROARCH: DeviceDescriptor = {
  id: "ra://127.0.0.1:55355",
  kind: "retroarch",
};

export const INFO: DeviceInfo = {
  device: RETROARCH,
  flags: [],
  name: "retroarch",
  rom: "alttpr",
  romReadable: true,
  version: "1.22.2",
};

const URL = "ws://localhost:23074";
const PERMISSION = { name: "loopback-network", state: "granted" } as const;

/** One status of each code, as the session reports them. */
export const STATUSES = {
  "attach-failed": {
    bridge: SNI,
    code: "attach-failed",
    detail: "closed",
    device: RETROARCH,
    retryInMs: 1000,
  },
  attaching: {
    bridge: SNI,
    code: "attaching",
    device: RETROARCH,
    devices: [RETROARCH],
  },
  "bridge-refused": {
    code: "bridge-refused",
    detail: "Not in trusted origin",
    retryInMs: null,
    url: URL,
  },
  "bridge-unreachable": {
    attempt: 1,
    code: "bridge-unreachable",
    detail: "",
    permission: PERMISSION,
    retryInMs: 1000,
    url: URL,
  },
  "browser-blocks-bridge": {
    browser: "safari",
    code: "browser-blocks-bridge",
    retryInMs: null,
    url: URL,
  },
  connected: {
    bridge: SNI,
    code: "connected",
    device: INFO,
    paused: false,
    race: {
      active: false,
      flag: "open",
      overridden: false,
      raceLegal: false,
      setting: "auto",
    },
    unreadable: [],
  },
  connecting: { attempt: 1, code: "connecting", url: URL },
  "game-mismatch": {
    bridge: SNI,
    check: { code: "vanilla-alttp", message: "The original game." },
    code: "game-mismatch",
    device: INFO,
    retryInMs: 1000,
  },
  idle: { code: "idle" },
  "local-network-denied": {
    code: "local-network-denied",
    permission: { ...PERMISSION, state: "denied" },
    retryInMs: null,
    url: URL,
  },
  "local-network-prompt": {
    code: "local-network-prompt",
    permission: { ...PERMISSION, state: "prompt" },
    url: URL,
  },
  "memory-unreadable": {
    bridge: SNI,
    cause: "no-memory-map",
    code: "memory-unreadable",
    detail: "",
    device: INFO,
    evidence: "inferred",
    remedy: { action: "switch-core", core: "bsnes-mercury" },
    retryInMs: 1000,
  },
  "no-device": { bridge: SNI, code: "no-device", retryInMs: 1000 },
  stopped: { code: "stopped" },
} as const satisfies {
  [Code in SessionStatus["code"]]: Extract<SessionStatus, { code: Code }>;
};

/** A status of `code`, changed by `overrides`. */
export const statusOf = <Code extends SessionStatus["code"]>(
  code: Code,
  overrides: Partial<Extract<SessionStatus, { code: Code }>> = {},
) => ({ ...STATUSES[code], ...overrides }) as SessionStatus;

/** Real time's turn: settles the promises waiting, timers of 0 ms first. */
export const settle = () =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));

/**
 * The session's clock, moved by hand: `advance` runs the timers that fall
 * due one by one, letting the promises each starts settle in between.
 */
export class ManualClock implements Clock {
  time = 1_700_000_000_000;
  private nextId = 0;
  private readonly timers = new Map<number, { at: number; run: () => void }>();

  now() {
    return this.time;
  }

  setTimeout(run: () => void, ms: number) {
    this.nextId++;
    this.timers.set(this.nextId, { at: this.time + ms, run });
    return this.nextId;
  }

  clearTimeout(handle: unknown) {
    this.timers.delete(handle as number);
  }

  async advance(ms: number) {
    const end = this.time + ms;
    for (;;) {
      await settle();
      const [next] = [...this.timers]
        .filter(([, timer]) => timer.at <= end)
        .sort(([, a], [, b]) => a.at - b.at);
      if (!next) break;
      this.timers.delete(next[0]);
      this.time = next[1].at;
      next[1].run();
    }
    this.time = end;
    await settle();
  }
}

/** The page's visibility, hidden or shown by the spec. */
export class FakeVisibility implements Visibility {
  isHidden = false;
  private readonly listeners = new Set<() => void>();

  hidden() {
    return this.isHidden;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  set(hidden: boolean) {
    this.isHidden = hidden;
    for (const listener of this.listeners) listener();
  }
}

/**
 * The browser's Web Locks, shared by the tabs of one origin, for one lock
 * at a time: granted to one holder until its callback's promise settles,
 * the others queued in order unless they ask only if it is free. As in a
 * browser, the callback runs a turn after the lock is granted.
 */
export class FakeLocks {
  private held = false;
  private readonly queue: (() => void)[] = [];

  /** Whether a tab holds the lock. */
  get isHeld() {
    return this.held;
  }

  request(
    _name: string,
    options: LockOptions,
    callback: (lock: Lock | null) => unknown,
  ): Promise<unknown> {
    if (this.held && options.ifAvailable) {
      return Promise.resolve(callback(null));
    }
    return new Promise((resolve, reject) => {
      const grant = () => {
        this.held = true;
        queueMicrotask(() => {
          Promise.resolve(callback({ mode: "exclusive", name: _name }))
            .then(resolve, reject)
            .finally(() => {
              this.held = false;
              this.queue.shift()?.();
            });
        });
      };
      if (!this.held) {
        grant();
        return;
      }
      this.queue.push(grant);
      options.signal?.addEventListener("abort", () => {
        const at = this.queue.indexOf(grant);
        if (at < 0) return;
        this.queue.splice(at, 1);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  }

  /** Let the page see these locks, until the returned function is called. */
  install(): () => void {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: this,
    });
    return () => {
      delete (navigator as { locks?: unknown }).locks;
    };
  }
}

/** A browser that lets the page reach the bridge. */
export const GRANTED: LocalNetworkPermission = {
  query: () => Promise.resolve(PERMISSION),
  subscribe: () => () => {},
};
