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
// When Race Mode comes on mid-session (the player's switch, or a race flag the
// ROM reads late), the bytes of the ranges it forbids are forgotten: a reading
// then reports them unread, rather than holding a stretch of memory the race
// no longer lets the tracker see. A casual fetch that was in flight when it
// came on is dropped, never laid into the snapshot.
//
// A range may be gated (`when`): read only while it is wanted, after the tick's
// other reads and never in a plan, the gated ranges together as one request or,
// for a big span (`alone`), as a request of its own (see `RangeSpec`). It is a
// casual read: the tick that Race Mode holds never reaches it, and a tick that
// would not have read the race flag reads it first for the purpose. A range may
// also wait for a host switch (`optIn`, `setOptIn`). A read of a gated range
// the device refuses is not the tick's failure: the range is skipped from then
// on, on this device, and said in `unreadable`. One that fails with a dropped
// connection or a timeout fails the tick, once; a second time, on another
// connection, it is skipped too.
//
// A host may also ask for bytes whose addresses only the game can tell
// (`request`: a ROM table points at them), with the category they are tracked
// for. Such a read is casual by construction: its category must be one the
// race profile forbids, it is served after the tick's gated reads, never while
// Race Mode is on (a tick that would not have read the race flag reads it
// first), and one that Race Mode overtakes is refused, never handed over.
//
// Plans follow the last mode the probe reported. When the probe reports
// another one, the tick keeps only the ranges every mode shares, skips the
// casual phase, and the next tick reads the new layout: a portal crossing in
// SMZ3 costs one tick, not a round trip on every tick.
//
// A portal can also fall inside a tick, after the probe was read and before
// the ranges bound to its mode were: those would hold the other game's
// memory. So a tick that read a mode-bound range reads the probe once more
// at its end, in a request of its own, and takes the tick for a switch (the
// ranges it read count as unread) if the mode is no longer the planned one.

import { hex, pakRegion } from "./address";
import { DefinitionError, RaceViolationError, TransportError } from "./errors";
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

/**
 * Bytes asked for at run time (`Poller.request`), at addresses the game
 * itself tells (a ROM table, a pointer in WRAM), never planned ahead.
 */
export interface OnDemandRead {
  /**
   * What the bytes are tracked for: a category the race profile forbids, so
   * Race Mode never serves it.
   */
  readonly category: string;
  /** FX Pak Pro ranges, each inside one memory region. */
  readonly ranges: readonly ByteRange[];
  /**
   * Drops the read while it waits for its tick (the host no longer wants it):
   * it is rejected with an `AbortError` and never sent.
   */
  readonly signal?: DropSignal;
}

/** What `OnDemandRead.signal` needs of an `AbortSignal`. */
export interface DropSignal {
  readonly aborted: boolean;
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: { readonly once?: boolean },
  ): void;
}

/** The most bytes one on-demand read may ask for. */
export const ON_DEMAND_MAX = 0x1_0000;

interface Pending {
  readonly plan: ReadPlan;
  readonly ranges: readonly ByteRange[];
  readonly resolve: (bytes: Uint8Array[]) => void;
  readonly reject: (error: Error) => void;
  readonly signal: DropSignal | undefined;
}

const FLAG = 0xffff_ffff;
const UNKNOWN_MODE = -1;

interface Phase {
  readonly plan: ReadPlan;
  /** Range index of each planned input range, or FLAG. */
  readonly members: Uint32Array;
  /** Whether a range bound to some modes only is among them. */
  readonly modeBound: boolean;
}

/** The plan key leaves this many bits for the switches' mask. */
const OPT_BITS = 8;

interface DuePlans {
  readonly race: Phase;
  readonly casual: Phase;
  /** The race flag and the probe alone: read before a gated read on a tick with no race phase. */
  readonly lone: Phase;
}

const NO_PHASE: Phase = {
  members: new Uint32Array(0),
  modeBound: false,
  plan: EMPTY_PLAN,
};

/** The mode probe's range alone, planned for Race Mode's guard like any permitted read. */
function phaseOfProbe(
  pack: AutotrackPack,
  probe: number,
  limits: Transport["limits"],
): Phase {
  const plan = planReads([pack.ranges[probe]], {
    barriers: pack.raceBarriers[0],
    gap: pack.gap,
    limits,
  });
  assertRaceSafe(plan, pack.profile, pack.raceBytes[0]);
  return { members: Uint32Array.of(probe), modeBound: false, plan };
}

