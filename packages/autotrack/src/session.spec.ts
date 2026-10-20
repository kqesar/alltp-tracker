import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeRetroArch } from "../test/fake-retroarch";
import { bootGame, SAMPLE_PACK } from "../test/fixtures";
import {
  infoFor,
  MemoryTransport,
  RETROARCH,
  type Script,
  SNI,
} from "../test/memory-transport";
import { bus } from "./address";
import type { SessionCode, SessionStatus } from "./diagnostics";
import { type Environment, parseUserAgent } from "./environment";
import { TransportError } from "./errors";
import { FirstAnsweringTransport } from "./first-answering";
import type { LocalNetworkPermission, PermissionState } from "./permission";
import type { Visibility } from "./platform";
import { RETROARCH_DEVICE, RetroArchTransport } from "./retroarch";
import {
  AutotrackSession,
  backoffDelay,
  DEFAULT_BACKOFF,
  type SessionOptions,
} from "./session";
import type { DeviceDescriptor } from "./transport";

const CHROME = parseUserAgent(
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
);
const FIREFOX = parseUserAgent(
  "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
);
const SAFARI = parseUserAgent(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
);

class FakePermission implements LocalNetworkPermission {
  private readonly listeners = new Set<() => void>();
  constructor(public state: PermissionState["state"]) {}
  query(): Promise<PermissionState> {
    return Promise.resolve({ name: "loopback-network", state: this.state });
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  set(state: PermissionState["state"]): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  get subscribers(): number {
    return this.listeners.size;
  }
}

class FakeVisibility implements Visibility {
  private readonly listeners = new Set<() => void>();
  isHidden = false;
  hidden(): boolean {
    return this.isHidden;
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  set(hidden: boolean): void {
    this.isHidden = hidden;
    for (const listener of this.listeners) listener();
  }
  get subscribers(): number {
    return this.listeners.size;
  }
}

const unreachable = () =>
  Promise.reject(
    new TransportError("unreachable", "open", "No bridge", { closeCode: 1006 }),
  );

interface HarnessOptions {
  readonly script?: Script;
  readonly environment?: Environment;
  readonly permission?: PermissionState["state"];
  readonly boot?: boolean;
  readonly session?: Partial<SessionOptions>;
}

function harness(options: HarnessOptions = {}) {
  const memory = new Uint8Array(0x100_0000);
  if (options.boot !== false) bootGame(memory);
  const transports: MemoryTransport[] = [];
  const script: Script = { ...options.script };
  const permission = new FakePermission(options.permission ?? "granted");
  const visibility = new FakeVisibility();
  const session = new AutotrackSession({
    environment: options.environment,
    pack: SAMPLE_PACK,
    permission,
    random: () => 0,
    transport: () => {
      const transport = new MemoryTransport(memory, script);
      transports.push(transport);
      return transport;
    },
    visibility,
    ...options.session,
  });
  const statuses: SessionStatus[] = [];
  session.subscribe((status) => statuses.push(status));
  const codes = () => statuses.map((s) => s.code);
  const last = () => statuses[statuses.length - 1];
  return {
    codes,
    last,
    memory,
    permission,
    script,
    session,
    statuses,
    transports,
    visibility,
  };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("backoffDelay", () => {
  it("doubles from 1 s up to 15 s, less up to 20% jitter", () => {
    expect(
      [1, 2, 3, 4, 5, 6].map((n) => backoffDelay(n, DEFAULT_BACKOFF, () => 0)),
    ).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
    expect(backoffDelay(1, DEFAULT_BACKOFF, () => 1)).toBe(800);
  });
});

describe("AutotrackSession", () => {
  it("connects, checks the game, then polls on the pack's tick", async () => {
    const h = harness();
    const updates: string[][] = [];
    h.session.onUpdate((update) => updates.push([...update.changed]));
    h.session.start();
    await flush();
    expect(h.codes()).toEqual(["connecting", "attaching", "connected"]);
    expect(h.last()).toMatchObject({
      code: "connected",
      race: { active: false, flag: "open" },
    });
    expect(h.session.snapshot?.bytes("module")[0]).toBe(0x07);
    expect(updates).toHaveLength(1);

    h.memory[bus(0x7e_0010)] = 0x09;
    await vi.advanceTimersByTimeAsync(250);
    expect(updates[1]).toEqual(["module"]);
    const reads = h.transports[0].pieces.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.transports[0].pieces.length).toBeGreaterThan(reads);
    h.session.stop();
  });

  it("retries an unreachable bridge with exponential backoff", async () => {
    const h = harness({ script: { open: unreachable } });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      attempt: 1,
      code: "bridge-unreachable",
      retryInMs: 1000,
    });
    for (const delay of [1000, 2000, 4000, 8000, 15000]) {
      const before = h.transports.length;
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(h.transports.length).toBe(before);
      await vi.advanceTimersByTimeAsync(1);
      expect(h.transports.length).toBe(before + 1);
    }
    expect(h.last()).toMatchObject({
      attempt: 6,
      code: "bridge-unreachable",
      retryInMs: 15000,
    });
    h.session.stop();
  });

