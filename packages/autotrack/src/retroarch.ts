// RetroArch read directly, through its network commands: no bridge between
// the tracker and the emulator. One ASCII command per UDP datagram on port
// 55355, one datagram back (command.c at v1.22.2). A page cannot send UDP, so
// the datagrams leave through an injected `send`: the desktop app passes its
// Rust command (apps/desktop/src-tauri/src/retroarch.rs), tests a fake.
//
// What a real RetroArch 1.22.2 with bsnes-mercury answered (2026-10-19):
// - `VERSION`: "1.22.2\n"; nothing listening: refused at once;
// - `GET_STATUS`: "GET_STATUS CONTENTLESS", or "GET_STATUS PLAYING
//   super_nes,<file name>" (PAUSED alike), a ",crc32=…" field at times;
// - `READ_CORE_MEMORY <bus> <n>`: the address echoed without padding ("ffc0"
//   for "00ffc0"), then the bytes in hex, fewer at a descriptor's end; or
//   "-1" and an error text. Without content the error is "no memory map
//   defined", as on a core with no memory map (Snes9x): GET_STATUS, read at
//   attach, tells the two apart.
// Addresses are the A-bus's: each piece's FX Pak Pro address goes through
// `pakToBus` under the pack's memory mapping, as SNI translates them for
// RetroArch. The planner keeps a ROM or SRAM piece inside one 8 KiB page,
// so a piece is one run of bus addresses.

import { hex, type MemoryMapping, pakToBus } from "./address";
import { TransportError, type TransportOperation } from "./errors";
import type { PlannedRequest, ReadLimits } from "./plan";
import type {
  BridgeInfo,
  DeviceDescriptor,
  DeviceInfo,
  Transport,
} from "./transport";

/** Where RetroArch listens for network commands by default. */
export const RETROARCH_URL = "udp://127.0.0.1:55355";

/**
 * Sends one command and resolves RetroArch's reply, or null when none came
 * within `timeoutMs` (nothing listening included). Rejects when the command
 * could not be sent at all.
 */
export type RetroArchSend = (
  command: string,
  timeoutMs: number,
) => Promise<string | null>;

/**
 * One piece per READ_CORE_MEMORY. RetroArch caps a read at its descriptor's
 * end only, and a reply must fit a datagram (about 21,800 bytes); 4096 is a
 * margin. A request's pieces go out together: commands are served once per
 * frame, and eight in flight were answered as fast as one.
 */
export const RETROARCH_LIMITS: ReadLimits = {
  maxPieceSize: 0x1000,
  maxPieces: 8,
  maxSingleSize: 0x1000,
};

export interface RetroArchTimeouts {
  /** VERSION on open: short, so another bridge is tried soon. */
  readonly open: number;
  readonly reply: number;
}

export interface RetroArchOptions {
  readonly send: RetroArchSend;
  /** The running game's mapping, the pack's: it turns pieces into bus addresses. */
  readonly mapping: MemoryMapping;
  readonly timeouts?: Partial<RetroArchTimeouts>;
}

const DEFAULT_TIMEOUTS: RetroArchTimeouts = { open: 500, reply: 2000 };

/** The one device RetroArch is. */
export const RETROARCH_DEVICE: DeviceDescriptor = {
  id: RETROARCH_URL,
  kind: "retroarch",
};

/** What GET_STATUS says. */
export interface RetroArchStatus {
  /** "PLAYING", "PAUSED" or "CONTENTLESS", as RetroArch words it. */
  readonly state: string;
  /** The core's system id, "super_nes" for every SNES core. */
  readonly system: string | null;
  /** The content's file name, without its extension. */
  readonly game: string | null;
}

/** GET_STATUS's reply, or null for one that is not. */
export function parseStatus(reply: string): RetroArchStatus | null {
  const match = /^GET_STATUS (\S+)(?: (.*))?$/s.exec(reply.trim());
  if (match === null) return null;
  const [, state, rest = ""] = match;
  const comma = rest.indexOf(",");
  if (comma < 0) return { game: null, state, system: rest || null };
  // A file name may hold commas: the game runs to the checksum, if any
  const crc = rest.lastIndexOf(",crc32=");
  const game = rest.slice(comma + 1, crc > comma ? crc : undefined);
  return { game: game || null, state, system: rest.slice(0, comma) };
}

export class RetroArchTransport implements Transport {
  readonly limits: ReadLimits = RETROARCH_LIMITS;
  private readonly send: RetroArchSend;
  private readonly mapping: MemoryMapping;
  private readonly timeouts: RetroArchTimeouts;
  private version: string | null = null;
  private opened = false;
  private closed = false;
  /** GET_STATUS said CONTENTLESS at attach: nothing to read. */
  private contentless = false;
  private closeListener: ((error: Error) => void) | null = null;