/** What a read the host dropped rejects with. */
const dropped = () => {
  const error = new Error("the read was dropped");
  error.name = "AbortError";
  return error;
};

const raceRefusal = () =>
  new RaceViolationError("Race Mode: on-demand reads are refused");

export class Poller implements MemorySnapshot {
  /**
   * Ranges this device cannot serve: ROM ranges when ROM is unreadable, then
   * the gated ranges whose read failed here, which are skipped from then on.
   */
  get unreadable(): readonly string[] {
    return this.skipped.size === 0
      ? this.notServed
      : [...this.notServed, ...this.skipped];
  }
  private readonly notServed: readonly string[];
  /** The ids of gated ranges whose read failed on this device. */
  private readonly skipped: Set<string>;
  private readonly onSkip: ((id: string, reason: string) => void) | undefined;
  private readonly struck: ReadonlySet<string>;
  private readonly onStrike: ((id: string) => void) | undefined;
  private readonly current: Uint8Array[] = [];
  private readonly prior: Uint8Array[] = [];
  private readonly seen: Uint8Array;
  private readonly flagBytes: Uint8Array;
  private readonly probeBytes: Uint8Array;
  private readonly plans = new Map<number, DuePlans>();
  private readonly checkPlan: Phase;
  /** The probe alone, read again at the end of a tick that read mode-bound ranges. */
  private readonly probePhase: Phase;
  private readonly probeScratch: Uint8Array;
  private readonly build: (set: number, mode: number) => DuePlans;
  private readonly now: () => number;
  private scratch: Uint8Array;
  private readonly changedIds: string[] = [];
  /** Ranges forgotten between ticks (a switch turned off): reported by the next. */
  private readonly pendingForgotten: string[] = [];
  private readonly update: {
    at: number;
    changed: string[];
    modeChanged: boolean;
    snapshot: MemorySnapshot;
    tick: number;
  };
  private setting: RaceSetting;
  /** Bit per `pack.optIns` entry: the switches that are on. */
  private optMask = 0;
  /** Whether each gated range's gate held when it was last looked at. */
  private readonly gateWasOpen: boolean[];
  /** The plan of each `alone` range, by range index. */
  private readonly alonePlans = new Map<number, Phase>();
  /** The plan of the gated ranges that are not alone, read together. */
  private groupPhase: Phase = NO_PHASE;
  /**
   * The group's plan for the members whose gates hold (and switches are on),
   * by their indices: a range of a switch that is off, or whose gate is shut,
   * is never asked for beside the others.
   */
  private readonly groupPlans = new Map<string, Phase>();
  private flag: RaceFlagState;
  private modeIndex = UNKNOWN_MODE;
  private ticks = 0;
  /** Whether Race Mode was on at the end of the last tick. */
  private racing = false;
  /** Whether the last tick was due for a range that is no assist's. */
  private baseTick = false;
  /** On-demand reads waiting for a tick's casual phase. */
  private pending: Pending[] = [];
  /** Whether the race flag was read on the tick under way. */
  private flagFresh = false;
  private readonly romReadable: boolean;

