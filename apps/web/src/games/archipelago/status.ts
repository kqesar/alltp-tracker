// The connection's status in the board's words: the dot's phase and a short
// headline. The sentence under it is the package's (`describeStatus`).

import type { SessionStatus } from "@alltp/archipelago";
import type { Phase } from "@/autotrack/status";

/** The status dot's phase: off, busy, on or a problem. */
export const phaseOf = (status: SessionStatus): Phase => {
  switch (status.code) {
    case "idle":
    case "stopped":
      return "off";
    case "connecting":
    case "authenticating":
    case "reconnecting":
    case "local-network-prompt":
      return "busy";
    case "connected":
    case "elsewhere":
      return "on";
    default:
      return "problem";
  }
};

/** A few words for the status: the Room button's, the room line's. */
export const headlineOf = (status: SessionStatus): string => {
  switch (status.code) {
    case "idle":
    case "stopped":
      return "Not connected";
    case "elsewhere":
      return "Connected in another tab";
    case "connecting":
    case "authenticating":
      return "Connecting…";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting…";
    case "refused":
      return "Refused by the room";
    case "unreachable":
      return "Room unreachable";
    case "timeout":
      return "The room does not answer";
    case "blocked-insecure":
    case "blocked-browser":
    case "local-network-denied":
      return "Blocked by the browser";
    case "local-network-prompt":
      return "Allow the connection in the browser";
    case "unavailable":
      return "Could not load";
  }
};

/** Whether the session waits before its next attempt, or for the player. */
export const waits = (status: SessionStatus): boolean => "retryInMs" in status;