  constructor(options: RetroArchOptions) {
    this.send = options.send;
    this.mapping = options.mapping;
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts };
  }

  async open(): Promise<BridgeInfo> {
    const reply = await this.command("VERSION", "open", this.timeouts.open);
    this.version = reply.trim() || null;
    this.opened = true;
    return { kind: "retroarch", url: RETROARCH_URL, version: this.version };
  }

  async listDevices(): Promise<readonly DeviceDescriptor[]> {
    await this.status("device-list");
    return [RETROARCH_DEVICE];
  }

  async attach(device: DeviceDescriptor): Promise<DeviceInfo> {
    const status = await this.status("attach");
    this.contentless = status.state === "CONTENTLESS";
    return {
      device,
      flags: [],
      name: "RetroArch",
      rom: this.contentless ? null : status.game,
      romReadable: true,
      version: this.version,
    };
  }

  async read(
    request: PlannedRequest,
    into: Uint8Array,
    offset: number,
  ): Promise<void> {
    if (this.contentless) {
      // RetroArch would answer "no memory map defined", a core's failing
      throw new TransportError(
        "device",
        "read",
        "RetroArch runs no game: GET_STATUS said CONTENTLESS",
      );
    }
    const reads: Promise<void>[] = [];
    let at = offset;
    for (let i = 0; i < request.pieces.length; i += 2) {
      reads.push(
        this.readPiece(request.pieces[i], request.pieces[i + 1], into, at),
      );
      at += request.pieces[i + 1];
    }
    await Promise.all(reads);
  }

  onClose(listener: (error: Error) => void): void {
    this.closeListener = listener;
  }

  /** No connection to close: replies still on their way are dropped. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    const listener = this.closeListener;
    this.closeListener = null;
    if (this.opened && listener !== null)
      listener(new TransportError("closed", "read", "Closed by the tracker"));
  }

  private async status(
    operation: TransportOperation,
  ): Promise<RetroArchStatus> {
    const reply = await this.command("GET_STATUS", operation);
    const status = parseStatus(reply);
    if (status === null) {
      throw new TransportError(
        "protocol",
        operation,
        "RetroArch sent a malformed GET_STATUS reply",
      );
    }
    return status;
  }

  /** Reads one piece, and on past a descriptor's end if the reply stops short. */
  private async readPiece(
    pak: number,
    size: number,
    into: Uint8Array,
    at: number,
  ): Promise<void> {
    const start = pakToBus(pak, this.mapping);
    if (start === undefined) {
      throw new TransportError(
        "protocol",
        "read",
        `$${hex(pak, 6)} has no bus address under ${this.mapping}`,
      );
    }
    for (let got = 0; got < size; ) {
      const address = start + got;
      const reply = await this.command(
        `READ_CORE_MEMORY ${address.toString(16)} ${size - got}`,
        "read",
      );
      const count = this.fill(reply, address, size - got, into, at + got);
      got += count;
    }
  }

  /** Copies a READ_CORE_MEMORY reply's bytes; returns how many it held. */
  private fill(
    reply: string,
    address: number,
    wanted: number,
    into: Uint8Array,
    at: number,
  ): number {
    const words = reply.trim().split(" ");
    const malformed = (why: string) =>
      new TransportError("protocol", "read", `RetroArch's reply ${why}`);
    if (words[0] !== "READ_CORE_MEMORY" || words.length < 3) {
      throw malformed("is not a read's");
    }
    if (Number.parseInt(words[1], 16) !== address) {
      throw malformed(`answers $${words[1]}, not $${hex(address, 6)}`);
    }
    if (words[2] === "-1") {
      const reason = words.slice(3).join(" ");
      throw new TransportError(
        "device",
        "read",
        `RetroArch could not read $${hex(address, 6)}${reason ? `: ${reason}` : ""}`,
        { reason },
      );
    }
    const count = words.length - 2;
    if (count > wanted) throw malformed("holds more bytes than asked");
    for (let i = 0; i < count; i++) {
      const word = words[i + 2];
      const byte = Number.parseInt(word, 16);
      if (word.length !== 2 || Number.isNaN(byte)) {
        throw malformed(`holds "${word}", not a byte`);
      }
      into[at + i] = byte;
    }
    return count;
  }

  /** Sends a command; its reply, or a TransportError for none. */
  private async command(
    command: string,
    operation: TransportOperation,
    timeout = this.timeouts.reply,
  ): Promise<string> {
    if (this.closed) {
      throw new TransportError("closed", operation, "The transport is closed");
    }
    let reply: string | null;
    try {
      reply = await this.send(command, timeout);
    } catch (error) {
      throw new TransportError(
        operation === "open" ? "unreachable" : "closed",
        operation,
        `RetroArch's command could not be sent: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (this.closed) {
      throw new TransportError("closed", operation, "The transport is closed");
    }
    if (reply !== null) return reply;
    throw operation === "open"
      ? new TransportError(
          "unreachable",
          "open",
          `RetroArch did not answer at ${RETROARCH_URL}`,
        )
      : new TransportError(
          "timeout",
          operation,
          `RetroArch did not answer ${operation} in ${timeout} ms`,
        );
  }
}
