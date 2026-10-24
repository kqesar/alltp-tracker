import type { SessionStatus } from "@alltp/archipelago";
import { describe, expect, it } from "vitest";
import { headlineOf, phaseOf, waits } from "@/games/archipelago/status";

const URL = "wss://archipelago.gg:38281";

/** One status of each code. */
const STATUSES: Record<SessionStatus["code"], SessionStatus> = {
  authenticating: { attempt: 1, code: "authenticating", url: URL },
  "blocked-browser": {
    addressClass: "private",
    browser: "firefox",
    code: "blocked-browser",
  },
  "blocked-insecure": { addressClass: "public", code: "blocked-insecure" },
  connected: { code: "connected", url: URL },
  connecting: { attempt: 1, code: "connecting", stage: "socket", url: URL },
  elsewhere: { code: "elsewhere" },
  idle: { code: "idle" },
  "local-network-denied": {
    code: "local-network-denied",
    permission: "loopback-network",
    retryInMs: null,
    state: "denied",
    url: "ws://127.0.0.1:38281",
  },
  "local-network-prompt": {
    code: "local-network-prompt",
    permission: "loopback-network",
    url: "ws://127.0.0.1:38281",
  },
  reconnecting: { attempt: 1, code: "reconnecting", retryInMs: 1000, url: URL },
  refused: {
    code: "refused",
    reasons: ["InvalidSlot"],
    serverVersion: null,
    url: URL,
  },
  stopped: { code: "stopped" },
  timeout: {
    attempt: 1,
    code: "timeout",
    retryInMs: 1000,
    stage: "socket",
    url: URL,
  },
  unavailable: { code: "unavailable", detail: "offline" },
  unreachable: {
    attempt: 1,
    code: "unreachable",
    hint: "unknown",
    retryInMs: 1000,
    url: URL,
  },
};

describe("the connection's words", () => {
  it("give every status a phase and a headline", () => {
    const table = Object.fromEntries(
      Object.entries(STATUSES).map(([code, status]) => [
        code,
        [phaseOf(status), headlineOf(status)],
      ]),
    );
    expect(table).toEqual({
      authenticating: ["busy", "Connecting…"],
      "blocked-browser": ["problem", "Blocked by the browser"],
      "blocked-insecure": ["problem", "Blocked by the browser"],
      connected: ["on", "Connected"],
      connecting: ["busy", "Connecting…"],
      elsewhere: ["on", "Connected in another tab"],
      idle: ["off", "Not connected"],
      "local-network-denied": ["problem", "Blocked by the browser"],
      "local-network-prompt": ["busy", "Allow the connection in the browser"],
      reconnecting: ["busy", "Reconnecting…"],
      refused: ["problem", "Refused by the room"],
      stopped: ["off", "Not connected"],
      timeout: ["problem", "The room does not answer"],
      unavailable: ["problem", "Could not load"],
      unreachable: ["problem", "Room unreachable"],
    });
  });

  it("know when the session waits to try again", () => {
    expect(waits(STATUSES.unreachable)).toBe(true);
    expect(waits(STATUSES.refused)).toBe(false);
    // Retry asks the browser again; its prompt itself is the player's
    expect(waits(STATUSES["local-network-denied"])).toBe(true);
    expect(waits(STATUSES["local-network-prompt"])).toBe(false);
  });
});
