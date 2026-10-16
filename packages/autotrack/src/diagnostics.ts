// The session's user-facing states. Each carries a machine `code` and the
// data the UI needs to say exactly what to do. README "Diagnostic codes"
// lists them with their sources.

import type { BrowserFamily } from "./environment";
import type { TransportError } from "./errors";
import type { PermissionState } from "./permission";
import type { RaceStatus } from "./race-mode";
import type { BridgeInfo, DeviceDescriptor, DeviceInfo } from "./transport";

/** Why memory could not be read on an attached device. */
export type UnreadableCause =
  /** RetroArch: the core declares no memory map (Snes9x, bsnes, bsnes-hd). */
  | "no-memory-map"
  /** Nothing is running: RetroArch without content, the FX Pak Pro menu. */
  | "no-content"
  /** RetroArch: the core maps memory, but not the address asked for. */
  | "address-unmapped"
  /** The device cannot read ROM, and the game check needs it. */
  | "rom-unreadable"
  /** Every byte read was zero: how SNI reports failed RetroArch reads. */
  | "zero-filled"
  /** The bridge dropped the connection on a read; the reason is unknown. */
  | "read-failed";

/** What the user should do about it. */
export type Remedy =
  | { readonly action: "switch-core"; readonly core: "bsnes-mercury" }
  | { readonly action: "load-game" }
  | { readonly action: "use-sni" }
  | { readonly action: "check-bridge-log" };

/**
 * How the cause was established: a device's own error text ("reply"), or a
 * pattern of behaviour that leaves no other explanation the sources know of
 * ("inferred").
 */
export type Evidence = "reply" | "inferred";

/**
 * `retryInMs`: the wait before the next automatic attempt, or null when the
 * session waits for the user (a permission change, a click on Retry).
 */
export type SessionStatus =
  | { readonly code: "idle" }
  | {
      readonly code: "connecting";
      readonly url: string;
      readonly attempt: number;
    }
  | {
      /** The browser is asking the user to allow local network access. */
      readonly code: "local-network-prompt";
      readonly url: string;
      readonly permission: PermissionState;
    }
  | {
      /**
       * The browser refused the connection: the permission is denied, or its
       * prompt was dismissed. Chromium blocks a site for 7 days after three
       * dismissals, so the session waits for the user instead of re-asking.
       */
      readonly code: "local-network-denied";
      readonly url: string;
      readonly permission: PermissionState;
      readonly retryInMs: number | null;
    }
  | {
      /**
       * The browser blocks ws://localhost from an HTTPS page outright:
       * Safari and every iOS browser treat it as mixed content.
       */
      readonly code: "browser-blocks-bridge";
      readonly url: string;
      readonly browser: BrowserFamily;
      readonly retryInMs: number | null;
    }
  | {
      /**
       * Nothing answered. The bridge is not running or listens elsewhere; a
       * browser block that reports no state (Firefox without the permission
       * API) looks the same.
       */
      readonly code: "bridge-unreachable";
      readonly url: string;
      readonly attempt: number;
      readonly retryInMs: number | null;
      readonly permission: PermissionState;
      readonly detail: string;
    }
  | {
      /**
       * The bridge accepted the socket, then refused this site. QUsb2Snes
       * closes untrusted origins with 1008 "Not in trusted origin" and asks,
       * in its own window, whether to trust them.
       */
      readonly code: "bridge-refused";
      readonly url: string;
      readonly detail: string;
      readonly retryInMs: number | null;
    }
  | {
      readonly code: "no-device";
      readonly bridge: BridgeInfo;
      readonly retryInMs: number | null;
    }
  | {
      readonly code: "attaching";
      readonly bridge: BridgeInfo;
      readonly device: DeviceDescriptor;
      /** Every device the bridge listed. */
      readonly devices: readonly DeviceDescriptor[];
    }
  | {
      readonly code: "attach-failed";
      readonly bridge: BridgeInfo;
      readonly device: DeviceDescriptor;
      readonly detail: string;
      readonly retryInMs: number | null;
    }
  | {
      readonly code: "memory-unreadable";
      readonly bridge: BridgeInfo;
      readonly device: DeviceInfo;
      readonly cause: UnreadableCause;
      readonly evidence: Evidence;
      readonly remedy: Remedy;
      readonly detail: string;
      readonly retryInMs: number | null;
    }
  | {
      /** The pack's game check says this is not its game, or not yet. */
      readonly code: "game-mismatch";
      readonly bridge: BridgeInfo;
      readonly device: DeviceInfo;
      readonly check: { readonly code: string; readonly message: string };
      readonly retryInMs: number | null;
    }
  | {
      readonly code: "connected";
      readonly bridge: BridgeInfo;
      readonly device: DeviceInfo;
      readonly race: RaceStatus;
      /** Ranges this device cannot serve; they never update. */
      readonly unreadable: readonly string[];
      /** Whether polling is paused because the page is hidden. */
      readonly paused: boolean;
    }
  | { readonly code: "stopped" };

