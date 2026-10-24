import { describe, expect, it } from "vitest";
import { fixture, packetsTo } from "../test/fixtures";
import {
  isRefusalReason,
  REFUSAL_REASONS,
  SESSION_CODES,
  unreachableHint,
} from "./diagnostics";

describe("diagnostics", () => {
  it("lists every code once", () => {
    expect(new Set(SESSION_CODES).size).toBe(SESSION_CODES.length);
  });

  it("knows every refusal the bench recorded", () => {
    const recorded = new Set<string>();
    for (const name of ["refused", "password", "compatibility-0"] as const) {
      const data = fixture(name);
      for (const frame of data.frames) {
        for (const packet of frame.packets ?? []) {
          if (packet.cmd === "ConnectionRefused") {
            for (const reason of packet.errors as string[])
              recorded.add(reason);
          }
        }
      }
    }
    expect([...recorded].sort()).toEqual([...REFUSAL_REASONS].sort());
    expect(isRefusalReason("InvalidSlot")).toBe(true);
    expect(isRefusalReason("Nope")).toBe(false);
    // The bench's refusals reach the client before anything else.
    expect(packetsTo(fixture("password"), "password:no password")[1]).toEqual({
      cmd: "ConnectionRefused",
      errors: ["InvalidPassword"],
    });
  });

  it.each([
    [{ failures: 1, online: false, url: "wss://archipelago.gg:1" }, "offline"],
    [{ failures: 2, online: true, url: "wss://archipelago.gg:1" }, "unknown"],
    [
      { failures: 3, online: true, url: "wss://archipelago.gg:1" },
      "room-paused",
    ],
    [{ failures: 1, online: true, url: "wss://192.168.1.2:1" }, "no-tls"],
    [{ failures: 1, online: true, url: "wss://[::1]:1" }, "no-tls"],
    [{ failures: 1, online: true, url: "wss://example.com:1" }, "no-tls"],
    [{ failures: 1, online: true, url: "ws://example.com:1" }, "unknown"],
    [{ failures: 1, online: true, url: "ws://127.0.0.1:1" }, "not-running"],
    [{ failures: 1, online: true, url: "nonsense" }, "unknown"],
  ])("hints %j as %s", (input, hint) => {
    expect(unreachableHint(input)).toBe(hint);
  });
});
