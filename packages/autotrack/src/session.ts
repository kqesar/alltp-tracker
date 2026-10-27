// The autotracking session: connects to the bridge, picks and attaches a
// device, runs the pack's game check, then polls until stopped, recovering
// from every failure with a diagnosis and a backoff.
//
// One run loop owns everything that happens. Each start() opens a new
// generation; stop() ends it, wakes any wait, closes the transport and drops
// every listener, so a stopped session holds no timer and no socket.

import {
  classifyReadFailure,
  isOriginRefusal,
  type SessionStatus,
  type Unreadable,
  unreadable,
} from "./diagnostics";
import type { Environment } from "./environment";
import { RaceViolationError, TransportError } from "./errors";
import type { AutotrackPack, GameCheckResult } from "./pack";
import {
  type LocalNetworkPermission,
  type PermissionState,
  systemPermission,
  UNSUPPORTED_PERMISSION,
} from "./permission";
import {
  type Clock,
  systemClock,
  systemVisibility,
  type Visibility,
} from "./platform";
import type { RaceSetting, RaceStatus } from "./race-mode";
import {
  type MemorySnapshot,
  type OnDemandRead,
  Poller,
  type PollUpdate,
} from "./scheduler";
import type {
  BridgeInfo,
  DeviceDescriptor,
  DeviceInfo,
  Transport,
} from "./transport";
import { DEFAULT_USB2SNES_URL, Usb2SnesTransport } from "./usb2snes";

export interface BackoffOptions {
  readonly initialMs: number;
  readonly maxMs: number;
  readonly factor: number;
  /** Share of each delay drawn at random, 0 to 1, to spread retries. */
  readonly jitter: number;
}

export const DEFAULT_BACKOFF: BackoffOptions = {
  factor: 2,
  initialMs: 1000,
  jitter: 0.2,
  maxMs: 15_000,
};

/** The delay before retry `attempt` (1-based). */
export function backoffDelay(
  attempt: number,
  options: BackoffOptions,
  random: () => number,
): number {
  const base = Math.min(
    options.maxMs,
    options.initialMs * options.factor ** (attempt - 1),
  );
  return Math.round(base * (1 - options.jitter * random()));
}

export interface SessionOptions {
  readonly pack: AutotrackPack;
  /** Where the bridge listens; the default transport uses it. */
  readonly url?: string;
  /**
   * A fresh transport per connection attempt, for the pack it reads (its
   * mapping turns addresses into RetroArch's). Default: usb2snes at `url`.
   */
  readonly transport?: (pack: AutotrackPack) => Transport;
  readonly clock?: Clock;
  readonly visibility?: Visibility;
  readonly permission?: LocalNetworkPermission;
  /** What detectEnvironment() found; tunes retries and diagnostics. */
  readonly environment?: Environment;
  readonly backoff?: Partial<BackoffOptions>;
  readonly random?: () => number;
  /**
   * How long a socket may stay connecting before the session concludes the
   * browser shows its permission prompt (loopback handshakes take ms).
   */
  readonly promptAfterMs?: number;
  /** A connection that lived this long is retried at once when it drops. */
  readonly stableAfterMs?: number;
  readonly raceSetting?: RaceSetting;
  /** The opt-in switches (`RangeSpec.optIn`) that are on from the start. */
  readonly optIn?: readonly string[];
  /** Polling stops while the page is hidden (default true). */
  readonly pauseWhenHidden?: boolean;
}

type Stage = "open" | "list" | "attach" | "check" | "poll";

/**
 * A failure: a status waiting for its retry delay, or "immediate" (retry at
 * once: a working connection dropped, or a device switch).
 */
type Failure =
  | { readonly immediate: true }
  | {
      readonly immediate?: false;
      readonly status: (retryInMs: number | null) => SessionStatus;
      /** Wait for a permission change or retryNow() instead of a timer. */
      readonly waitForUser?: boolean;
    };

const IMMEDIATE: Failure = { immediate: true };

interface Attempt {
  readonly number: number;
  stage: Stage;
  openedAt: number;
  openFailedAfter: number;
  bridge: BridgeInfo | null;
  device: DeviceDescriptor | null;
  info: DeviceInfo | null;
  connectedAt: number | null;
  /** A poll read came back: the device's memory is readable. */
  readOk: boolean;
}

export class AutotrackSession {
  private readonly pack: AutotrackPack;
  private readonly url: string;
  private readonly createTransport: (pack: AutotrackPack) => Transport;
  private readonly clock: Clock;
  private readonly visibility: Visibility;
  private readonly permission: LocalNetworkPermission;
  private readonly environment: Environment | undefined;
  private readonly backoff: BackoffOptions;
  private readonly random: () => number;
  private readonly promptAfterMs: number;
  private readonly stableAfterMs: number;
  private readonly pauseWhenHidden: boolean;