  constructor(
    private readonly pack: AutotrackPack,
    private readonly transport: Transport,
    options: {
      readonly romReadable: boolean;
      readonly setting: RaceSetting;
      readonly now: () => number;
      /** The opt-in switches that are on from the start. */
      readonly optIn?: ReadonlySet<string>;
      /** Gated ranges a read of which failed before, on this device: not read. */
      readonly skipped?: ReadonlySet<string>;
      /** Called when the read of a gated range fails: it is skipped from now on. */
      readonly onSkip?: (id: string, reason: string) => void;
      /**
       * Gated ranges whose read failed once already, on an earlier
       * connection to this device, for a reason that may not be theirs: a
       * second such failure skips them.
       */
      readonly struck?: ReadonlySet<string>;
      /** Called when a gated range's read fails for such a reason the first time. */
      readonly onStrike?: (id: string) => void;
    },
  ) {
    this.romReadable = options.romReadable;
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
    this.notServed = pack.ranges.filter((r) => !romOk(r)).map((r) => r.id);
    this.skipped = new Set(options.skipped);
    this.onSkip = options.onSkip;
    this.struck = options.struck ?? new Set();
    this.onStrike = options.onStrike;
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
      /** Plan the race flag and the probe though no range is due. */
      force = false,
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
      let reads = force ? 1 : 0;
      for (const index of indices) {
        if (pack.isGated[index] || !this.switchedOn(index)) continue;
        reads++;
        if (index === probe || !readable[index] || !inMode(index)) continue;
        if (pack.racePermitted[index] === race) add(index);
      }
      // The flag and the probe ride with every tick that reads anything.
      if (race && reads > 0) {
        if (probe >= 0 && readable[probe]) add(probe);
        if (flag !== null && flagReadable) {
          members.push(FLAG);
          ranges.push(flag);
        }
      }
      if (ranges.length === 0) return NO_PHASE;
      const plan = planReads(ranges, {
        barriers: race ? pack.raceBarriers[mode + 1] : [],
        gap: pack.gap,
        limits: transport.limits,
      });
      if (race) assertRaceSafe(plan, pack.profile, pack.raceBytes[mode + 1]);
      return {
        members: Uint32Array.from(members),
        modeBound: members.some(
          (index) => index !== FLAG && pack.modeMasks[index] !== ALL_MODES,
        ),
        plan,
      };
    };
    this.build = (set, mode) => ({
      casual: phase(pack.dueSets[set], false, mode),
      lone: phase([], true, mode, true),
      race: phase(pack.dueSets[set], true, mode),
    });
    this.gateWasOpen = pack.gated.map(() => false);
    const group: ByteRange[] = [];
    const groupMembers: number[] = [];
    for (const { alone, index } of pack.gated) {
      if (!readable[index]) continue;
      if (!alone) {
        group.push(pack.ranges[index]);
        groupMembers.push(index);
        continue;
      }
      const plan = planReads([pack.ranges[index]], {
        gap: pack.gap,
        limits: transport.limits,
      });
      this.alonePlans.set(index, {
        members: Uint32Array.of(index),
        modeBound: false,
        plan,
      });
    }
    if (group.length > 0) {
      this.groupPhase = {
        members: Uint32Array.from(groupMembers),
        modeBound: false,
        plan: planReads(group, { gap: pack.gap, limits: transport.limits }),
      };
    }
    this.checkPlan =
      pack.gameCheck === undefined
        ? NO_PHASE
        : phase(pack.gameCheck.ranges, true, UNKNOWN_MODE);
    this.scratch = new Uint8Array(this.checkPlan.plan.size);
    this.probePhase =
      probe >= 0 && readable[probe]
        ? phaseOfProbe(pack, probe, transport.limits)
        : NO_PHASE;
    this.probeScratch = new Uint8Array(this.probePhase.plan.size);
    for (const name of options.optIn ?? []) this.setOptIn(name, true);
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

  /**
   * Whether the last tick read a range of the pack's own (no assist's: not
   * behind a switch, not alone). A poll that found memory unchanged says the
   * game stands still only if it read what the game's clock is read from, which
   * the pack's own ranges are on the cadences it was laid out for; a tick the
   * assists alone made due (the dark room's position, between two of those)
   * says nothing.
   */
  get readBase(): boolean {
    return this.baseTick;
  }

  /**
   * Turns an opt-in switch (`RangeSpec.optIn`) on or off. From the next tick
   * its ranges are read or not; off, they forget their bytes at once (`has`
   * turns false), which the next update reports. A name no range uses does
   * nothing.
   */
  setOptIn(name: string, on: boolean): void {
    const slot = this.pack.optIns.indexOf(name);
    if (slot < 0) return;
    const bit = 1 << slot;
    if (on === ((this.optMask & bit) !== 0)) return;
    this.optMask = on ? this.optMask | bit : this.optMask & ~bit;
    if (on) return;
    // Its gates count as shut: on again, even before a tick, they open anew
    // and an alone range is read at once rather than at its cadence
    this.pack.gated.forEach(({ index }, k) => {
      if (this.pack.optInOf[index] === slot) this.gateWasOpen[k] = false;
    });
    this.pack.optInOf.forEach((of, index) => {
      if (of !== slot || this.seen[index] === 0) return;
      this.seen[index] = 0;
      this.pendingForgotten.push(this.pack.ranges[index].id);
    });
  }

