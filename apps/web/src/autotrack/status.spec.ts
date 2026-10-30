import { describe, expect, it } from "vitest";
import { INFO, STATUSES, statusOf } from "@/autotrack/fixtures";
import { detailOf, headlineOf, phaseOf, shownStatus } from "@/autotrack/status";

describe("phaseOf", () => {
  it("is off while nothing runs, whatever the last status", () => {
    for (const status of Object.values(STATUSES)) {
      expect(phaseOf(status, false)).toBe("off");
    }
  });

  it("gives every status of a running session its dot", () => {
    const phases = Object.fromEntries(
      Object.entries(STATUSES).map(([code, status]) => [
        code,
        phaseOf(status, true),
      ]),
    );

    expect(phases).toEqual({
      "attach-failed": "problem",
      attaching: "busy",
      "bridge-refused": "problem",
      "bridge-unreachable": "problem",
      "browser-blocks-bridge": "problem",
      connected: "on",
      connecting: "busy",
      "game-mismatch": "problem",
      idle: "busy",
      "local-network-denied": "problem",
      "local-network-prompt": "busy",
      "memory-unreadable": "problem",
      "no-device": "problem",
      stopped: "busy",
    });
  });

  it("is off, with its own words, while another tab holds the session", () => {
    expect(phaseOf(STATUSES.idle, true, true)).toBe("off");
    expect(headlineOf(STATUSES.idle, true, true)).toBe(
      "Running in another tab",
    );
    // Off is off, whichever tab
    expect(headlineOf(STATUSES.idle, false, true)).toBe("Off");
  });
});

describe("shownStatus", () => {
  const retry = statusOf("connecting", { attempt: 2 });

  it("keeps a failure on screen while the session retries it", () => {
    const failing = STATUSES["bridge-unreachable"];

    expect(shownStatus(failing, retry)).toBe(failing);
    expect(shownStatus(failing, STATUSES.connected)).toBe(STATUSES.connected);
  });

  it("shows a first attempt, and a retry that follows no failure", () => {
    expect(shownStatus(STATUSES.connected, STATUSES.connecting)).toBe(
      STATUSES.connecting,
    );
    expect(shownStatus(STATUSES.idle, retry)).toBe(retry);
  });
});

describe("headlineOf", () => {
  it("says Off while nothing runs", () => {
    expect(headlineOf(STATUSES.connected, false)).toBe("Off");
  });

  it("names each status in the player's terms", () => {
    const headlines = Object.fromEntries(
      Object.entries(STATUSES).map(([code, status]) => [
        code,
        headlineOf(status, true),
      ]),
    );

    expect(headlines).toEqual({
      "attach-failed": "Could not attach to RetroArch",
      attaching: "Attaching to RetroArch…",
      "bridge-refused": "The bridge refused this site",
      "bridge-unreachable": "SNI isn't running, or the browser is blocking it",
      "browser-blocks-bridge": "This browser cannot reach SNI from this site",
      connected: "Connected",
      connecting: "Connecting…",
      "game-mismatch": "This is not an ALttPR seed",
      idle: "Starting…",
      "local-network-denied": "The browser is blocking the connection to SNI",
      "local-network-prompt": "Allow the connection in the browser's prompt",
      "memory-unreadable": "Cannot read the game's memory on RetroArch",
      "no-device": "SNI sees no emulator or console",
      stopped: "Starting…",
    });
  });

  it("tells the cases a code covers apart", () => {
    expect(headlineOf(statusOf("connected", { paused: true }), true)).toBe(
      "Connected, paused while hidden",
    );
    expect(
      headlineOf(statusOf("memory-unreadable", { cause: "no-content" }), true),
    ).toBe("No game is running");
    expect(
      headlineOf(
        statusOf("game-mismatch", {
          check: { code: "zero-filled", message: "" },
        }),
        true,
      ),
    ).toBe("The ROM reads as zeros");
    expect(
      headlineOf(statusOf("game-mismatch"), true, false, "a Map Rando seed"),
    ).toBe("This is not a Map Rando seed");
    expect(
      headlineOf(
        statusOf("game-mismatch", {
          check: { code: "archipelago-rom", message: "" },
        }),
        true,
      ),
    ).toBe("This is an Archipelago seed");
    expect(
      headlineOf(
        statusOf("attaching", {
          device: { id: "SD2SNES COM3", kind: "fxpakpro" },
        }),
        true,
      ),
    ).toBe("Attaching to the FX Pak Pro…");
  });
});

describe("detailOf", () => {
  it("names a Lua bridge's kind, not an emulator, and drops its protocol version", () => {
    const device = {
      id: "luabridge://127.0.0.1:50000",
      kind: "luabridge",
    } as const;
    const status = statusOf("connected", {
      device: { ...INFO, device, name: "SNI Connector", version: "4" },
    });
    expect(detailOf(status, true, false)).toBe(
      "SNI 0.0.103 · Lua emulator · luabridge://127.0.0.1:50000",
    );
    expect(headlineOf(statusOf("attaching", { device }), true)).toBe(
      "Attaching to the Lua emulator…",
    );
  });

  it("still gives RetroArch its version", () => {
    expect(detailOf(STATUSES.connected, true, false)).toContain(
      "RetroArch 1.22.2",
    );
  });
});