  it("waits for the user when the browser denies local network access", async () => {
    const h = harness({ permission: "denied", script: { open: unreachable } });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      code: "local-network-denied",
      retryInMs: null,
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.transports).toHaveLength(1);
    h.script.open = undefined;
    h.permission.set("granted");
    await flush();
    expect(h.last().code).toBe("connected");
    h.session.stop();
  });

  it("reports the permission prompt while the socket hangs, then a dismissal", async () => {
    let fail: (error: Error) => void = () => {};
    const h = harness({
      permission: "prompt",
      script: { open: () => new Promise((_, reject) => (fail = reject)) },
    });
    h.session.start();
    await vi.advanceTimersByTimeAsync(1499);
    expect(h.last().code).toBe("connecting");
    await vi.advanceTimersByTimeAsync(1);
    expect(h.last()).toMatchObject({
      code: "local-network-prompt",
      permission: { state: "prompt" },
    });
    await vi.advanceTimersByTimeAsync(2000);
    fail(
      new TransportError("unreachable", "open", "No bridge", {
        closeCode: 1006,
      }),
    );
    await flush();
    expect(h.last()).toMatchObject({
      code: "local-network-denied",
      retryInMs: null,
    });
    h.session.stop();
  });

  it("does not stack Chromium prompts on a fast failure, but retries Firefox", async () => {
    const chrome = harness({
      environment: CHROME,
      permission: "prompt",
      script: { open: unreachable },
    });
    chrome.session.start();
    await flush();
    expect(chrome.last()).toMatchObject({
      code: "bridge-unreachable",
      retryInMs: null,
    });
    chrome.session.stop();

    const firefox = harness({
      environment: FIREFOX,
      permission: "prompt",
      script: { open: unreachable },
    });
    firefox.session.start();
    await flush();
    expect(firefox.last()).toMatchObject({
      code: "bridge-unreachable",
      retryInMs: 1000,
    });
    firefox.session.stop();
  });

