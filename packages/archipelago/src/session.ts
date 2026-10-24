// The tracker's session with an Archipelago room: a read-only Tracker on
// one slot, which reconnects on its own and folds what the server says into
// a snapshot.
//
// One run loop owns everything. Each start() opens a generation; stop() ends
// it, wakes any wait, closes the socket and drops every listener, so a
// stopped session holds no timer and no socket, and a stale attempt never
// writes. Each attempt uses a fresh archipelago.js Client (a reused one
// leaks listeners at every login) on a socket this module creates, guards
// and times itself (README, "archipelago.js edges").

import { Client, LoginError } from "archipelago.js";
import {
  addressClass,
  type ConnectPlan,
  connectPlan,
  isArchipelagoGg,
  type PageContext,
  type ServerAddress,
} from "./address";
import {
  isRefusalReason,
  PAUSED_AFTER_FAILURES,
  type SessionStatus,
  type TimeoutStage,
  unreachableHint,
} from "./diagnostics";
import { type GuardError, guardSocket, TRACKER_TAGS } from "./guard";
import {
  type Clock,
  type Online,
  systemClock,
  systemOnline,
  systemUuid,
  systemVisibility,
  systemWebSocket,
  type Visibility,
  type WebSocketFactory,
  type WebSocketLike,
  withWebSocket,
} from "./platform";
import {
  type ApSnapshot,
  beginConnection,
  EMPTY_SNAPSHOT,
  reduce,
} from "./snapshot";

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
  maxMs: 30_000,
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

export interface Timeouts {
  /** From `new WebSocket` to its open event. */
  readonly socketMs: number;
  /** From the open event to RoomInfo (archipelago.js waits forever). */
  readonly roomInfoMs: number;
  /** From Connect to Connected or ConnectionRefused. */
  readonly loginMs: number;
  /** A Get or GetDataPackage waiting for its answer. */
  readonly requestMs: number;
  /** Between keepalives while connected and visible. */
  readonly keepaliveEveryMs: number;
  /** A keepalive unanswered this long means the link is dead. */
  readonly keepaliveDeadlineMs: number;
  /** A connection that lived this long resets the backoff when it drops. */
  readonly stableMs: number;
  /** The retry delay once archipelago.gg looks paused. */
  readonly pausedRetryMs: number;
}

export const DEFAULT_TIMEOUTS: Timeouts = {
  keepaliveDeadlineMs: 10_000,
  keepaliveEveryMs: 30_000,
  loginMs: 10_000,
  pausedRetryMs: 60_000,
  requestMs: 10_000,
  roomInfoMs: 8000,
  socketMs: 8000,
  stableMs: 10_000,
};

/**
 * One connection per browser: the app's Web Lock (plan: `createTabLock`).
 * The shape is `apps/web`'s autotracking lock's.
 */
export interface TabLock {
  /**
   * Takes the lock: at once when free, else once the holder lets it go,
   * calling `waiting(true)` meanwhile. Resolves false once no longer wanted.
   */
  take(
    isCurrent: () => boolean,
    waiting: (elsewhere: boolean) => void,
  ): Promise<boolean>;
  /** Stops waiting, and lets the lock go if held. */
  release(): void;
}

/** No lock: every session connects (tests, a host without Web Locks). */
export const NO_LOCK: TabLock = {
  release: () => {},
  take: async () => true,
};

export interface SessionOptions {
  readonly address: ServerAddress;
  /** Where the tracker runs: decides which URLs may be tried. */
  readonly page: PageContext;
  /** The slot name, case-sensitive, as the room lists it. */
  readonly slot: string;
  readonly password?: string;
  /**
   * This device's id, kept by the app. archipelago.js would give every
   * Client of the page one shared id.
   */
  readonly uuid?: string;
  /** The persisted snapshot to start from. */
  readonly snapshot?: ApSnapshot;
  readonly lock?: TabLock;
  readonly clock?: Clock;
  readonly visibility?: Visibility;
  readonly online?: Online;
  readonly webSocket?: WebSocketFactory;
  readonly timeouts?: Partial<Timeouts>;
  readonly backoff?: Partial<BackoffOptions>;
  readonly random?: () => number;
}

