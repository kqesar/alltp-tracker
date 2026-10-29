// Every piece Race Mode asks of a console, sent by the real Poller over an
// in-memory image: each way Race Mode can be on (forced on over an open ROM
// or a race ROM, "auto" over a race ROM, over a flag not read yet, a flag
// that says neither, a ROM the device cannot read), each mode the pack's
// probe can read and the switches between them, each assist's switch off and
// on, over the whole polling cycle, the game check first. A pack's spec holds
// what it returns to the byte-level guarantee: nothing outside the ranges the
// race profile permits.

import type { AutotrackPack } from "../src/pack";
import type { ByteRange } from "../src/plan";
import type { RaceSetting } from "../src/race-mode";
import { Poller } from "../src/scheduler";
import { MemoryTransport } from "./memory-transport";

/** One piece sent, and the mode the game was in throughout its tick. */
export interface RaceRead extends ByteRange {
  /** The mode, null while it cannot be told; undefined on a tick it changed. */
  readonly mode: string | null | undefined;
}

/** A byte value of the probe's first byte decoding to each mode (and null). */
function probeValues(pack: AutotrackPack): Map<string | null, number> {
  const out = new Map<string | null, number>();
  const modes = pack.modes;
  if (modes === null) return out;
  const bytes = new Uint8Array(pack.ranges[modes.probe].size);
  for (let value = 0; value < 0x100; value++) {
    bytes[0] = value;
    const mode = modes.decode(bytes);
    if (!out.has(mode)) out.set(mode, value);
  }
  return out;
}

/** Flag bytes reading "race", "open" and "unknown", where the decoder has them. */
function flagBytes(pack: AutotrackPack): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const flag = pack.raceFlag;
  if (flag === null) return out;
  for (const high of [0x00, 0x80, 0xff]) {
    for (let low = 0; low < 0x100; low++) {
      const bytes = new Uint8Array(flag.size);
      bytes[0] = low;
      if (flag.size > 1) bytes[flag.size - 1] = high;
      const reading = flag.decode(bytes);
      if (!out.has(reading)) out.set(reading, bytes);
    }
  }
  return out;
}

interface Scenario {
  readonly setting: RaceSetting;
  readonly flag: string | null;
  readonly romReadable: boolean;
}

/**
 * Drives a Poller in every state Race Mode is on in, and returns every piece
 * it sent. Throws if Race Mode was off on any tick it drove.
 */
export async function raceReads(pack: AutotrackPack): Promise<RaceRead[]> {
  const flags = flagBytes(pack);
  const scenarios: Scenario[] = [
    { flag: null, romReadable: true, setting: "on" },
    ...[...flags.keys()].map(
      (flag): Scenario => ({ flag, romReadable: true, setting: "on" }),
    ),
    ...["race", "unknown"]
      .filter((flag) => flags.has(flag))
      .map((flag): Scenario => ({ flag, romReadable: true, setting: "auto" })),
    ...(pack.raceFlag === null
      ? []
      : [{ flag: null, romReadable: false, setting: "auto" } as Scenario]),
  ];
  const switches: ReadonlySet<string>[] = [
    new Set(),
    new Set(pack.optIns),
    ...pack.optIns.map((name) => new Set([name])),
  ];
  const probes = probeValues(pack);
  const modes: (string | null)[] =
    probes.size === 0 ? [null] : [...probes.keys()];
  // Forwards, then backwards: every mode entered from another
  const order = [...modes, ...[...modes].reverse()];
  const memory = new Uint8Array(0x100_0000);
  const reads: RaceRead[] = [];
  for (const scenario of scenarios) {
    for (const optIn of switches) {
      memory.fill(0);
      const flag = pack.raceFlag;
      if (flag !== null && scenario.flag !== null) {
        memory.set(flags.get(scenario.flag) ?? [], flag.address);
      }
      const transport = new MemoryTransport(memory);
      const poller = new Poller(pack, transport, {
        now: () => 0,
        optIn,
        romReadable: scenario.romReadable,
        setting: scenario.setting,
      });
      const take = (mode: string | null | undefined) => {
        for (const [address, size] of transport.pieces) {
          reads.push({ address, mode, size });
        }
        transport.pieces.length = 0;
      };
      await poller.readGameCheck();
      take(undefined);
      for (const mode of order) {
        if (pack.modes !== null) {
          memory[pack.ranges[pack.modes.probe].address] = probes.get(mode) ?? 0;
        }
        for (let t = 0; t <= pack.cycle.length; t++) {
          const before = poller.mode;
          await poller.tick();
          if (!poller.race.active) {
            throw new Error(
              `Race Mode is off: ${scenario.setting}, flag ${scenario.flag}`,
            );
          }
          take(before === poller.mode && before === mode ? mode : undefined);
        }
      }
      poller.close();
    }
  }
  return reads;
}

/** The bytes of `reads` that no range of `allowed` covers, as addresses. */
export function outside(
  reads: readonly ByteRange[],
  allowed: readonly ByteRange[],
): number[] {
  const out = new Set<number>();
  const pieces = new Map(reads.map((r) => [`${r.address}+${r.size}`, r]));
  for (const { address, size } of pieces.values()) {
    for (let at = address; at < address + size; at++) {
      if (!allowed.some((r) => r.address <= at && at < r.address + r.size)) {
        out.add(at);
      }
    }
  }
  return [...out].sort((a, b) => a - b);
}
