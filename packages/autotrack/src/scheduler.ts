// The poller: reads what a pack's cadences make due on each tick, through
// plans built once per due set and mode, into buffers allocated once per
// attach.
//
// A tick runs in two phases. The race phase reads the race flag, the mode
// probe and the ranges of race-permitted categories, through a plan the race
// guard has checked. The casual phase reads the other ranges, and runs only
// when Race Mode is off after the flag just read, so a race ROM loaded
// mid-session is caught before any forbidden byte is requested from it.
//
// Plans follow the last mode the probe reported. When the probe reports
// another one, the tick keeps only the ranges every mode shares, skips the
// casual phase, and the next tick reads the new layout: a portal crossing in
// SMZ3 costs one tick, not a round trip on every tick.

import { ALL_MODES, type AutotrackPack } from "./pack";
import { type ByteRange, EMPTY_PLAN, planReads, type ReadPlan } from "./plan";
import { assertRaceSafe } from "./race";
import {
  type RaceFlagState,
  type RaceSetting,
  type RaceStatus,
  raceStatus,
} from "./race-mode";
import type { Transport } from "./transport";

/** The last bytes read for each range. Views stay valid until detach. */
export interface MemorySnapshot {
  /** Current bytes of a range (zeros until first read). */
  bytes(id: string): Uint8Array;
  /** The bytes a range held before its last change. */
  previous(id: string): Uint8Array;
  /** Whether the range has been read at least once. */
  has(id: string): boolean;
  /** The pack's current mode, or null (no modes, or not told yet). */
  readonly mode: string | null;
}

/** Passed to change listeners; the same object every time, updated. */
export interface PollUpdate {
  /** Ticks since attach. */
  readonly tick: number;
  readonly at: number;
  /** Ids whose bytes changed (first reads included). Valid in the callback. */
  readonly changed: readonly string[];
  /** Whether the mode changed on this tick. */
  readonly modeChanged: boolean;
  readonly snapshot: MemorySnapshot;
}

const FLAG = 0xffff_ffff;
const UNKNOWN_MODE = -1;

interface Phase {
  readonly plan: ReadPlan;
  /** Range index of each planned input range, or FLAG. */
  readonly members: Uint32Array;
}

interface DuePlans {
  readonly race: Phase;
  readonly casual: Phase;
}

const NO_PHASE: Phase = { members: new Uint32Array(0), plan: EMPTY_PLAN };

export class Poller implements MemorySnapshot {
  /** Ranges this device cannot serve (ROM ranges when ROM is unreadable). */
  readonly unreadable: readonly string[];
  private readonly current: Uint8Array[] = [];
  private readonly prior: Uint8Array[] = [];
  private readonly seen: Uint8Array;
  private readonly flagBytes: Uint8Array;
  private readonly probeBytes: Uint8Array;
  private readonly plans = new Map<number, DuePlans>();
  private readonly checkPlan: Phase;
  private readonly build: (set: number, mode: number) => DuePlans;
  private readonly now: () => number;
  private scratch: Uint8Array;
  private readonly changedIds: string[] = [];
  private readonly update: {
    at: number;
    changed: string[];
    modeChanged: boolean;
    snapshot: MemorySnapshot;
    tick: number;
  };
  private setting: RaceSetting;
  private flag: RaceFlagState;
  private modeIndex = UNKNOWN_MODE;
  private ticks = 0;

  constructor(
    private readonly pack: AutotrackPack,
    private readonly transport: Transport,
    options: {
      readonly romReadable: boolean;
      readonly setting: RaceSetting;
      readonly now: () => number;
    },
  ) {
    const romOk = (range: ByteRange) =>
      options.romReadable || range.address >= 0xe0_0000;
    let total = 0;
    const slots = pack.ranges.map((range) => {
      const slot = total;
      total += range.size;
      return slot;
    });
    const values = new Uint8Array(total);
    const before = new Uint8Array(total);
    pack.ranges.forEach((range, index) => {
      const end = slots[index] + range.size;
      this.current.push(values.subarray(slots[index], end));
      this.prior.push(before.subarray(slots[index], end));
    });
    this.seen = new Uint8Array(pack.ranges.length);
    this.unreadable = pack.ranges.filter((r) => !romOk(r)).map((r) => r.id);
    const readable = pack.ranges.map(romOk);
    const flag = pack.raceFlag;
    const flagReadable = flag !== null && romOk(flag);
    this.flagBytes = new Uint8Array(flag?.size ?? 0);
    this.probeBytes = new Uint8Array(
      pack.modes === null ? 0 : pack.ranges[pack.modes.probe].size,
    );
    this.flag =
      flag === null ? "none" : flagReadable ? "pending" : "unreadable";
    this.setting = options.setting;
    this.now = options.now;
    const probe = pack.modes?.probe ?? -1;

    const phase = (
      indices: readonly number[],
      race: boolean,
      mode: number,
    ): Phase => {
      const members: number[] = [];
      const ranges: ByteRange[] = [];
      const add = (index: number) => {
        members.push(index);
        ranges.push(pack.ranges[index]);
      };
      const inMode = (index: number) =>
        pack.modeMasks[index] === ALL_MODES ||
        (mode !== UNKNOWN_MODE && (pack.modeMasks[index] & (1 << mode)) !== 0);
      for (const index of indices) {
        if (index === probe || !readable[index] || !inMode(index)) continue;
        if (pack.racePermitted[index] === race) add(index);
      }
      // The flag and the probe ride with every tick that reads anything.
      if (race && indices.length > 0) {
        if (probe >= 0 && readable[probe]) add(probe);
        if (flag !== null && flagReadable) {
          members.push(FLAG);
          ranges.push(flag);
        }
      }
      if (ranges.length === 0) return NO_PHASE;
      const plan = planReads(ranges, {
        barriers: race ? pack.raceBarriers : [],
        gap: pack.gap,
        limits: transport.limits,
      });
      if (race)
        assertRaceSafe(
          plan,
          pack.profile,
          pack.permittedBytes,
          pack.forbiddenBytes,
        );
      return { members: Uint32Array.from(members), plan };
    };
    this.build = (set, mode) => ({
      casual: phase(pack.dueSets[set], false, mode),
      race: phase(pack.dueSets[set], true, mode),
    });
    this.checkPlan =
      pack.gameCheck === undefined
        ? NO_PHASE
        : phase(pack.gameCheck.ranges, true, UNKNOWN_MODE);
    this.scratch = new Uint8Array(this.checkPlan.plan.size);
    this.update = {
      at: 0,
      changed: this.changedIds,
      modeChanged: false,
      snapshot: this,
      tick: 0,
    };
  }

