// The seam between the session and a bridge. The usb2snes WebSocket client
// implements it today; the Tauri desktop app can add a direct RetroArch UDP
// transport (READ_CORE_MEMORY on port 55355) behind the same interface.

import type { PlannedRequest, ReadLimits } from "./plan";

/** Which program the tracker is talking to. */
export type BridgeKind = "sni" | "qusb2snes" | "unknown";

export interface BridgeInfo {
  readonly kind: BridgeKind;
  /** Version string as the bridge reports it, e.g. "0.0.103". */
  readonly version: string | null;
  /** Where it was reached, e.g. "ws://localhost:23074". */
  readonly url: string;
}

/**
 * What runs the game. SNI names devices by URI scheme (`ra://`,
 * `fxpakpro://`, `luabridge://`, `emunwa://`); QUsb2Snes by prefix
 * ("SD2SNES COM3", "RetroArch Localhost", "Emu - BizHawk", "SNES Classic").
 */
export type DeviceKind =
  | "retroarch"
  | "fxpakpro"
  | "luabridge"
  | "emunwa"
  | "snes-classic"
  | "unknown";

export interface DeviceDescriptor {
  /** The name `Attach` takes, verbatim. */
  readonly id: string;
  readonly kind: DeviceKind;
}

export interface DeviceInfo {
  readonly device: DeviceDescriptor;
  /** Firmware, emulator or RetroArch version, if reported. */
  readonly version: string | null;
  /** What the bridge calls the device type, e.g. "retroarch", "SD2SNES". */
  readonly name: string | null;
  /** The running ROM's file name, or null when nothing is loaded. */
  readonly rom: string | null;
  /** usb2snes feature flags, e.g. "NO_ROM_READ" (QUsb2Snes). */
  readonly flags: readonly string[];
  /** Whether ROM reads work; false when the bridge says NO_ROM_READ. */
  readonly romReadable: boolean;
}

export interface Transport {
  /** How reads must be cut for this bridge. */
  readonly limits: ReadLimits;
  /** Connects to the bridge. Rejects with a TransportError("unreachable"). */
  open(): Promise<BridgeInfo>;
  listDevices(): Promise<readonly DeviceDescriptor[]>;
  attach(device: DeviceDescriptor): Promise<DeviceInfo>;
  /**
   * Reads every piece of `request`, in order, into
   * `into[offset .. offset + request.size)`.
   */
  read(
    request: PlannedRequest,
    into: Uint8Array,
    offset: number,
  ): Promise<void>;
  /** Called once when the connection drops for any reason after open(). */
  onClose(listener: (error: Error) => void): void;
  /** Closes the connection and rejects whatever is pending. Idempotent. */
  close(): void;
}
