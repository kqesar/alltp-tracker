// What to do about a failing status, for the setup step it fails: the
// dialog opens that step and shows this above the step's own instructions.
// The headline (status.ts) says what is wrong; this says how to fix it.

import type { DeviceKind, SessionStatus, SetupVariant } from "@alltp/autotrack";
import { AP_ROM } from "@/autotrack/status";
import { isDesktopApp } from "@/utils/platform";

export type Fix = {
  /** What to do, a sentence each. */
  readonly lines: readonly string[];
  /**
   * The browser's own instructions to allow the connection, shown where a
   * block cannot be told from a stopped bridge.
   */
  readonly allow: readonly SetupVariant[];
  /**
   * The board that follows this ROM instead: the Archipelago board, for a
   * ROM Archipelago patched (its client tracks it into the room).
   */
  readonly board?: "archipelago";
};

/** The device a status names, once the bridge has listed or attached it. */
export const deviceInUse = (status: SessionStatus): DeviceKind | null => {
  switch (status.code) {
    case "attaching":
    case "attach-failed":
      return status.device.kind;
    case "memory-unreadable":
    case "game-mismatch":
    case "connected":
      return status.device.device.kind;
    default:
      return null;
  }
};

/** What the session does next: retry on its own, or wait for a click. */
const next = (status: SessionStatus) =>
  "retryInMs" in status && status.retryInMs === null
    ? "Then click Retry now."
    : "The tracker tries again on its own.";

/** What the bridge said, when it said anything. */
const said = (detail: string) => (detail ? [`It said: “${detail}”.`] : []);

const SWITCH_CORE =
  "Run the game with the bsnes-mercury core, as below: Snes9x, bsnes and bsnes-hd give RetroArch no memory map.";

/**
 * How to fix a failing status.
 * @param status - The status shown
 * @param allow - The browser's permission instructions (the setup guide's
 * permission step, for this browser)
 * @returns Null for a status that needs no fix
 */
export const fixFor = (
  status: SessionStatus,
  allow: readonly SetupVariant[],
): Fix | null => {
  const fix = (lines: string[], withAllow = false): Fix => ({
    allow: withAllow ? allow : [],
    lines,
  });
  switch (status.code) {
    case "local-network-prompt":
      return fix([
        "The browser asks whether this site may reach apps on this device: click Allow.",
      ]);
    case "local-network-denied":
      return fix(
        ["Allow the connection in the browser, as below.", next(status)],
        true,
      );
    case "browser-blocks-bridge":
      return fix([
        "Safari and every browser on iOS refuse a secure site's connection to this computer.",
        "Use Firefox, Chrome or Edge on a computer, or the desktop app, which reaches SNI from any Mac.",
      ]);
    case "bridge-unreachable":
      // The desktop app tries RetroArch, then SNI; no browser can block it
      if (isDesktopApp) {
        return fix([
          "Start RetroArch with its network commands on, as below, and load your seed.",
          "An FX Pak Pro, BizHawk or an NWA emulator goes through SNI: start SNI and leave it running.",
          next(status),
        ]);
      }
      return fix(
        [
          "Start SNI and leave it running.",
          "Already running? The browser may be blocking it, which looks the same: allow it as below.",
          next(status),
        ],
        true,
      );
    case "bridge-refused":
      return fix([
        "QUsb2Snes asks, in its own window, whether to trust this site: click Yes there.",
        next(status),
      ]);
    case "no-device":
      return fix([
        ...(isDesktopApp
          ? [
              "Start RetroArch with its network commands on, as below, and load your seed.",
              "SNI is running: another emulator needs its network access on, an FX Pak Pro the console powered on.",
            ]
          : [
              "Start the emulator with its network access on, as below, or plug in the FX Pak Pro and power the console on.",
            ]),
        next(status),
      ]);
    case "attach-failed":
      return fix([
        ...said(status.detail),
        "Restart the emulator, or plug the cart in again.",
        next(status),
      ]);
    case "memory-unreadable":
      return fix(memoryFix(status));
    case "game-mismatch":
      return status.check.code === AP_ROM
        ? { ...fix([status.check.message]), board: "archipelago" }
        : fix([status.check.message, next(status)]);
    default:
      return null;
  }
};

/** How to let the tracker read the game, by the session's remedy. */
const memoryFix = (
  status: Extract<SessionStatus, { code: "memory-unreadable" }>,
): string[] => {
  // The desktop app reads RetroArch itself: no bridge, no bridge's log
  const direct = isDesktopApp && status.bridge.kind === "retroarch";
  switch (status.remedy.action) {
    case "switch-core":
      return [
        status.cause === "zero-filled"
          ? direct
            ? "Every byte came back as zero: this core gives RetroArch no memory to read."
            : "Every byte came back as zero: SNI's sign that RetroArch refused the read."
          : status.cause === "address-unmapped"
            ? "This core does not map the memory the tracker reads."
            : "This RetroArch core gives the tracker no memory to read.",
        SWITCH_CORE,
      ];
    case "load-game":
      return ["Load your seed.", next(status)];
    case "use-sni":
      return [
        "QUsb2Snes cannot read the ROM on this device, which the tracker needs to recognise the seed.",
        "Use SNI instead (step 1).",
      ];
    case "check-bridge-log":
      return [
        ...said(status.detail),
        direct
          ? "Restart RetroArch if this goes on."
          : "SNI's log says why: step 2 says where it is.",
        next(status),
      ];
  }
};