  /** Whether a range's switch, if it has one, is on. */
  private switchedOn(index: number): boolean {
    const slot = this.pack.optInOf[index];
    return slot < 0 || (this.optMask & (1 << slot)) !== 0;
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
    const key = (set * 33 + planned + 1) * (1 << OPT_BITS) + this.optMask;
    let plans = this.plans.get(key);
    if (plans === undefined) {
      plans = this.build(set, planned);
      this.plans.set(key, plans);
    }
    this.baseTick = pack.dueSets[set].some(
      (index) => pack.optInOf[index] < 0 && !pack.isGated[index],
    );
    this.changedIds.length = 0;
    for (const id of this.pendingForgotten) this.changedIds.push(id);
    this.pendingForgotten.length = 0;
    await this.fetch(plans.race);
    this.readControls(plans.race);
    this.flagFresh = plans.race.plan.size > 0;
    let switched = this.modeIndex !== planned;
    this.scatter(plans.race, switched);
    // Decided after the race phase, on the flag it just read; a new mode
    // means this tick's casual plan was for the old layout.
    if (!switched) {
      const casual = this.raceActive() ? NO_PHASE : plans.casual;
      await this.fetch(casual);
      // A portal since the probe was read: what the mode-bound ranges held
      // is the other game's
      if (
        (plans.race.modeBound || casual.modeBound) &&
        !(await this.stillIn(planned))
      ) {
        switched = true;
      } else if (!this.raceActive()) {
        // Race Mode may have come on while the casual ranges were in flight:
        // what they brought is not laid
        this.scatter(casual, false);
        await this.readGated(set, plans);
        await this.serveRequests(plans);
      }
    }
    if (this.raceActive()) this.refuseRequests();
    // A new mode: every mode-bound range holds another stint's bytes, unread
    // until read again in this one
    if (switched) this.forgetModeBound();
    this.forgetForbidden();
    this.ticks++;
    if (this.changedIds.length === 0 && !switched) return null;
    this.update.tick = this.ticks;
    this.update.at = this.now();
    this.update.modeChanged = switched;
    return this.update;
  }

  /**
   * Reads the gated ranges that are wanted. A range whose gate holds is read
   * when its cadence is due, when the gate has just opened and, for an alone
   * range, when a range it refreshes on changed this tick; the gated ranges
   * that are not alone go in one request, the alone ones one each. One whose
   * gate stopped holding forgets its bytes, unless `keep` holds them. A tick
   * that has no race phase reads the race flag first, so that a race ROM
   * loaded since is caught before any of these reads.
   */
  private async readGated(set: number, plans: DuePlans): Promise<void> {
    const { gated, ranges, dueSets } = this.pack;
    if (gated.length === 0) return;
    const readable = (index: number) =>
      this.alonePlans.has(index) || this.groupPhase.members.includes(index);
    // 0 forget, 1 hold, 2 read
    const states = gated.map(({ index }) => {
      const range = ranges[index];
      if (
        !this.switchedOn(index) ||
        this.skipped.has(range.id) ||
        !readable(index)
      ) {
        return 0;
      }
      if (range.when?.(this) === true) return 2;
      return range.keep?.(this) === true ? 1 : 0;
    });
    gated.forEach(({ index }, k) => {
      if (states[k] !== 0) return;
      this.gateWasOpen[k] = false;
      if (this.seen[index] === 1) {
        this.seen[index] = 0;
        this.changedIds.push(ranges[index].id);
      }
    });
    const due = (index: number) => dueSets[set].includes(index);
    const wasOpen = gated.map((_, k) => this.gateWasOpen[k]);
    gated.forEach((_, k) => {
      if (states[k] === 2) this.gateWasOpen[k] = true;
    });
    const group = gated.some(
      ({ alone, index }, k) =>
        !alone && states[k] === 2 && (!wasOpen[k] || due(index)),
    );
    // The alone ranges are asked after the group, which may have changed the
    // range they refresh on
    const aloneWanted = (k: number) =>
      gated[k].alone &&
      states[k] === 2 &&
      (!wasOpen[k] ||
        due(gated[k].index) ||
        gated[k].refreshOn.some((other) =>
          this.changedIds.includes(ranges[other].id),
        ));
    // An alone range's refresh needs the group to have changed: no group,
    // nothing to refresh on, so only an open or a cadence asks for it here
    const anyAlone = gated.some(
      ({ alone, index }, k) =>
        alone && states[k] === 2 && (!wasOpen[k] || due(index)),
    );
    if (!group && !anyAlone) return;
    if (!(await this.freshFlag(plans))) return;
    if (group) {
      const open = new Set(
        gated.filter((_, k) => states[k] === 2).map(({ index }) => index),
      );
      const phase = this.groupOf(open);
      if (await this.fetchGated(phase)) {
        // Race Mode may have come on while it was in flight
        if (this.raceActive()) return;
        this.scatter(phase, false, open);
      }
    }
    for (let k = 0; k < gated.length; k++) {
      if (!aloneWanted(k)) continue;
      const phase = this.alonePlans.get(gated[k].index);
      if (phase === undefined || !(await this.fetchGated(phase))) continue;
      if (this.raceActive()) return;
      this.scatter(phase, false);
    }
  }

