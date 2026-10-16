// What the tracker says of an autotracking session at a glance: the status
// dot's phase and a short headline, for the toolbar, its live region and the
// dialog. The session's diagnostic codes are @alltp/autotrack's (its README,
// "Diagnostic codes"); this module only words them. It is part of the main
// bundle, so it imports types alone.

import type { DeviceKind, SessionStatus } from "@alltp/autotrack";

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
 */
export const phaseOf = (status: SessionStatus, active: boolean): Phase => {
  if (!active) return "off";
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
 */
export const headlineOf = (status: SessionStatus, active: boolean): string => {
  if (!active) return "Off";
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
      return "SNI isn't running, or the browser is blocking it";
    case "bridge-refused":
      return "The bridge refused this site";
    case "no-device":
      return "SNI sees no emulator or console";
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
        : "This is not an ALttPR seed";
    case "connected":
      return status.paused ? "Connected, paused while hidden" : "Connected";
  }
};