/** Every packet the server sends is plain JSON. */
export type ServerPacket = Readonly<Record<string, unknown>> & {
  readonly cmd: string;
};

/** A request that got no answer in time, or a connection that went away. */
export class RequestError extends Error {
  override readonly name = "RequestError";
}

/** What ended an attempt. */
type Outcome =
  | { readonly kind: "stopped" }
  | { readonly kind: "refused"; readonly reasons: readonly string[] }
  | { readonly kind: "blocked" }
  | { readonly kind: "unreachable"; readonly url: string }
  | {
      readonly kind: "timeout";
      readonly url: string;
      readonly stage: TimeoutStage;
    }
  | {
      readonly kind: "dropped";
      readonly url: string;
      readonly livedMs: number;
    };

/** One request waiting for its answer on a connection. */
interface Waiter {
  packet(packet: ServerPacket): void;
  closed(): void;
}

interface Connection {
  readonly generation: number;
  readonly client: Client;
  readonly url: string;
  socket: WebSocketLike | null;
  /** Answer handlers for this connection's own requests. */
  readonly waiters: Set<Waiter>;
  timer: unknown;
  keepalive: unknown;
  /** Ends the attempt; the first call wins. */
  settle: (outcome: Outcome) => void;
}

const isPacket = (value: unknown): value is ServerPacket =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { cmd?: unknown }).cmd === "string";

export class ArchipelagoSession {
  private readonly address: ServerAddress;
  private readonly page: PageContext;
  private readonly slot: string;
  private readonly password: string;
  private readonly uuid: string;
  private readonly lock: TabLock;
  private readonly clock: Clock;
  private readonly visibility: Visibility;
  private readonly online: Online;
  private readonly webSocket: WebSocketFactory;
  private readonly timeouts: Timeouts;
  private readonly backoff: BackoffOptions;
  private readonly random: () => number;

  private current: SessionStatus = { code: "idle" };
  private since = 0;
  private state: ApSnapshot;
  private readonly statusListeners = new Set<(status: SessionStatus) => void>();
  private readonly snapshotListeners = new Set<
    (snapshot: ApSnapshot, reset: boolean) => void
  >();
  private readonly packetListeners = new Set<(packet: ServerPacket) => void>();
  private generation = 0;
  private running = false;
  private connection: Connection | null = null;
  private timer: unknown = null;
  private wake: ((byUser: boolean) => void) | null = null;
  private unsubscribers: (() => void)[] = [];
  /** The candidate URL that worked last, tried first next time. */
  private preferredUrl: string | null = null;
  private requestCounter = 0;

