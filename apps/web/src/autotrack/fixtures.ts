// Fixtures for the autotracking specs, not part of the app: one status of
// each diagnostic code, a console's memory holding an alttpr.com seed in
// play (a location's flag set, the whole decoded), and the clock, page
// visibility and permission the specs drive.

import type {
  BridgeInfo,
  Clock,
  DeviceDescriptor,
  DeviceInfo,
  LocalNetworkPermission,
  SessionStatus,
  Visibility,
} from "@alltp/autotrack";
import {
  CHECK_FLAGS,
  MEMORY_RANGE,
  type MemoryRangeId,
} from "@alltp/pack-alttpr";
import { readMemory } from "@/autotrack/reading";

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

// The console's memory in the FX Pak Pro space the bridges take: ROM from
// $00_0000 (LoROM, headerless), WRAM from $F5_0000.
const ROM_HEADER = 0x00_7fc0;
const RACE_FLAG = 0x18_0213;
const WRAM = 0xf5_0000;
export const SAVE = (offset: number) => WRAM + 0xf000 + offset;

/**
 * A 16 MiB memory image with an alttpr.com seed in play on the overworld: a
 * few items, Link's House and Eastern Palace's compass chest checked, the
 * Armos Knights beaten.
 * @param race - A race seed (its race flag set) or an open one
 * @param name - The seed's name in the header, after "VT "
 */
export const seedMemory = ({
  name,
  race,
}: {
  name?: string;
  race: boolean;
}) => {
  const memory = new Uint8Array(0x100_0000);
  const title = `VT ${name ?? (race ? "RACE" : "OPEN")}`.padEnd(21, " ");
  for (let i = 0; i < title.length; i++) {
    memory[ROM_HEADER + i] = title.charCodeAt(i);
  }
  // The flag and its complement (vt app/Rom.php:908-920)
  memory.set(race ? [0x01, 0x00] : [0x00, 0x01], RACE_FLAG);
  memory[WRAM + 0x10] = 0x09; // game mode: the overworld
  memory[SAVE(0x342)] = 0x01; // Hookshot
  memory[SAVE(0x359)] = 0x02; // Master Sword
  memory[SAVE(0x35c)] = 0x02; // one empty bottle
  memory[SAVE(0x374)] = 0x04; // the Pendant of Courage
  memory[SAVE(0x3c5)] = 0x02; // Zelda rescued
  memory[SAVE(0x208)] = 0x10; // Link's House chest (room $104)
  memory[SAVE(0x150)] = 0x10; // Eastern Palace's compass chest (room $A8)
  memory[SAVE(0x191)] = 0x08; // Armos Knights (room $C8, its boss bit)
  return memory;
};

/** Where a range's byte at A-bus address `at` lies in a memory image. */
const imageAddress = (range: MemoryRangeId, at: number) =>
  MEMORY_RANGE[range].address + (at - MEMORY_RANGE[range].bus);

/**
 * Set the flag that says a location was checked, in a memory image.
 * @param memory - A memory image, as `seedMemory` makes
 * @param location - The pack's location id
 */
export const checkIn = (memory: Uint8Array, location: string) => {
  const entry = CHECK_FLAGS.find(({ id }) => id === location);
  if (entry === undefined) throw new RangeError(`No flag for ${location}`);
  const { flag } = entry;
  const at = imageAddress(flag.range, flag.at);
  if ("atLeast" in flag) {
    memory[at] = Math.max(memory[at], flag.atLeast);
    return;
  }
  memory[at] |= flag.mask & 0xff;
  if (flag.size === 2) memory[at + 1] |= flag.mask >> 8;
};

/**
 * A memory image decoded as the session decodes its snapshot.
 * @param memory - A memory image, as `seedMemory` makes
 * @param options - Race Mode, and the ranges not read yet
 */
export const readingOf = (
  memory: Uint8Array,
  {
    race = false,
    unread = [],
  }: { race?: boolean; unread?: readonly MemoryRangeId[] } = {},
) =>
  readMemory(
    {
      bytes: (id) => {
        const { address, size } = MEMORY_RANGE[id as MemoryRangeId];
        return memory.subarray(address, address + size);
      },
      has: (id) => !unread.includes(id as MemoryRangeId),
    },
    race,
    Date.UTC(2026, 9, 16, 20, 15),
  );

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
