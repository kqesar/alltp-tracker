// What the tracker says of an autotracking session at a glance: the status
// dot's phase and a short headline, for the toolbar, its live region and the
// dialog. The session's diagnostic codes are @alltp/autotrack's (its README,
// "Diagnostic codes"); this module only words them. It is part of the main
// bundle, so it imports types alone. The desktop app words what differs
// there: it reads RetroArch itself, and no browser stands in between.

import type {
  ARCHIPELAGO_ROM,
  BridgeInfo,
  DeviceInfo,
  DeviceKind,
  SessionStatus,
} from "@alltp/autotrack";
import { isDesktopApp } from "@/utils/platform";

/**
 * A pack's code for a ROM Archipelago patched, spelled here so this module
 * keeps to types: the type holds it to the package's constant.
 */
export const AP_ROM: typeof ARCHIPELAGO_ROM = "archipelago-rom";

/**
 * The status dot: off; busy (starting, connecting, attaching, or the
 * browser's prompt waiting for an answer); on (reading the game); a problem
 * that the setup guide explains.
 */
export type Phase = "off" | "busy" | "on" | "problem";

/**
 * The dot's phase.
 * @param status - The status shown (see `shownStatus`)
 * @param active - Whether a session runs or is starting
 * @param elsewhere - Whether another tab of the tracker holds the session:
 * this one reads nothing, and waits without a busy dot
 */
export const phaseOf = (
  status: SessionStatus,
  active: boolean,
  elsewhere = false,
): Phase => {
  if (!active || elsewhere) return "off";
  switch (status.code) {
    case "connected":
      return "on";
    case "idle":
    case "stopped":
    case "connecting":
    case "local-network-prompt":
    case "attaching":
      return "busy";
    default:
      return "problem";
  }
};

/**
 * The status to show for the session's latest. A retry ("connecting" from
 * the second attempt on) keeps the failure it retries on screen: the dot, the
 * steps and the live region stay put while the session backs off, instead of
 * flickering between "connecting" and the failure every few seconds.
 * @param shown - The status shown so far
 * @param next - The session's new status
 */
export const shownStatus = (
  shown: SessionStatus,
  next: SessionStatus,
): SessionStatus =>
  next.code === "connecting" &&
  next.attempt > 1 &&
  phaseOf(shown, true) === "problem"
    ? shown
    : next;

/** Short words for a kind of device the bridge lists. */
const DEVICE_NAMES: Readonly<Record<DeviceKind, string>> = {
  emunwa: "the emulator",
  fxpakpro: "the FX Pak Pro",
  luabridge: "BizHawk",
  retroarch: "RetroArch",
  "snes-classic": "the SNES Classic",
  unknown: "the device",
};

const deviceName = (kind: DeviceKind) => DEVICE_NAMES[kind];

/**
 * A few words for the status: the toolbar's tooltip and accessible name, the
 * live region, the dialog's heading. A failure says what is wrong in the
 * player's terms; the setup guide says what to do.
 * @param status - The status shown
 * @param active - Whether a session runs or is starting
 * @param elsewhere - Whether another tab of the tracker holds the session
 * @param seed - What the board tracks, as the headline names it when another
 * game runs: "an ALttPR seed", "a Map Rando seed"
 */
export const headlineOf = (
  status: SessionStatus,
  active: boolean,
  elsewhere = false,
  seed = "an ALttPR seed",
): string => {
  if (!active) return "Off";
  if (elsewhere) return "Running in another tab";
  switch (status.code) {
    case "idle":
    case "stopped":
      return "Starting…";
    case "connecting":
      return "Connecting…";
    case "local-network-prompt":
      return "Allow the connection in the browser's prompt";
    case "local-network-denied":
      return "The browser is blocking the connection to SNI";
    case "browser-blocks-bridge":
      return "This browser cannot reach SNI from this site";
    case "bridge-unreachable":
      // A browser that denies the connection reports it as a closed port:
      // the two cannot be told apart, so both are named.
      return isDesktopApp
        ? "Neither RetroArch nor SNI is answering"
        : "SNI isn't running, or the browser is blocking it";
    case "bridge-refused":
      return "The bridge refused this site";
    case "no-device":
      // In the app, RetroArch did not answer either
      return isDesktopApp
        ? "Neither RetroArch nor SNI sees a game"
        : "SNI sees no emulator or console";
    case "attaching":
      return `Attaching to ${deviceName(status.device.kind)}…`;
    case "attach-failed":
      return `Could not attach to ${deviceName(status.device.kind)}`;
    case "memory-unreadable":
      return status.cause === "no-content"
        ? "No game is running"
        : `Cannot read the game's memory on ${deviceName(status.device.device.kind)}`;
    case "game-mismatch":
      return status.check.code === "zero-filled"
        ? "The ROM reads as zeros"
        : status.check.code === AP_ROM
          ? "This is an Archipelago seed"
          : `This is not ${seed}`;
    case "connected":
      return status.paused ? "Connected, paused while hidden" : "Connected";
  }
};

const BRIDGE_NAMES: Record<BridgeInfo["kind"], string> = {
  qusb2snes: "QUsb2Snes",
  // No bridge: RetroArch read directly, which the device's title names
  retroarch: "",
  sni: "SNI",
  unknown: "The bridge",
};

const DEVICE_TITLES: Partial<Record<DeviceKind, string>> = {
  emunwa: "NWA emulator",
  fxpakpro: "FX Pak Pro",
  luabridge: "BizHawk",
  retroarch: "RetroArch",
  "snes-classic": "SNES Classic",
};

/** "SNI 0.0.103"; nothing for RetroArch read directly. */
const bridgeName = (bridge: BridgeInfo) =>
  BRIDGE_NAMES[bridge.kind] &&
  [BRIDGE_NAMES[bridge.kind], bridge.version].filter(Boolean).join(" ");

/** "RetroArch 1.22.2", from the kind of device and what Info reported. */
const deviceTitle = (info: DeviceInfo) =>
  [DEVICE_TITLES[info.device.kind] ?? info.name, info.version]
    .filter(Boolean)
    .join(" ");

/**
 * The line under the dialog's headline: what is connected, or what happens
 * next.
 * @param status - The status shown
 * @param active - Whether a session runs or is starting
 * @param elsewhere - Whether another tab of the tracker holds the session
 */
export const detailOf = (
  status: SessionStatus,
  active: boolean,
  elsewhere: boolean,
): string => {
  if (!active) {
    return isDesktopApp
      ? "Reads your game from RetroArch itself, or through SNI for other emulators and consoles, as you play. Set it up below, then connect."
      : "Reads your game through SNI or QUsb2Snes as you play. Set it up below, then connect.";
  }
  if (elsewhere) {
    return "Another tab of the tracker reads your game and marks it on the board. This tab takes over when that one closes or disconnects.";
  }
  switch (status.code) {
    case "connected":
      return [
        bridgeName(status.bridge),
        deviceTitle(status.device),
        status.device.device.id,
      ]
        .filter(Boolean)
        .join(" · ");
    case "attaching":
      return [bridgeName(status.bridge), status.device.id]
        .filter(Boolean)
        .join(" · ");
    default:
      if (!("retryInMs" in status)) return "";
      return status.retryInMs === null
        ? "Waiting for you: see the step below, then click Retry now."
        : "Trying again on its own: see the step below.";
  }
};
