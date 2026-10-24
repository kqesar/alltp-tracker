import type { SessionStatus, SetupVariant } from "@alltp/autotrack";
import { describe, expect, it } from "vitest";
import { STATUSES, statusOf } from "@/autotrack/fixtures";
import { deviceInUse, fixFor } from "@/autotrack/guide";

/** The browser's own permission instructions, as the setup guide has them. */
const ALLOW: SetupVariant[] = [
  {
    items: ["Blocked by mistake? Allow it in the settings."],
    links: [],
    sources: [],
    title: "Firefox",
    when: { browser: ["firefox"] },
  },
];

const linesOf = (status: SessionStatus) =>
  fixFor(status, ALLOW)?.lines.join(" ");

describe("fixFor", () => {
  it("has nothing to fix while the session connects or reads", () => {
    for (const code of [
      "idle",
      "connecting",
      "attaching",
      "connected",
      "stopped",
    ] as const) {
      expect(fixFor(STATUSES[code], ALLOW)).toBeNull();
    }
  });

  it("says SNI may be stopped or blocked, and shows where to allow it", () => {
    const fix = fixFor(STATUSES["bridge-unreachable"], ALLOW);

    expect(fix?.lines).toEqual([
      "Start SNI and leave it running.",
      "Already running? The browser may be blocking it, which looks the same: allow it as below.",
      "The tracker tries again on its own.",
    ]);
    expect(fix?.allow).toBe(ALLOW);
  });

  it("asks for a click when the session waits for one", () => {
    const fix = fixFor(STATUSES["local-network-denied"], ALLOW);

    expect(fix?.lines.at(-1)).toBe("Then click Retry now.");
    expect(fix?.allow).toBe(ALLOW);
    expect(
      fixFor(statusOf("bridge-unreachable", { retryInMs: null }), ALLOW)?.lines,
    ).toContain("Then click Retry now.");
  });

  it("shows the browser's instructions only where a block is in question", () => {
    for (const code of [
      "local-network-prompt",
      "browser-blocks-bridge",
      "bridge-refused",
      "no-device",
      "attach-failed",
      "memory-unreadable",
      "game-mismatch",
    ] as const) {
      expect(fixFor(STATUSES[code], ALLOW)?.allow).toEqual([]);
    }
  });

  it("words each failure's fix", () => {
    expect(linesOf(STATUSES["local-network-prompt"])).toContain("click Allow");
    expect(linesOf(STATUSES["browser-blocks-bridge"])).toContain(
      "or the desktop app, which reaches SNI from any Mac.",
    );
    expect(linesOf(STATUSES["bridge-refused"])).toContain("click Yes there");
    expect(linesOf(STATUSES["no-device"])).toContain("FX Pak Pro");
    expect(linesOf(STATUSES["attach-failed"])).toBe(
      "It said: “closed”. Restart the emulator, or plug the cart in again. The tracker tries again on its own.",
    );
    expect(linesOf(statusOf("attach-failed", { detail: "" }))).not.toContain(
      "It said",
    );
    expect(linesOf(STATUSES["game-mismatch"])).toBe(
      "The original game. The tracker tries again on its own.",
    );
    expect(fixFor(STATUSES["game-mismatch"], [])).not.toHaveProperty("board");
  });

  it("offers the Archipelago board for a ROM Archipelago patched", () => {
    const ap = statusOf("game-mismatch", {
      check: { code: "archipelago-rom", message: "An Archipelago seed." },
    });
    // No "tries again": waiting on this ROM would never end
    expect(fixFor(ap, [])).toEqual({
      allow: [],
      board: "archipelago",
      lines: ["An Archipelago seed."],
    });
  });

  it("follows the session's remedy when memory cannot be read", () => {
    const unreadable = (
      cause: Extract<SessionStatus, { code: "memory-unreadable" }>["cause"],
      remedy: Extract<SessionStatus, { code: "memory-unreadable" }>["remedy"],
      detail = "",
    ) => linesOf(statusOf("memory-unreadable", { cause, detail, remedy }));
    const switchCore = {
      action: "switch-core",
      core: "bsnes-mercury",
    } as const;

    expect(unreadable("no-memory-map", switchCore)).toContain(
      "This RetroArch core gives the tracker no memory to read. Run the game with the bsnes-mercury core",
    );
    expect(unreadable("address-unmapped", switchCore)).toContain(
      "This core does not map the memory the tracker reads.",
    );
    expect(unreadable("zero-filled", switchCore)).toContain(
      "Every byte came back as zero",
    );
    expect(unreadable("no-content", { action: "load-game" })).toBe(
      "Load your seed. The tracker tries again on its own.",
    );
    expect(unreadable("rom-unreadable", { action: "use-sni" })).toContain(
      "Use SNI instead (step 1).",
    );
    expect(
      unreadable("read-failed", { action: "check-bridge-log" }, "timeout"),
    ).toBe(
      "It said: “timeout”. SNI's log says why: step 2 says where it is. The tracker tries again on its own.",
    );
  });
});

describe("deviceInUse", () => {
  it("is the device a status names, once listed or attached", () => {
    expect(deviceInUse(STATUSES.attaching)).toBe("retroarch");
    expect(deviceInUse(STATUSES["attach-failed"])).toBe("retroarch");
    expect(deviceInUse(STATUSES.connected)).toBe("retroarch");
    expect(deviceInUse(STATUSES["memory-unreadable"])).toBe("retroarch");
    expect(deviceInUse(STATUSES["game-mismatch"])).toBe("retroarch");
    expect(deviceInUse(STATUSES["no-device"])).toBeNull();
    expect(deviceInUse(STATUSES.idle)).toBeNull();
  });
});