  it("names Safari's mixed-content block", async () => {
    const h = harness({
      environment: SAFARI,
      permission: "unsupported",
      script: { open: unreachable },
    });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      browser: "safari",
      code: "browser-blocks-bridge",
      retryInMs: null,
    });
    h.session.stop();
  });

  it("waits for a click when QUsb2Snes refuses the site", async () => {
    const refused = () =>
      Promise.reject(
        new TransportError("closed", "app-version", "closed", {
          closeCode: 1008,
          reason: "Not in trusted origin",
        }),
      );
    const h = harness({ script: { open: refused } });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      code: "bridge-refused",
      detail: "Not in trusted origin",
      retryInMs: null,
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.transports).toHaveLength(1);
    h.script.open = undefined;
    h.session.retryNow();
    await flush();
    expect(h.last().code).toBe("connected");
    h.session.stop();
  });

  it("asks the bridge again until a device shows up, on the same connection", async () => {
    let devices: DeviceDescriptor[] = [];
    const h = harness({
      script: { listDevices: () => Promise.resolve(devices) },
    });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      bridge: { kind: "sni" },
      code: "no-device",
      retryInMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.last()).toMatchObject({ code: "no-device", retryInMs: 2000 });
    devices = [RETROARCH];
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.last().code).toBe("connected");
    expect(h.transports).toHaveLength(1);
    h.session.stop();
  });

  it("reports a failed attach", async () => {
    const h = harness({
      script: {
        attach: () =>
          Promise.reject(
            new TransportError("closed", "info", "x", {
              closeCode: 1006,
              reason: "",
            }),
          ),
      },
    });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      code: "attach-failed",
      device: RETROARCH,
      retryInMs: 1000,
    });
    h.session.stop();
  });

  it.each<
    [
      string,
      Partial<Script>,
      Partial<Parameters<typeof infoFor>[1]>,
      string,
      string,
      string,
    ]
  >([
    [
      "SNI dropping the socket on RetroArch's first read",
      {
        read: () =>
          new TransportError("closed", "read", "closed", {
            closeCode: 1006,
            reason: "",
          }),
      },
      {},
      "no-memory-map",
      "inferred",
      "switch-core",
    ],
    [
      "RetroArch's own reply",
      {
        read: () =>
          new TransportError(
            "device",
            "read",
            "READ_CORE_MEMORY f5f340 -1 no memory map defined",
          ),
      },
      {},
      "no-memory-map",
      "reply",
      "switch-core",
    ],
    [
      "nothing loaded",
      {
        read: () =>
          new TransportError("closed", "read", "closed", { closeCode: 1006 }),
      },
      { rom: null },
      "no-content",
      "inferred",
      "load-game",
    ],
    [
      "QUsb2Snes without ROM access",
      {},
      { flags: ["NO_ROM_READ"], romReadable: false },
      "rom-unreadable",
      "reply",
      "use-sni",
    ],
  ])(
    "diagnoses unreadable memory: %s",
    async (_, script, info, cause, evidence, action) => {
      const h = harness({
        script: {
          ...script,
          attach: (device) => Promise.resolve(infoFor(device, info)),
          open: () =>
            Promise.resolve({
              kind: action === "use-sni" ? "qusb2snes" : "sni",
              url: "ws://localhost:23074",
              version: null,
            }),
        },
      });
      h.session.start();
      await flush();
      expect(h.last()).toMatchObject({
        cause,
        code: "memory-unreadable",
        evidence,
        remedy: { action },
        retryInMs: 1000,
      });
      h.session.stop();
    },
  );

  it("recognises SNI's zero-filled reads", async () => {
    const h = harness({ boot: false });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      cause: "zero-filled",
      code: "memory-unreadable",
      remedy: { action: "switch-core" },
    });
    h.session.stop();
  });

  it("re-checks the game until it is the pack's", async () => {
    const h = harness({ boot: false });
    h.memory[bus(0x00_ffc0)] = 0x41; // some other game
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      check: { code: "not-alttp" },
      code: "game-mismatch",
      retryInMs: 1000,
    });
    bootGame(h.memory);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.last().code).toBe("connected");
    h.session.stop();
  });

  it("reconnects at once when a long-lived connection drops", async () => {
    const h = harness({ session: { stableAfterMs: 5000 } });
    h.session.start();
    await vi.advanceTimersByTimeAsync(6000);
    let failures = 0;
    h.script.read = () =>
      failures++ === 0
        ? new TransportError("closed", "read", "closed", { closeCode: 1006 })
        : undefined;
    await vi.advanceTimersByTimeAsync(250);
    expect(h.transports).toHaveLength(2);
    expect(h.transports[0].closed).toBe(true);
    expect(h.last().code).toBe("connected");
    h.session.stop();
  });

  it("reconnects at once when a connection drops after a read came back", async () => {
    // Under the stable window, but memory was read: not a missing memory map
    const h = harness({ session: { stableAfterMs: 5000 } });
    h.session.start();
    await flush();
    expect(h.last().code).toBe("connected");
    let failures = 0;
    h.script.read = () =>
      failures++ === 0
        ? new TransportError("closed", "read", "closed", { closeCode: 1006 })
        : undefined;
    await vi.advanceTimersByTimeAsync(250);
    expect(h.codes()).not.toContain("memory-unreadable");
    expect(h.transports).toHaveLength(2);
    expect(h.last().code).toBe("connected");
    h.session.stop();
  });

  it("pauses while the page is hidden", async () => {
    const h = harness();
    h.session.start();
    await flush();
    h.visibility.set(true);
    await vi.advanceTimersByTimeAsync(250);
    expect(h.last()).toMatchObject({ code: "connected", paused: true });
    const reads = h.transports[0].pieces.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.transports[0].pieces.length).toBe(reads);
    h.visibility.set(false);
    await flush();
    expect(h.last()).toMatchObject({ code: "connected", paused: false });
    expect(h.transports[0].pieces.length).toBeGreaterThan(reads);
    h.session.stop();
  });

  it("switches Race Mode on demand and on the flag", async () => {
    const h = harness();
    h.session.start();
    await flush();
    h.session.setRaceMode("on");
    expect(h.last()).toMatchObject({
      code: "connected",
      race: { active: true, setting: "on" },
    });
    h.session.setRaceMode("auto");
    h.memory[bus(0x30_8213)] = 0x01;
    await vi.advanceTimersByTimeAsync(250);
    expect(h.last()).toMatchObject({
      code: "connected",
      race: { active: true, flag: "race", setting: "auto" },
    });
    expect(h.session.race?.raceLegal).toBe(true);
    h.session.stop();
  });

  it("feeds the report: what it saw, since when, and listeners that unsubscribe", async () => {
    const h = harness();
    let updates = 0;
    const stopUpdates = h.session.onUpdate(() => updates++);
    const statuses: string[] = [];
    const stopStatuses = h.session.subscribe((s) => statuses.push(s.code));
    vi.setSystemTime(5000);
    h.session.start();
    await flush();
    expect(h.session.seen).toEqual({ bridge: SNI, devices: [RETROARCH] });
    expect(h.session.statusSince).toBe(5000);
    stopUpdates();
    stopStatuses();
    h.memory[bus(0x7e_0010)] = 0x0b;
    await vi.advanceTimersByTimeAsync(500);
    expect(updates).toBe(1);
    h.session.stop();
    expect(statuses).not.toContain("stopped");
  });

  it("treats a permission API that throws as unsupported", async () => {
    const h = harness({ script: { open: unreachable } });
    h.permission.query = () => Promise.reject(new Error("broken"));
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      code: "bridge-unreachable",
      permission: { state: "unsupported" },
    });
    h.session.stop();
  });

  it("attaches to another device when asked", async () => {
    const other: DeviceDescriptor = {
      id: "fxpakpro://./dev/ttyACM0",
      kind: "fxpakpro",
    };
    const h = harness({
      script: { listDevices: () => Promise.resolve([RETROARCH, other]) },
    });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      code: "connected",
      device: { device: RETROARCH },
    });
    h.session.selectDevice(other.id);
    await flush();
    expect(h.last()).toMatchObject({
      code: "connected",
      device: { device: other },
    });
    expect(h.transports).toHaveLength(2);
    h.session.stop();
  });

  it.each<[string, Partial<Script>, SessionCode]>([
    ["polling", {}, "connected"],
    ["backing off", { open: unreachable }, "bridge-unreachable"],
    [
      "waiting for a device",
      { listDevices: () => Promise.resolve([]) },
      "no-device",
    ],
    ["opening", { open: () => new Promise(() => {}) }, "connecting"],
  ])(
    "leaves no timer, socket or listener when stopped while %s",
    async (_, script, code) => {
      const h = harness({ script });
      h.session.start();
      await vi.advanceTimersByTimeAsync(300);
      expect(h.last().code).toBe(code);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      h.session.stop();
      await flush();
      expect(vi.getTimerCount()).toBe(0);
      expect(h.transports.every((t) => t.closed)).toBe(true);
      expect(h.permission.subscribers).toBe(0);
      expect(h.visibility.subscribers).toBe(0);
      const count = h.statuses.length;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(h.statuses).toHaveLength(count);
      expect(h.last().code).toBe("stopped");
      expect(h.session.snapshot).toBeNull();
    },
  );
});