  private current: SessionStatus = { code: "idle" };
  private since = 0;
  private readonly statusListeners = new Set<(status: SessionStatus) => void>();
  private readonly updateListeners = new Set<(update: PollUpdate) => void>();
  private readonly steadyListeners = new Set<(at: number) => void>();
  private generation = 0;
  private running = false;
  private transport: Transport | null = null;
  private poller: Poller | null = null;
  private timer: unknown = null;
  private promptTimer: unknown = null;
  private wake: ((proceed: boolean) => void) | null = null;
  private paused = false;
  private switching = false;
  private raceSetting: RaceSetting;
  private readonly optIns: Set<string>;
  /**
   * The gated ranges (`RangeSpec.when`) whose read failed, by device id: the
   * session does not ask that device for them again, through reconnections.
   */
  private readonly skipped = new Map<string, Set<string>>();
  private preferredDevice: string | null = null;
  private unsubscribers: (() => void)[] = [];
  private devices: readonly DeviceDescriptor[] = [];
  private bridge: BridgeInfo | null = null;

  constructor(options: SessionOptions) {
    this.pack = options.pack;
    this.url = options.url ?? DEFAULT_USB2SNES_URL;
    this.clock = options.clock ?? systemClock;
    this.createTransport =
      options.transport ??
      (() => new Usb2SnesTransport({ clock: this.clock, url: this.url }));
    this.visibility = options.visibility ?? systemVisibility;
    this.permission = options.permission ?? systemPermission();
    this.environment = options.environment;
    this.backoff = { ...DEFAULT_BACKOFF, ...options.backoff };
    this.random = options.random ?? Math.random;
    this.promptAfterMs = options.promptAfterMs ?? 1500;
    this.stableAfterMs = options.stableAfterMs ?? 5000;
    this.raceSetting = options.raceSetting ?? "auto";
    this.optIns = new Set(options.optIn);
    this.pauseWhenHidden = options.pauseWhenHidden ?? true;
  }

  get status(): SessionStatus {
    return this.current;
  }

  /** Clock time of the last status change. */
  get statusSince(): number {
    return this.since;
  }

  /** The memory read so far, while connected; null otherwise. */
  get snapshot(): MemorySnapshot | null {
    return this.poller;
  }

  get race(): RaceStatus | null {
    return this.poller?.race ?? null;
  }

  /** The bridge and the devices it listed, as last seen. */
  get seen(): {
    readonly bridge: BridgeInfo | null;
    readonly devices: readonly DeviceDescriptor[];
  } {
    return { bridge: this.bridge, devices: this.devices };
  }