  /** The group's plan over its members in `open`, built once per set. */
  private groupOf(open: ReadonlySet<number>): Phase {
    const members = Array.from(this.groupPhase.members).filter((index) =>
      open.has(index),
    );
    const key = members.join(",");
    let phase = this.groupPlans.get(key);
    if (phase === undefined) {
      phase = {
        members: Uint32Array.from(members),
        modeBound: false,
        plan: planReads(
          members.map((index) => this.pack.ranges[index]),
          { gap: this.pack.gap, limits: this.transport.limits },
        ),
      };
      this.groupPlans.set(key, phase);
    }
    return phase;
  }

  /**
   * Reads the race flag on a tick that has not yet (the flag and the probe
   * alone), before a casual read the tick would not otherwise make.
   * @returns Whether Race Mode is still off
   */
  private async freshFlag(plans: DuePlans): Promise<boolean> {
    if (!this.flagFresh && plans.lone.plan.size > 0) {
      await this.fetch(plans.lone);
      this.readControls(plans.lone);
      this.scatter(plans.lone, false);
      this.flagFresh = true;
    }
    return !this.raceActive();
  }

  /**
   * Asks for bytes at addresses known only at run time: read on a coming tick,
   * after its gated reads, in requests of their own. Resolves with each
   * range's bytes, in order. Rejects with a DefinitionError for a category the
   * profile does not know or permits, an empty range, one across two memory
   * regions or a read over `ON_DEMAND_MAX`; with a RaceViolationError while
   * Race Mode is on, or when it comes on before the bytes are handed over;
   * with a TransportError for ROM the device cannot read, a read that failed
   * (nothing is skipped: the next ask tries again), or a poller closed.
   */
  request(read: OnDemandRead): Promise<Uint8Array[]> {
    const { profile } = this.pack;
    const category = profile.categories[read.category];
    if (category === undefined) {
      return Promise.reject(
        new DefinitionError(
          `on-demand read: unknown category "${read.category}" in ${profile.id}`,
        ),
      );
    }
    if (category.permitted) {
      return Promise.reject(
        new DefinitionError(
          `on-demand read: category "${read.category}" is race-permitted; on-demand reads are for forbidden ones`,
        ),
      );
    }
    let total = 0;
    for (const { address, size } of read.ranges) {
      const region = pakRegion(address);
      if (
        !Number.isInteger(size) ||
        size < 1 ||
        region === undefined ||
        address + size - 1 > region.end
      ) {
        return Promise.reject(
          new DefinitionError(
            `on-demand read: $${hex(address, 6)}+${size} is not inside one FX Pak Pro memory region`,
          ),
        );
      }
      if (!this.romReadable && address < 0xe0_0000) {
        return Promise.reject(
          new TransportError("device", "read", "this device cannot read ROM"),
        );
      }
      total += size;
    }
    if (total > ON_DEMAND_MAX) {
      return Promise.reject(
        new DefinitionError(`on-demand read: ${total} bytes asked for at once`),
      );
    }
    if (this.raceActive()) return Promise.reject(raceRefusal());
    const { signal } = read;
    if (signal?.aborted === true) return Promise.reject(dropped());
    const plan = planReads(read.ranges, {
      gap: this.pack.gap,
      limits: this.transport.limits,
    });
    return new Promise((resolve, reject) => {
      const entry: Pending = {
        plan,
        ranges: read.ranges,
        reject,
        resolve,
        signal,
      };
      this.pending.push(entry);
      signal?.addEventListener(
        "abort",
        () => {
          const at = this.pending.indexOf(entry);
          if (at < 0) return;
          this.pending.splice(at, 1);
          reject(dropped());
        },
        { once: true },
      );
    });
  }

  /** Refuses every on-demand read still waiting: the poller is done. */
  close(): void {
    const pending = this.pending;
    this.pending = [];
    for (const { reject } of pending) {
      reject(new TransportError("closed", "read", "the session ended"));
    }
  }

