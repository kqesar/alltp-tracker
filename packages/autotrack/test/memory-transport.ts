// An in-memory Transport: serves reads from an FX Pak Pro image, records
// every piece, and fails on command. For scheduler and session tests that
// need no socket (and so can run under fake timers).
import { TransportError } from "../src/errors";
import { type PlannedRequest, USB2SNES_LIMITS } from "../src/plan";
import type {
  BridgeInfo,
  DeviceDescriptor,
  DeviceInfo,
  Transport,
} from "../src/transport";

export const SNI: BridgeInfo = {
  kind: "sni",
  url: "ws://localhost:23074",
  version: "0.0.103",
};

export const RETROARCH: DeviceDescriptor = {
  id: "ra://127.0.0.1:55355",
  kind: "retroarch",
};

export function infoFor(
  device: DeviceDescriptor,
  overrides: Partial<DeviceInfo> = {},
): DeviceInfo {
  return {
    device,
    flags: [],
    name: "retroarch",
    rom: "alttpr - seed",
    romReadable: true,
    version: "1.22.2",
    ...overrides,
  };
}

/** What the next call of each kind does; the default succeeds. */
export interface Script {
  open?: () => Promise<BridgeInfo>;
  listDevices?: () => Promise<readonly DeviceDescriptor[]>;
  attach?: (device: DeviceDescriptor) => Promise<DeviceInfo>;
  /** Return an error to fail the read with it. */
  read?: (pieces: readonly [number, number][]) => TransportError | undefined;
}

export class MemoryTransport implements Transport {
  readonly limits = USB2SNES_LIMITS;
  readonly pieces: [number, number][] = [];
  closed = false;
  private listener: ((error: Error) => void) | null = null;
  private rejectOpen: (error: Error) => void = () => {};

  constructor(
    readonly memory: Uint8Array,
    readonly script: Script = {},
  ) {}

  /** Like a real transport, close() rejects an open still pending. */
  open(): Promise<BridgeInfo> {
    const opening = this.script.open?.() ?? Promise.resolve(SNI);
    return Promise.race([
      opening,
      new Promise<never>((_, reject) => {
        this.rejectOpen = reject;
      }),
    ]);
  }

  listDevices(): Promise<readonly DeviceDescriptor[]> {
    return this.script.listDevices?.() ?? Promise.resolve([RETROARCH]);
  }

  attach(device: DeviceDescriptor): Promise<DeviceInfo> {
    return this.script.attach?.(device) ?? Promise.resolve(infoFor(device));
  }

  async read(
    request: PlannedRequest,
    into: Uint8Array,
    offset: number,
  ): Promise<void> {
    if (this.closed) throw new TransportError("closed", "read", "closed");
    const pieces: [number, number][] = [];
    for (let i = 0; i < request.pieces.length; i += 2)
      pieces.push([request.pieces[i], request.pieces[i + 1]]);
    this.pieces.push(...pieces);
    const error = this.script.read?.(pieces);
    if (error !== undefined) throw error;
    let at = offset;
    for (const [address, size] of pieces) {
      into.set(this.memory.subarray(address, address + size), at);
      at += size;
    }
  }

  onClose(listener: (error: Error) => void): void {
    this.listener = listener;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.rejectOpen(new TransportError("closed", "open", "closed"));
    this.listener?.(new TransportError("closed", "read", "closed"));
  }
}