describe("AutotrackSession, as the desktop app runs it", () => {
  /** RetroArch read directly, SNI (a memory bridge here) behind it. */
  const desktop = (retroarch: Parameters<typeof fakeRetroArch>[0]) => {
    const sent = fakeRetroArch(retroarch);
    return {
      sent,
      transport: (pack: typeof SAMPLE_PACK) =>
        new FirstAnsweringTransport([
          () =>
            new RetroArchTransport({
              mapping: pack.profile.mapping,
              send: sent.send,
            }),
          () => new MemoryTransport(retroarch.memory),
        ]),
    };
  };

  it("reads RetroArch itself, under the pack's mapping", async () => {
    const memory = new Uint8Array(0x100_0000);
    bootGame(memory);
    const { sent, transport } = desktop({ mapping: "lorom", memory });
    const h = harness({ session: { transport } });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      bridge: { kind: "retroarch" },
      code: "connected",
      device: { device: RETROARCH_DEVICE, rom: "alttpr - seed" },
    });
    expect(h.session.snapshot?.bytes("module")[0]).toBe(0x07);
    expect(sent.commands).toContain("READ_CORE_MEMORY 7e0010 1");
    h.session.stop();
  });

  it("falls back to SNI when RetroArch does not answer", async () => {
    const memory = new Uint8Array(0x100_0000);
    bootGame(memory);
    const { transport } = desktop({ mapping: "lorom", memory, silent: true });
    const h = harness({ session: { transport } });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({ bridge: SNI, code: "connected" });
    h.session.stop();
  });

  it("takes RetroArch once it starts, rather than wait on SNI for it", async () => {
    const memory = new Uint8Array(0x100_0000);
    bootGame(memory);
    let running = false;
    const sent = fakeRetroArch({
      answer: () => (running ? undefined : null),
      mapping: "lorom",
      memory,
    });
    // SNI runs, and sees no device until RetroArch starts
    const sni = new MemoryTransport(memory, {
      listDevices: () => Promise.resolve(running ? [RETROARCH] : []),
    });
    const h = harness({
      session: {
        transport: (pack) =>
          new FirstAnsweringTransport([
            () =>
              new RetroArchTransport({
                mapping: pack.profile.mapping,
                send: sent.send,
              }),
            () => sni,
          ]),
      },
    });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({ bridge: SNI, code: "no-device" });

    running = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.last()).toMatchObject({
      bridge: { kind: "retroarch" },
      code: "connected",
    });
    h.session.stop();
  });

  it("asks for the game while RetroArch runs none", async () => {
    const { transport } = desktop({
      mapping: "lorom",
      memory: new Uint8Array(0x100_0000),
      status: "CONTENTLESS",
    });
    const h = harness({ session: { transport } });
    h.session.start();
    await flush();
    expect(h.last()).toMatchObject({
      cause: "no-content",
      code: "memory-unreadable",
      remedy: { action: "load-game" },
    });
    h.session.stop();
  });
});