  /** Serves the on-demand reads waiting, once the race flag says they may. */
  private async serveRequests(plans: DuePlans): Promise<void> {
    if (this.pending.length === 0) return;
    if (!(await this.freshFlag(plans))) return;
    const batch = this.pending;
    this.pending = [];
    for (const { plan, ranges, reject, resolve, signal } of batch) {
      if (signal?.aborted === true) {
        reject(dropped());
        continue;
      }
      const into = new Uint8Array(plan.size);
      try {
        for (const request of plan.requests) {
          await this.transport.read(request, into, request.offset);
        }
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new TransportError("protocol", "read", String(error)),
        );
        continue;
      }
      // Race Mode may have come on while it was in flight
      if (this.raceActive()) {
        reject(raceRefusal());
        continue;
      }
      resolve(
        ranges.map(({ size }, k) =>
          into.slice(plan.rangeOffsets[k], plan.rangeOffsets[k] + size),
        ),
      );
    }
  }

  /** Race Mode is on: what waits is refused, never read. */
  private refuseRequests(): void {
    if (this.pending.length === 0) return;
    const pending = this.pending;
    this.pending = [];
    for (const { reject } of pending) reject(raceRefusal());
  }

  /**
   * A gated range's read: one the device refuses (a `device` or `protocol`
   * error), or that failed before on another connection (`struck`), is
   * skipped from then on (reported to `onSkip`) and the tick goes on. Any
   * other failure is reported to `onStrike` and fails the tick, as the game's
   * own reads do: it may be no fault of the range's.
   * @returns Whether the bytes came
   */
  private async fetchGated(phase: Phase): Promise<boolean> {
    try {
      await this.fetch(phase);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const ids: string[] = [];
      for (let k = 0; k < phase.members.length; k++) {
        if (phase.members[k] !== FLAG) {
          ids.push(this.pack.ranges[phase.members[k]].id);
        }
      }
      // The device said no: these bytes it cannot serve. A dropped socket or
      // a timeout says nothing of them (the emulator closed, the bridge
      // restarted, a refusal over usb2snes): the tick fails, the session
      // connects again, and only a second such failure, on another
      // connection, skips them
      const refused =
        error instanceof TransportError &&
        (error.code === "device" || error.code === "protocol");
      if (!refused && !ids.some((id) => this.struck.has(id))) {
        for (const id of ids) this.onStrike?.(id);
        throw error;
      }
      for (let k = 0; k < phase.members.length; k++) {
        const index = phase.members[k];
        if (index === FLAG) continue;
        const id = this.pack.ranges[index].id;
        this.skipped.add(id);
        if (this.seen[index] === 1) {
          this.seen[index] = 0;
          this.changedIds.push(id);
        }
        this.onSkip?.(id, reason);
      }
      return false;
    }
  }

  /**
   * As Race Mode comes on, forgets what the ranges it forbids held, and
   * reports them changed so a reading decodes them as unread.
   */
  private forgetForbidden(): void {
    const racing = this.raceActive();
    if (racing && !this.racing) {
      this.gateWasOpen.fill(false);
      this.pack.racePermitted.forEach((permitted, index) => {
        if (permitted || this.seen[index] === 0) return;
        this.seen[index] = 0;
        this.changedIds.push(this.pack.ranges[index].id);
      });
    }
    this.racing = racing;
  }

  private forgetModeBound(): void {
    this.pack.modeMasks.forEach((mask, index) => {
      if (mask !== ALL_MODES) this.seen[index] = 0;
    });
  }

  /**
   * Reads the probe again and tells whether the mode is still `planned`; if
   * not, takes the new one, which the next tick plans for.
   */
  private async stillIn(planned: number): Promise<boolean> {
    const modes = this.pack.modes;
    const { plan } = this.probePhase;
    if (modes === null || plan.size === 0) return true;
    for (const request of plan.requests) {
      await this.transport.read(request, this.probeScratch, request.offset);
    }
    const name = modes.decode(this.probeScratch);
    const index = name === null ? UNKNOWN_MODE : modes.names.indexOf(name);
    if (index === planned) return true;
    this.modeIndex = index;
    return false;
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

  /**
   * Copies a fetched phase into the snapshot, noting what changed. A range
   * whose switch went off while the phase was in flight is not laid back, and
   * with `only`, neither is one that is not in it.
   */
  private scatter(
    phase: Phase,
    sharedOnly: boolean,
    only?: ReadonlySet<number>,
  ): void {
    const { plan, members } = phase;
    const scratch = this.scratch;
    for (let k = 0; k < members.length; k++) {
      const index = members[k];
      if (index === FLAG) continue;
      if (sharedOnly && this.pack.modeMasks[index] !== ALL_MODES) continue;
      if (!this.switchedOn(index) || (only && !only.has(index))) continue;
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