  /** Calls `listener` on every status change; returns the unsubscribe. */
  subscribe(listener: (status: SessionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** Calls `listener` after every poll that changed memory. */
  onUpdate(listener: (update: PollUpdate) => void): () => void {
    this.updateListeners.add(listener);
    return () => {
      this.updateListeners.delete(listener);
    };
  }

  /**
   * Calls `listener` with the time after every poll that read memory and found
   * it unchanged: at most once a poll, and only while connected and in view
   * (a session paused for a hidden page polls nothing). A poll that changed
   * memory calls `onUpdate`'s listeners instead, and the first poll after
   * connecting always does: it reads every range for the first time. What a
   * steady poll says is that every range due on that tick held its bytes,
   * which tells a game's frame counter standing still (a paused emulator, a
   * frozen game) only if the pack reads that counter on every tick. A tick
   * that only an assist made due (a range behind `optIn`, read between two of
   * the pack's own) is no poll for this: it reads none of the pack's ranges.
   */
  onSteady(listener: (at: number) => void): () => void {
    this.steadyListeners.add(listener);
    return () => {
      this.steadyListeners.delete(listener);
    };
  }

  /**
   * Starts connecting. Call it from a user action while the permission is
   * "prompt", so the browser's prompt answers a click.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    const generation = ++this.generation;
    this.unsubscribers = [
      this.visibility.subscribe(() => {
        if (this.paused && !this.visibility.hidden()) this.wakeUp(true);
      }),
      this.permission.subscribe(() => this.wakeUp(true)),
    ];
    void this.loop(generation);
  }

  /** Stops everything: no timer, socket or listener survives. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.generation++;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    this.wakeUp(false);
    this.clearPromptTimer();
    this.transport?.close();
    this.transport = null;
    this.poller?.close();
    this.poller = null;
    this.paused = false;
    this.setStatus({ code: "stopped" });
  }

  /**
   * Reads bytes at addresses known only at run time (`Poller.request`): on
   * a coming poll, in its casual phase, never in Race Mode. Rejects at once
   * before the game is polled, and when the connection ends before the read.
   */
  request(read: OnDemandRead): Promise<Uint8Array[]> {
    if (this.poller === null) {
      return Promise.reject(
        new TransportError("closed", "read", "not connected to a game"),
      );
    }
    return this.poller.request(read);
  }

  /** Skips the current wait: retries now, or re-checks the game. */
  retryNow(): void {
    this.wakeUp(true);
  }

  setRaceMode(setting: RaceSetting): void {
    this.raceSetting = setting;
    this.poller?.setRaceSetting(setting);
    if (this.current.code === "connected" && this.poller !== null) {
      this.setStatus({ ...this.current, race: this.poller.race });
    }
  }

  /** Remembers that a device could not serve a gated range. */
  private skip(device: string, range: string): void {
    const ids = this.skipped.get(device) ?? new Set<string>();
    ids.add(range);
    this.skipped.set(device, ids);
  }

  /**
   * Turns an opt-in switch on or off (`RangeSpec.optIn`), now and for every
   * connection after: the ranges behind it are read only while it is on.
   */
  setOptIn(name: string, on: boolean): void {
    if (on) this.optIns.add(name);
    else this.optIns.delete(name);
    this.poller?.setOptIn(name, on);
  }

  /** Prefers a device by id (null: the first listed); reattaches if needed. */
  selectDevice(id: string | null): void {
    this.preferredDevice = id;
    const attached =
      this.current.code === "connected" ? this.current.device.device.id : null;
    if (attached !== null && id !== null && attached !== id) {
      this.switching = true;
      this.transport?.close();
      this.wakeUp(true);
    }
  }

  private alive(generation: number): boolean {
    return this.running && generation === this.generation;
  }

  private setStatus(status: SessionStatus, generation?: number): void {
    if (generation !== undefined && !this.alive(generation)) return;
    this.current = status;
    this.since = this.clock.now();
    for (const listener of this.statusListeners) listener(status);
  }

  private clearPromptTimer(): void {
    if (this.promptTimer !== null) this.clock.clearTimeout(this.promptTimer);
    this.promptTimer = null;
  }

  private wakeUp(proceed: boolean): void {
    this.wake?.(proceed);
  }

  /** Waits `ms`, or for wakeUp() when null; resolves false once stopped. */
  private wait(ms: number | null, generation: number): Promise<boolean> {
    return new Promise((resolve) => {
      const finish = (proceed: boolean) => {
        if (this.timer !== null) this.clock.clearTimeout(this.timer);
        this.timer = null;
        this.wake = null;
        resolve(proceed && this.alive(generation));
      };
      this.wake = finish;
      if (ms !== null)
        this.timer = this.clock.setTimeout(() => finish(true), ms);
    });
  }

  private async loop(generation: number): Promise<void> {
    let number = 0;
    while (this.alive(generation)) {
      number++;
      const failure = await this.connectOnce(generation, number);
      if (failure === null || !this.alive(generation)) return;
      if (failure.immediate) {
        number = 0;
        continue;
      }
      const delay = failure.waitForUser
        ? null
        : backoffDelay(number, this.backoff, this.random);
      this.setStatus(failure.status(delay), generation);
      if (!(await this.wait(delay, generation))) return;
    }
  }

  private async connectOnce(
    generation: number,
    number: number,
  ): Promise<Failure | null> {
    const transport = this.createTransport(this.pack);
    this.transport = transport;
    const attempt: Attempt = {
      bridge: null,
      connectedAt: null,
      device: null,
      info: null,
      number,
      openedAt: this.clock.now(),
      openFailedAfter: 0,
      readOk: false,
      stage: "open",
    };
    const alive = () => this.alive(generation);
    try {
      this.setStatus(
        { attempt: number, code: "connecting", url: this.url },
        generation,
      );
      const bridge = await this.openWatchingPrompt(
        transport,
        generation,
        attempt,
      );
      if (!alive()) return null;
      attempt.bridge = bridge;
      this.bridge = bridge;

      attempt.stage = "list";
      let devices: readonly DeviceDescriptor[] = [];
      for (let tries = 1; alive(); tries++) {
        devices = await transport.listDevices();
        this.devices = devices;
        if (devices.length > 0) break;
        const delay = backoffDelay(tries, this.backoff, this.random);
        this.setStatus(
          { bridge, code: "no-device", retryInMs: delay },
          generation,
        );
        if (!(await this.wait(delay, generation))) return null;
      }
      if (!alive()) return null;
      const device =
        devices.find((d) => d.id === this.preferredDevice) ?? devices[0];
      attempt.device = device;

      attempt.stage = "attach";
      this.setStatus(
        { bridge, code: "attaching", device, devices },
        generation,
      );
      const info = await transport.attach(device);
      if (!alive()) return null;
      attempt.info = info;

      attempt.stage = "check";
      const poller = new Poller(this.pack, transport, {
        now: () => this.clock.now(),
        // What failed to read on this device before is not asked again
        onSkip: (id) => this.skip(info.device.id, id),
        optIn: this.optIns,
        romReadable: info.romReadable,
        setting: this.raceSetting,
        skipped: this.skipped.get(info.device.id),
      });
      for (let tries = 1; ; tries++) {
        const verdict = await this.checkGame(poller, info, bridge);
        if (!alive()) return null;
        if (verdict === null) break;
        if ("cause" in verdict) {
          return {
            status: (retryInMs) => ({
              ...verdict,
              bridge,
              code: "memory-unreadable",
              device: info,
              retryInMs,
            }),
          };
        }
        const delay = backoffDelay(tries, this.backoff, this.random);
        const check = { code: verdict.code, message: verdict.message };
        this.setStatus(
          {
            bridge,
            check,
            code: "game-mismatch",
            device: info,
            retryInMs: delay,
          },
          generation,
        );
        if (!(await this.wait(delay, generation))) return null;
      }

      attempt.stage = "poll";
      this.poller = poller;
      attempt.connectedAt = this.clock.now();
      await this.poll(poller, info, bridge, generation, attempt);
      return null;
    } catch (error) {
      if (!alive()) return null;
      if (error instanceof RaceViolationError) {
        // A plan the guard refused before sending it: a bug. Stop, never loop.
        this.stop();
        return null;
      }
      return await this.failureFor(error, attempt);
    } finally {
      transport.close();
      if (this.transport === transport) this.transport = null;
      if (alive()) {
        this.poller?.close();
        this.poller = null;
      }
    }
  }

  /** Opens the transport; reports the permission prompt if it lingers. */
  private async openWatchingPrompt(
    transport: Transport,
    generation: number,
    attempt: Attempt,
  ): Promise<BridgeInfo> {
    let pending = true;
    this.promptTimer = this.clock.setTimeout(() => {
      this.promptTimer = null;
      void this.permission.query().then((permission) => {
        if (pending && permission.state === "prompt") {
          this.setStatus(
            { code: "local-network-prompt", permission, url: this.url },
            generation,
          );
        }
      });
    }, this.promptAfterMs);
    try {
      return await transport.open();
    } finally {
      pending = false;
      attempt.openFailedAfter = this.clock.now() - attempt.openedAt;
      this.clearPromptTimer();
    }
  }

  /** null when the game is right; a failed check or a read failure else. */
  private async checkGame(
    poller: Poller,
    info: DeviceInfo,
    bridge: BridgeInfo,
  ): Promise<null | Unreadable | Extract<GameCheckResult, { ok: false }>> {
    const check = this.pack.gameCheck;
    if (check === undefined) return null;
    const ids = check.ranges.map((index) => this.pack.ranges[index].id);
    if (ids.some((id) => poller.unreadable.includes(id))) {
      return unreadable(
        "rom-unreadable",
        "reply",
        info,
        bridge,
        info.flags.join(" "),
      );
    }
    await poller.readGameCheck();
    if (ids.every((id) => poller.bytes(id).every((byte) => byte === 0))) {
      return unreadable(
        "zero-filled",
        "inferred",
        info,
        bridge,
        "every byte read was zero",
      );
    }
    const result = check.verify((id) => poller.bytes(id), info);
    return result.ok ? null : result;
  }

  private async poll(
    poller: Poller,
    info: DeviceInfo,
    bridge: BridgeInfo,
    generation: number,
    attempt: Attempt,
  ): Promise<void> {
    const connected = (race: RaceStatus): SessionStatus => ({
      bridge,
      code: "connected",
      device: info,
      paused: this.paused,
      race,
      unreadable: poller.unreadable,
    });
    // The first poll comes before "connected", so the status already
    // carries the race flag it read.
    let race: RaceStatus | null = null;
    let unreadableCount = poller.unreadable.length;
    while (this.alive(generation)) {
      if (race !== null && this.pauseWhenHidden && this.visibility.hidden()) {
        this.paused = true;
        this.setStatus(connected(poller.race), generation);
        const resumed = await this.wait(null, generation);
        this.paused = false;
        if (!resumed) return;
        this.setStatus(connected(poller.race), generation);
        continue;
      }
      const started = this.clock.now();
      const update = await poller.tick();
      if (!this.alive(generation)) return;
      attempt.readOk = true;
      if (update !== null) {
        for (const listener of this.updateListeners) listener(update);
      } else if (poller.readBase) {
        const at = this.clock.now();
        for (const listener of this.steadyListeners) listener(at);
      }
      const next = poller.race;
      if (
        race === null ||
        next.active !== race.active ||
        next.flag !== race.flag ||
        next.overridden !== race.overridden ||
        next.setting !== race.setting ||
        poller.unreadable.length !== unreadableCount
      ) {
        race = next;
        unreadableCount = poller.unreadable.length;
        this.setStatus(connected(race), generation);
      }
      const elapsed = this.clock.now() - started;
      if (
        !(await this.wait(Math.max(0, this.pack.tickMs - elapsed), generation))
      )
        return;
    }
  }

  private async failureFor(error: unknown, attempt: Attempt): Promise<Failure> {
    const failed =
      error instanceof TransportError
        ? error
        : new TransportError(
            "protocol",
            "read",
            error instanceof Error ? error.message : String(error),
          );
    const detail = failed.detail.reason || failed.message;
    const url = this.url;
    const { bridge, device, info } = attempt;

    if (this.switching || failed.code === "superseded") {
      // A device switch, or a preferred bridge answering: start over now
      this.switching = false;
      return IMMEDIATE;
    }
    if (
      attempt.stage === "poll" &&
      attempt.connectedAt !== null &&
      (attempt.readOk ||
        this.clock.now() - attempt.connectedAt >= this.stableAfterMs)
    ) {
      // A working connection dropped (the emulator closed, a cable): start
      // over at once and let the next attempt diagnose what is left. Once a
      // read came back the memory is readable, so a drop is never the "no
      // memory map" that SNI's drop on a first read stands for.
      return IMMEDIATE;
    }
    if (attempt.stage === "open" && isOriginRefusal(failed)) {
      // Retrying would pop QUsb2Snes's question again: wait for a click.
      return {
        status: (retryInMs) => ({
          code: "bridge-refused",
          detail,
          retryInMs,
          url,
        }),
        waitForUser: true,
      };
    }
    if (bridge === null || attempt.stage === "list") {
      const permission = await this.permission
        .query()
        .catch(() => UNSUPPORTED_PERMISSION);
      return this.unreachable(attempt, permission, detail);
    }
    if (info === null || device === null) {
      return {
        status: (retryInMs) => ({
          bridge,
          code: "attach-failed",
          detail,
          device: device ?? { id: "", kind: "unknown" },
          retryInMs,
        }),
      };
    }
    const cause = classifyReadFailure(failed, info, bridge);
    return {
      status: (retryInMs) => ({
        ...cause,
        bridge,
        code: "memory-unreadable",
        device: info,
        retryInMs,
      }),
    };
  }

  private unreachable(
    attempt: Attempt,
    permission: PermissionState,
    detail: string,
  ): Failure {
    const url = this.url;
    if (this.environment?.loopback === "blocked") {
      const browser = this.environment.browser;
      return {
        status: (retryInMs) => ({
          browser,
          code: "browser-blocks-bridge",
          retryInMs,
          url,
        }),
        waitForUser: true,
      };
    }
    // Denied, or a prompt that was up and not accepted (the socket hung in
    // CONNECTING while it showed): re-asking on a timer would stack prompts,
    // and three dismissals block the site for 7 days in Chromium.
    if (
      permission.state === "denied" ||
      (permission.state === "prompt" &&
        attempt.openFailedAfter >= this.promptAfterMs)
    ) {
      return {
        status: (retryInMs) => ({
          code: "local-network-denied",
          permission,
          retryInMs,
          url,
        }),
        waitForUser: true,
      };
    }
    // Chromium 151+ shows the prompt even when nothing listens, so while the
    // permission is undecided a timer retry would prompt again; Firefox only
    // prompts once connected, so its retries are safe.
    const waitForUser =
      permission.state === "prompt" && this.environment?.browser !== "firefox";
    return {
      status: (retryInMs) => ({
        attempt: attempt.number,
        code: "bridge-unreachable",
        detail,
        permission,
        retryInMs,
        url,
      }),
      waitForUser,
    };
  }
}