  constructor(options: SessionOptions) {
    this.address = options.address;
    this.page = options.page;
    this.slot = options.slot;
    this.password = options.password ?? "";
    this.uuid = options.uuid ?? systemUuid();
    this.lock = options.lock ?? NO_LOCK;
    this.clock = options.clock ?? systemClock;
    this.visibility = options.visibility ?? systemVisibility;
    this.online = options.online ?? systemOnline;
    this.webSocket = options.webSocket ?? systemWebSocket;
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts };
    this.backoff = { ...DEFAULT_BACKOFF, ...options.backoff };
    this.random = options.random ?? Math.random;
    this.state = options.snapshot ?? EMPTY_SNAPSHOT;
  }

  get status(): SessionStatus {
    return this.current;
  }

  /** Clock time of the last status change. */
  get statusSince(): number {
    return this.since;
  }

  get snapshot(): ApSnapshot {
    return this.state;
  }

  /** Calls `listener` on every status change; returns the unsubscribe. */
  subscribe(listener: (status: SessionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Calls `listener` whenever the snapshot changes; `reset` when Connected
   * named another run and the old one was dropped.
   */
  onSnapshot(
    listener: (snapshot: ApSnapshot, reset: boolean) => void,
  ): () => void {
    this.snapshotListeners.add(listener);
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  /** Calls `listener` with every packet the server sends (the feed reads them). */
  onPacket(listener: (packet: ServerPacket) => void): () => void {
    this.packetListeners.add(listener);
    return () => {
      this.packetListeners.delete(listener);
    };
  }

  /** Starts connecting; a started session keeps trying until stopped. */
  start(): void {
    if (this.running) return;
    this.running = true;
    const generation = ++this.generation;
    this.unsubscribers = [
      this.visibility.subscribe(() => this.onVisibility()),
      this.online.subscribe(() => {
        if (this.online.online()) this.wakeUp(false);
      }),
    ];
    void this.run(generation);
  }

  /** Stops everything: no timer, socket or listener survives. */
  stop(detail?: string): void {
    if (!this.running) return;
    this.running = false;
    this.generation++;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    this.wake?.(true);
    this.lock.release();
    this.closeConnection({ kind: "stopped" });
    this.setStatus(
      detail === undefined ? { code: "stopped" } : { code: "stopped", detail },
    );
  }

  /** Skips the current wait: after a refusal, or a backoff. */
  retryNow(): void {
    this.wakeUp(true);
  }

  /**
   * Reads server-owned data storage keys (`_read_…` only: the guard refuses
   * any other). Rejects when not connected or unanswered in time.
   */
  get(keys: readonly string[]): Promise<Record<string, unknown>> {
    return this.readKeys(keys, this.timeouts.requestMs);
  }

  /** One game's name data from the server (GetDataPackage). */
  getDataPackage(game: string): Promise<unknown> {
    return this.request(
      { cmd: "GetDataPackage", games: [game] },
      this.timeouts.requestMs,
      (packet) => {
        // Only this game's answer: two requests may be in flight.
        const games = (packet.data as { games?: Record<string, unknown> })
          ?.games;
        return packet.cmd === "DataPackage" && games && game in games
          ? games[game]
          : undefined;
      },
    );
  }

  private readKeys(
    keys: readonly string[],
    timeoutMs: number,
  ): Promise<Record<string, unknown>> {
    const uuid = `rando-atlas-${++this.requestCounter}`;
    return this.request(
      { cmd: "Get", keys: [...keys], uuid },
      timeoutMs,
      (packet) =>
        packet.cmd === "Retrieved" && packet.uuid === uuid
          ? (packet.keys as Record<string, unknown>)
          : undefined,
    );
  }

  private request<T>(
    packet: Record<string, unknown>,
    timeoutMs: number,
    answer: (packet: ServerPacket) => T | undefined,
  ): Promise<T> {
    const connection = this.connection;
    if (connection === null || this.current.code !== "connected") {
      return Promise.reject(new RequestError("Not connected"));
    }
    try {
      // Through archipelago.js, so its own bookkeeping sees the packet; the
      // guarded socket under it checks the frame first. Answers arrive on a
      // later turn, so waiting starts after sending.
      connection.client.socket.send(packet as never);
    } catch (error) {
      return Promise.reject(error);
    }
    return new Promise<T>((resolve, reject) => {
      const finish = () => {
        connection.waiters.delete(waiter);
        this.clock.clearTimeout(timer);
      };
      const waiter: Waiter = {
        closed: () => {
          finish();
          reject(new RequestError("The connection closed"));
        },
        packet: (incoming) => {
          const value = answer(incoming);
          if (value === undefined) return;
          finish();
          resolve(value);
        },
      };
      const timer = this.clock.setTimeout(() => {
        finish();
        reject(new RequestError(`No answer to ${String(packet.cmd)} in time`));
      }, timeoutMs);
      connection.waiters.add(waiter);
    });
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

  private setSnapshot(snapshot: ApSnapshot, reset: boolean): void {
    if (snapshot === this.state) return;
    this.state = snapshot;
    for (const listener of this.snapshotListeners) listener(snapshot, reset);
  }

  /**
   * Ends the current wait. A user's retry ends any wait; coming back online
   * or visible ends only a backoff, never a refusal.
   */
  private wakeUp(byUser: boolean): void {
    this.wake?.(byUser);
  }

  private onVisibility(): void {
    if (this.visibility.hidden()) return;
    const connection = this.connection;
    if (connection !== null && this.current.code === "connected") {
      // A laptop that slept fires no close: check the link at once.
      this.keepalive(connection);
    } else {
      this.wakeUp(false);
    }
  }

  /**
   * Waits `ms` (null: until the user acts), or until woken. Resolves false
   * once stopped.
   */
  private wait(ms: number | null, generation: number): Promise<boolean> {
    return new Promise((resolve) => {
      const finish = (byUser: boolean) => {
        if (ms === null && !byUser && this.alive(generation)) return;
        if (this.timer !== null) this.clock.clearTimeout(this.timer);
        this.timer = null;
        this.wake = null;
        resolve(this.alive(generation));
      };
      this.wake = finish;
      if (ms !== null) {
        this.timer = this.clock.setTimeout(() => finish(true), ms);
      }
    });
  }

  private async run(generation: number): Promise<void> {
    const plan = connectPlan(this.address, this.page);
    if (!plan.ok) {
      this.setStatus(this.blockedStatus(plan), generation);
      return;
    }
    const held = await this.lock.take(
      () => this.alive(generation),
      (elsewhere) => {
        if (elsewhere) this.setStatus({ code: "elsewhere" }, generation);
      },
    );
    if (!held || !this.alive(generation)) return;

    let failures = 0;
    while (this.alive(generation)) {
      const outcome = await this.attempt(generation, failures + 1, plan.urls);
      if (!this.alive(generation)) return;
      switch (outcome.kind) {
        case "blocked":
          return;
        case "refused": {
          failures = 0;
          if (!(await this.wait(null, generation))) return;
          break;
        }
        case "dropped": {
          if (outcome.livedMs >= this.timeouts.stableMs) failures = 0;
          failures++;
          const delay = backoffDelay(failures, this.backoff, this.random);
          this.setStatus(
            {
              attempt: failures,
              code: "reconnecting",
              retryInMs: delay,
              url: outcome.url,
            },
            generation,
          );
          if (!(await this.wait(delay, generation))) return;
          break;
        }
        case "unreachable":
        case "timeout": {
          failures++;
          const status = this.failedStatus(outcome, failures);
          this.setStatus(status, generation);
          if (!(await this.wait(status.retryInMs, generation))) return;
          break;
        }
      }
    }
  }

  /**
   * A failed attempt's status, with the wait before the next: the backoff,
   * or 60 s once an archipelago.gg room looks paused.
   */
  private failedStatus(
    outcome: Extract<Outcome, { kind: "unreachable" | "timeout" }>,
    failures: number,
  ): Extract<SessionStatus, { code: "unreachable" | "timeout" }> {
    const backoff = backoffDelay(failures, this.backoff, this.random);
    if (outcome.kind === "timeout") {
      const paused =
        failures >= PAUSED_AFTER_FAILURES && isArchipelagoGg(this.address.host);
      return {
        attempt: failures,
        code: "timeout",
        retryInMs: paused ? this.timeouts.pausedRetryMs : backoff,
        stage: outcome.stage,
        url: outcome.url,
      };
    }
    const hint = unreachableHint({
      failures,
      online: this.online.online(),
      url: outcome.url,
    });
    return {
      attempt: failures,
      code: "unreachable",
      hint,
      retryInMs: hint === "room-paused" ? this.timeouts.pausedRetryMs : backoff,
      url: outcome.url,
    };
  }

  private blockedStatus(
    plan: Extract<ConnectPlan, { ok: false }>,
  ): SessionStatus {
    if (plan.code === "blocked-browser" && this.page.kind === "secure") {
      return {
        addressClass: plan.addressClass,
        browser: this.page.browser,
        code: "blocked-browser",
      };
    }
    return { addressClass: plan.addressClass, code: "blocked-insecure" };
  }

  /** Tries each URL in turn; the next one only when this one is not there. */
  private async attempt(
    generation: number,
    number: number,
    urls: readonly string[],
  ): Promise<Outcome> {
    const ordered =
      this.preferredUrl !== null && urls.includes(this.preferredUrl)
        ? [this.preferredUrl, ...urls.filter((u) => u !== this.preferredUrl)]
        : urls;
    let outcome: Outcome = { kind: "stopped" };
    for (const url of ordered) {
      outcome = await this.connectTo(generation, number, url);
      const tryNext =
        outcome.kind === "unreachable" ||
        (outcome.kind === "timeout" && outcome.stage === "socket");
      if (!tryNext || !this.alive(generation)) return outcome;
    }
    return outcome;
  }

  private connectTo(
    generation: number,
    number: number,
    url: string,
  ): Promise<Outcome> {
    return new Promise<Outcome>((resolve) => {
      let settled = false;
      let connectedAt: number | null = null;
      const client = new Client({
        autoFetchDataPackage: false,
        debugLogVersions: false,
        maximumMessages: 0,
        // Ours fire first; theirs only rejects a promise already settled.
        timeout: this.timeouts.loginMs + 60_000,
      });
      const connection: Connection = {
        client,
        generation,
        keepalive: null,
        settle: (outcome) => {
          if (settled) return;
          settled = true;
          this.closeConnection(outcome, connection);
          resolve(outcome);
        },
        socket: null,
        timer: null,
        url,
        waiters: new Set(),
      };
      this.connection = connection;
      this.setSnapshot(beginConnection(this.state), false);

      const arm = (stage: TimeoutStage, ms: number) => {
        if (connection.timer !== null)
          this.clock.clearTimeout(connection.timer);
        connection.timer = this.clock.setTimeout(
          () => connection.settle({ kind: "timeout", stage, url }),
          ms,
        );
      };

      client.socket.on("receivedPacket", (packet: unknown) => {
        if (!this.alive(generation) || this.connection !== connection) return;
        if (!isPacket(packet)) return;
        if (packet.cmd === "RoomInfo" && connectedAt === null) {
          this.setStatus(
            { attempt: number, code: "authenticating", url },
            generation,
          );
          arm("login", this.timeouts.loginMs);
        }
        this.receive(connection, packet);
      });
      client.socket.on("disconnected", () => {
        if (connectedAt !== null) {
          connection.settle({
            kind: "dropped",
            livedMs: this.clock.now() - connectedAt,
            url,
          });
        }
      });

      const factory: WebSocketFactory = (target) => {
        const socket = guardSocket(this.webSocket(target), (error) =>
          this.onGuard(error),
        );
        connection.socket = socket;
        socket.addEventListener("open", () => {
          if (settled) return;
          this.setStatus(
            { attempt: number, code: "connecting", stage: "room-info", url },
            generation,
          );
          arm("room-info", this.timeouts.roomInfoMs);
        });
        return socket;
      };

      this.setStatus(
        { attempt: number, code: "connecting", stage: "socket", url },
        generation,
      );
      arm("socket", this.timeouts.socketMs);
      // login() is async: whatever goes wrong comes back as a rejection.
      const login = withWebSocket(factory, () =>
        client.login(url, this.slot, "", {
          items: 0b111,
          password: this.password,
          slotData: true,
          tags: [...TRACKER_TAGS],
          uuid: this.uuid,
        }),
      );
      login.then(
        () => {
          if (settled) return;
          connectedAt = this.clock.now();
          if (connection.timer !== null) {
            this.clock.clearTimeout(connection.timer);
            connection.timer = null;
          }
          this.preferredUrl = url;
          this.setStatus({ code: "connected", url }, generation);
          // The race flag at once; the keepalive re-reads it every 30 s.
          this.get(["_read_race_mode"]).catch(() => {});
          this.scheduleKeepalive(connection);
        },
        (error: unknown) => {
          if (settled) return;
          connection.settle(this.failure(error, url, generation));
        },
      );
    });
  }

  /** What a rejected login means. Messages are never parsed: `errors` is. */
  private failure(error: unknown, url: string, generation: number): Outcome {
    // (A GuardError never gets here: onGuard() has stopped the session.)
    if (error instanceof LoginError) {
      const reasons = [...error.errors].sort(
        (a, b) => Number(!isRefusalReason(a)) - Number(!isRefusalReason(b)),
      );
      this.setStatus(
        {
          code: "refused",
          reasons,
          serverVersion: this.state.room?.serverVersion ?? null,
          url,
        },
        generation,
      );
      return { kind: "refused", reasons };
    }
    if ((error as { name?: unknown } | null)?.name === "SecurityError") {
      // The browser refused the socket outright: mixed content it blocks
      // although the static check let it through (an unknown browser).
      this.setStatus(
        {
          addressClass: addressClass(this.address.host),
          code: "blocked-insecure",
        },
        generation,
      );
      return { kind: "blocked" };
    }
    return { kind: "unreachable", url };
  }

  private onGuard(error: GuardError): void {
    // A packet off the whitelist is a bug: stop, never loop on it.
    this.stop(error.message);
  }

  private receive(connection: Connection, packet: ServerPacket): void {
    const { reset, snapshot, sync } = reduce(this.state, packet);
    this.setSnapshot(snapshot, reset);
    // Sent from inside a message handler: the socket is open.
    if (sync) connection.client.socket.send({ cmd: "Sync" });
    for (const waiter of [...connection.waiters]) waiter.packet(packet);
    for (const listener of this.packetListeners) listener(packet);
  }

  private scheduleKeepalive(connection: Connection): void {
    if (connection.keepalive !== null) {
      this.clock.clearTimeout(connection.keepalive);
    }
    connection.keepalive = this.clock.setTimeout(() => {
      connection.keepalive = null;
      if (this.visibility.hidden()) {
        // Hidden: no traffic; the return to the page checks at once.
        return;
      }
      this.keepalive(connection);
    }, this.timeouts.keepaliveEveryMs);
  }

  /** A Get that must come back in time, or the link is dead. */
  private keepalive(connection: Connection): void {
    this.readKeys(["_read_race_mode"], this.timeouts.keepaliveDeadlineMs).then(
      () => this.scheduleKeepalive(connection),
      // Unanswered in time, or closed meanwhile (then settle does nothing).
      () =>
        connection.settle({
          kind: "timeout",
          stage: "keepalive",
          url: connection.url,
        }),
    );
  }

  /** Closes `connection` (default: the current one) and every timer it holds. */
  private closeConnection(
    outcome: Outcome,
    connection = this.connection,
  ): void {
    if (connection === null) return;
    if (this.connection === connection) {
      this.connection = null;
      // What is on screen is no longer current.
      this.setSnapshot(beginConnection(this.state), false);
    }
    if (connection.timer !== null) this.clock.clearTimeout(connection.timer);
    if (connection.keepalive !== null) {
      this.clock.clearTimeout(connection.keepalive);
    }
    connection.timer = null;
    connection.keepalive = null;
    for (const waiter of [...connection.waiters]) waiter.closed();
    // The library cannot close a socket that never got RoomInfo (its
    // disconnect() returns early), so the raw socket is closed too.
    connection.client.socket.disconnect();
    connection.socket?.close();
    connection.settle(outcome);
  }
}