export type SessionCode = SessionStatus["code"];

/** Every code, in the order a successful session meets them. */
export const SESSION_CODES: readonly SessionCode[] = [
  "idle",
  "connecting",
  "local-network-prompt",
  "local-network-denied",
  "browser-blocks-bridge",
  "bridge-unreachable",
  "bridge-refused",
  "no-device",
  "attaching",
  "attach-failed",
  "memory-unreadable",
  "game-mismatch",
  "connected",
  "stopped",
];

/** RetroArch's READ_CORE_MEMORY error texts (command.c, command_memory_get_pointer). */
const RETROARCH_REPLIES: readonly (readonly [string, UnreadableCause])[] = [
  ["no memory map defined", "no-memory-map"],
  ["no descriptor for address", "address-unmapped"],
  ["no data for descriptor", "address-unmapped"],
];

/** QUsb2Snes's RetroArch errors (devices/retroarchhost.cpp makeInfoFail). */
const QUSB2SNES_REPLIES: readonly (readonly [string, UnreadableCause])[] = [
  ["core does not support memory read", "no-memory-map"],
  ["not running a super nintendo game", "no-content"],
  ["can't get rom info", "rom-unreadable"],
];

function remedyFor(
  cause: UnreadableCause,
  device: DeviceInfo,
  bridge: BridgeInfo,
): Remedy {
  switch (cause) {
    case "no-memory-map":
    case "address-unmapped":
    case "zero-filled":
      return device.device.kind === "retroarch"
        ? { action: "switch-core", core: "bsnes-mercury" }
        : { action: "check-bridge-log" };
    case "no-content":
      return { action: "load-game" };
    case "rom-unreadable":
      return bridge.kind === "qusb2snes"
        ? { action: "use-sni" }
        : { action: "check-bridge-log" };
    case "read-failed":
      return { action: "check-bridge-log" };
  }
}

export interface Unreadable {
  readonly cause: UnreadableCause;
  readonly evidence: Evidence;
  readonly remedy: Remedy;
  readonly detail: string;
}

export function unreadable(
  cause: UnreadableCause,
  evidence: Evidence,
  device: DeviceInfo,
  bridge: BridgeInfo,
  detail: string,
): Unreadable {
  return { cause, detail, evidence, remedy: remedyFor(cause, device, bridge) };
}

/**
 * Why a read on an attached device failed, from the error and what is known
 * of the bridge and device:
 * - an error text from RetroArch or QUsb2Snes names its cause;
 * - Info already said nothing is loaded: no content;
 * - SNI on RetroArch drops the socket on the first GetAddress when it cannot
 *   detect the ROM's memory mapping (services/usb2snes/usb2snes.go calls
 *   mapping.Detect, which fails when every header read comes back as the
 *   zeros raclient.go substitutes for `-1` replies). With content loaded,
 *   that means the core declares no memory map.
 */
export function classifyReadFailure(
  error: TransportError,
  device: DeviceInfo,
  bridge: BridgeInfo,
): Unreadable {
  const detail = error.detail.reason || error.message;
  const text = `${error.detail.reason ?? ""} ${error.message}`.toLowerCase();
  for (const [reply, cause] of [...RETROARCH_REPLIES, ...QUSB2SNES_REPLIES]) {
    if (text.includes(reply))
      return unreadable(cause, "reply", device, bridge, detail);
  }
  if (device.rom === null)
    return unreadable("no-content", "inferred", device, bridge, detail);
  if (
    error.code === "closed" &&
    bridge.kind === "sni" &&
    device.device.kind === "retroarch"
  ) {
    return unreadable("no-memory-map", "inferred", device, bridge, detail);
  }
  return unreadable("read-failed", "inferred", device, bridge, detail);
}

/** QUsb2Snes refusing an untrusted origin (core/wsserver.cpp onNewWsClient). */
export function isOriginRefusal(error: TransportError): boolean {
  return (
    error.code === "closed" &&
    (error.detail.closeCode === 1008 ||
      /trusted origin/i.test(error.detail.reason ?? ""))
  );
}