  get race(): RaceStatus {
    return raceStatus(
      this.setting,
      this.flag,
      this.pack.forbiddenBytes.length > 0,
    );
  }

  get mode(): string | null {
    return this.modeIndex === UNKNOWN_MODE
      ? null
      : (this.pack.modes?.names[this.modeIndex] ?? null);
  }

  setRaceSetting(setting: RaceSetting): void {
    this.setting = setting;
  }

  bytes(id: string): Uint8Array {
    return this.current[this.index(id)];
  }

  previous(id: string): Uint8Array {
    return this.prior[this.index(id)];
  }

  has(id: string): boolean {
    return this.seen[this.index(id)] === 1;
  }

  /**
   * Reads the game check's ranges (race-permitted by construction), with
   * the race flag and the mode probe, so the first poll already knows both.
   */
  async readGameCheck(): Promise<void> {
    this.changedIds.length = 0;
    await this.fetch(this.checkPlan);
    this.readControls(this.checkPlan);
    this.scatter(this.checkPlan, false);
  }

  /**
   * Polls once: the race phase, then the casual phase if Race Mode is off.
   * Returns the update when something changed, null otherwise.
   */
  async tick(): Promise<PollUpdate | null> {
    const pack = this.pack;
    const set = pack.cycle[this.ticks % pack.cycle.length];
    const planned = this.modeIndex;
    const key = set * 33 + planned + 1;
    let plans = this.plans.get(key);
    if (plans === undefined) {
      plans = this.build(set, planned);
      this.plans.set(key, plans);
    }
    this.changedIds.length = 0;
    await this.fetch(plans.race);
    this.readControls(plans.race);
    const switched = this.modeIndex !== planned;
    this.scatter(plans.race, switched);
    // Decided after the race phase, on the flag it just read; a new mode
    // means this tick's casual plan was for the old layout.
    if (!switched && !this.raceActive()) {
      await this.fetch(plans.casual);
      this.scatter(plans.casual, false);
    }
    this.ticks++;
    if (this.changedIds.length === 0 && !switched) return null;
    this.update.tick = this.ticks;
    this.update.at = this.now();
    this.update.modeChanged = switched;
    return this.update;
  }

  /** `race.active` without building the status object. */
  private raceActive(): boolean {
    return (
      this.setting === "on" ||
      (this.setting === "auto" && this.flag !== "open" && this.flag !== "none")
    );
  }

  private index(id: string): number {
    const index = this.pack.indexOf.get(id);
    if (index === undefined) throw new RangeError(`Unknown range "${id}"`);
    return index;
  }

  private async fetch(phase: Phase): Promise<void> {
    const { plan } = phase;
    if (plan.size === 0) return;
    if (this.scratch.length < plan.size)
      this.scratch = new Uint8Array(plan.size);
    for (const request of plan.requests) {
      await this.transport.read(request, this.scratch, request.offset);
    }
  }

  /** Decodes the race flag and the mode probe from a fetched race phase. */
  private readControls(phase: Phase): void {
    const { plan, members } = phase;
    const scratch = this.scratch;
    const modes = this.pack.modes;
    for (let k = 0; k < members.length; k++) {
      const index = members[k];
      const from = plan.rangeOffsets[k];
      if (index === FLAG) {
        const bytes = this.flagBytes;
        for (let i = 0; i < bytes.length; i++) bytes[i] = scratch[from + i];
        const flag = this.pack.raceFlag;
        if (flag !== null) this.flag = flag.decode(bytes);
      } else if (modes !== null && index === modes.probe) {
        const bytes = this.probeBytes;
        for (let i = 0; i < bytes.length; i++) bytes[i] = scratch[from + i];
        const name = modes.decode(bytes);
        this.modeIndex =
          name === null ? UNKNOWN_MODE : modes.names.indexOf(name);
      }
    }
  }

  /** Copies a fetched phase into the snapshot, noting what changed. */
  private scatter(phase: Phase, sharedOnly: boolean): void {
    const { plan, members } = phase;
    const scratch = this.scratch;
    for (let k = 0; k < members.length; k++) {
      const index = members[k];
      if (index === FLAG) continue;
      if (sharedOnly && this.pack.modeMasks[index] !== ALL_MODES) continue;
      const from = plan.rangeOffsets[k];
      const into = this.current[index];
      let same = this.seen[index] === 1;
      for (let i = 0; same && i < into.length; i++) {
        if (into[i] !== scratch[from + i]) same = false;
      }
      if (same) continue;
      this.prior[index].set(into);
      for (let i = 0; i < into.length; i++) into[i] = scratch[from + i];
      this.seen[index] = 1;
      this.changedIds.push(this.pack.ranges[index].id);
    }
  }
}
