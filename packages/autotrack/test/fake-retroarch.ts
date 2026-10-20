// A RetroArch answering its network commands as 1.22.2 with bsnes-mercury
// did on a real setup (2026-10-19; see src/retroarch.ts): the version, the
// status, and reads by A-bus address from an FX Pak Pro memory image, the
// address echoed unpadded, a read stopping short at a descriptor's end.
import { busToPak, type MemoryMapping } from "../src/address";
import type { RetroArchSend } from "../src/retroarch";

export interface FakeRetroArchOptions {
  /** The FX Pak Pro image the core's memory is read from. */
  readonly memory: Uint8Array;
  readonly mapping: MemoryMapping;
  /** Nothing listens: every command goes unanswered. */
  readonly silent?: boolean;
  /** GET_STATUS's state and content: "CONTENTLESS", "PLAYING super_nes,seed". */
  readonly status?: string;
  /** Snes9x publishes no memory map. */
  readonly core?: "bsnes-mercury" | "snes9x";
  /** Bus addresses where a descriptor ends: a read stops short there. */
  readonly ends?: readonly number[];
  /** Answers a command itself first, or leaves it to the fake (undefined). */
  readonly answer?: (command: string) => string | null | undefined;
}

export interface FakeRetroArch {
  readonly send: RetroArchSend;
  /** Every command sent, in order. */
  readonly commands: string[];
  /** The most commands that waited for their reply at once. */
  readonly maxInFlight: () => number;
}

const NO_MEMORY_MAP = "-1 no memory map defined";

export function fakeRetroArch(options: FakeRetroArchOptions): FakeRetroArch {
  const {
    core = "bsnes-mercury",
    ends = [0x80_0000],
    mapping,
    memory,
    status = "PLAYING super_nes,alttpr - seed",
  } = options;
  const commands: string[] = [];
  let inFlight = 0;
  let most = 0;

  const read = (address: number, size: number): string => {
    const echo = `READ_CORE_MEMORY ${address.toString(16)}`;
    if (core === "snes9x" || status === "CONTENTLESS")
      return `${echo} ${NO_MEMORY_MAP}\n`;
    if (busToPak(address, mapping) === undefined)
      return `${echo} -1 no data for descriptor\n`;
    const end = Math.min(address + size, ...ends.filter((at) => at > address));
    const bytes: string[] = [];
    for (let at = address; at < end; at++) {
      const pak = busToPak(at, mapping);
      const byte = pak === undefined ? 0 : (memory[pak] ?? 0);
      bytes.push(byte.toString(16).toUpperCase().padStart(2, "0"));
    }
    return `${echo} ${bytes.join(" ")}\n`;
  };

  const reply = (command: string): string | null => {
    const own = options.answer?.(command);
    if (own !== undefined) return own;
    if (options.silent) return null;
    const [verb, address, size] = command.split(" ");
    switch (verb) {
      case "VERSION":
        return "1.22.2\n";
      case "GET_STATUS":
        return status === "CONTENTLESS"
          ? "GET_STATUS CONTENTLESS"
          : `GET_STATUS ${status}\n`;
      case "READ_CORE_MEMORY":
        return read(Number.parseInt(address, 16), Number(size));
      default:
        return null;
    }
  };

  return {
    commands,
    maxInFlight: () => most,
    send: async (command) => {
      commands.push(command);
      inFlight++;
      most = Math.max(most, inFlight);
      // A datagram's round trip: the reply comes after the caller moves on
      await Promise.resolve();
      inFlight--;
      return reply(command);
    },
  };
}
