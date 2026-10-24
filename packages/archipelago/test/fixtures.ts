// The recorded fixtures (scripts/record-fixtures.mjs, never hand-edited) and
// the fakes every spec shares: a clock, page visibility and network state
// the specs drive by hand.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Clock, Online, Visibility } from "../src/platform";

const here = dirname(fileURLToPath(import.meta.url));

export type FrameDirection =
  | "in"
  | "out"
  | "open-attempt"
  | "open"
  | "close"
  | "error"
  | "mark";

export interface Frame {
  readonly t: number;
  readonly client: string;
  readonly dir: FrameDirection;
  readonly packets?: readonly Record<string, unknown>[];
  readonly note?: string;
  readonly url?: string;
}

export interface Fixture {
  readonly fixture: string;
  readonly recorded: string;
  readonly archipelago: string;
  readonly archipelagoJs: string;
  readonly frames: readonly Frame[];
  readonly [key: string]: unknown;
}

export type FixtureName =
  | "normal-session"
  | "refused"
  | "password"
  | "compatibility-0"
  | "slot-data-normal"
  | "slot-data-race"
  | "datapackage"
  | "archipelagojs-edges"
  | "sm-smz3-session";

const cache = new Map<string, Fixture>();

/** A recorded fixture; a deep copy each time, so a spec may change it. */
export function fixture(name: FixtureName): Fixture {
  let loaded = cache.get(name);
  if (loaded === undefined) {
    loaded = JSON.parse(
      readFileSync(join(here, "fixtures", `${name}.json`), "utf8"),
    ) as Fixture;
    cache.set(name, loaded);
  }
  return structuredClone(loaded);
}

/** Every packet the server sent `client`, in order. */
export function packetsTo(
  data: Fixture,
  client: string,
): Record<string, unknown>[] {
  return data.frames
    .filter((frame) => frame.client === client && frame.dir === "in")
    .flatMap((frame) => frame.packets ?? []);
}

/** Every frame the server sent `client`, each a list of packets. */
export function framesTo(
  data: Fixture,
  client: string,
): Record<string, unknown>[][] {
  return data.frames
    .filter((frame) => frame.client === client && frame.dir === "in")
    .map((frame) => [...(frame.packets ?? [])]);
}

/** Every packet `client` sent, in order. */
export function packetsFrom(
  data: Fixture,
  client: string,
): Record<string, unknown>[] {
  return data.frames
    .filter((frame) => frame.client === client && frame.dir === "out")
    .flatMap((frame) => frame.packets ?? []);
}

/** A game's recorded data package (test/datapackages). */
export function dataPackage(game: string): Record<string, unknown> {
  const file = `${game.replace(/[^A-Za-z0-9]+/g, "_")}.json`;
  return JSON.parse(
    readFileSync(join(here, "datapackages", file), "utf8"),
  ) as Record<string, unknown>;
}

/** A clock the spec advances by hand. */
export class ManualClock implements Clock {
  private time = 1_000_000;
  private next = 1;
  private readonly timers = new Map<number, { at: number; run: () => void }>();

  now(): number {
    return this.time;
  }

  setTimeout(callback: () => void, ms: number): unknown {
    const id = this.next++;
    this.timers.set(id, { at: this.time + ms, run: callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  /** Timers still pending. */
  get pending(): number {
    return this.timers.size;
  }

  /** Moves time on by `ms`, running each timer due, in order, with microtasks between. */
  async advance(ms: number): Promise<void> {
    const end = this.time + ms;
    for (;;) {
      await flush();
      let due: [number, { at: number; run: () => void }] | undefined;
      for (const entry of this.timers) {
        if (
          entry[1].at <= end &&
          (due === undefined || entry[1].at < due[1].at)
        ) {
          due = entry;
        }
      }
      if (due === undefined) break;
      this.timers.delete(due[0]);
      this.time = Math.max(this.time, due[1].at);
      due[1].run();
    }
    this.time = end;
    await flush();
  }
}

/** Lets pending promise callbacks and queued socket events run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise<void>((r) => setImmediate(r));
}

export class FakeVisibility implements Visibility {
  private listeners = new Set<() => void>();
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

  get listening(): number {
    return this.listeners.size;
  }
}

export class FakeOnline implements Online {
  private listeners = new Set<() => void>();
  isOnline = true;

  online(): boolean {
    return this.isOnline;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(online: boolean): void {
    this.isOnline = online;
    for (const listener of this.listeners) listener();
  }

  get listening(): number {
    return this.listeners.size;
  }
}
