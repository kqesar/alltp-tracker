import { describe, expect, it } from "vitest";
import { fixture, packetsTo } from "../test/fixtures";
import { parseAddress, type ServerAddress } from "./address";
import {
  REFUSAL_REASONS,
  SESSION_CODES,
  type SessionStatus,
} from "./diagnostics";
import {
  CLIENT_VERSION,
  describeReach,
  describeRefusal,
  describeStatus,
  diagnosticReport,
  maskUrl,
} from "./report";
import { EMPTY_SNAPSHOT, reduce } from "./snapshot";

const URL_ = "wss://archipelago.gg:60030";

/** One status of each code. */
const STATUSES: SessionStatus[] = [
  { code: "idle" },
  { code: "elsewhere" },
  { addressClass: "public", code: "blocked-insecure" },
  { addressClass: "loopback", browser: "safari", code: "blocked-browser" },
  { addressClass: "private", browser: "firefox", code: "blocked-browser" },
  {
    code: "local-network-prompt",
    permission: "loopback-network",
    url: "ws://127.0.0.1:60030",
  },
  ...(["denied", "prompt"] as const).map(
    (state): SessionStatus => ({
      code: "local-network-denied",
      permission: "local-network",
      retryInMs: null,
      state,
      url: "ws://192.168.1.20:60030",
    }),
  ),
  { attempt: 2, code: "connecting", stage: "socket", url: URL_ },
  { attempt: 2, code: "connecting", stage: "room-info", url: URL_ },
  { attempt: 1, code: "authenticating", url: URL_ },
  ...(
    ["offline", "room-paused", "no-tls", "not-running", "unknown"] as const
  ).map(
    (hint): SessionStatus => ({
      attempt: 3,
      code: "unreachable",
      hint,
      retryInMs: 4000,
      url: URL_,
    }),
  ),
  { attempt: 1, code: "timeout", retryInMs: null, stage: "login", url: URL_ },
  {
    attempt: 1,
    code: "timeout",
    retryInMs: 1000,
    stage: "keepalive",
    url: URL_,
  },
  {
    code: "refused",
    reasons: ["InvalidSlot", "InvalidPassword"],
    serverVersion: "0.6.8",
    url: URL_,
  },
  { code: "connected", url: URL_ },
  { attempt: 1, code: "reconnecting", retryInMs: 1000, url: URL_ },
  { code: "unavailable", detail: "chunk failed" },
  { code: "stopped" },
  { code: "stopped", detail: "Refused to send Bounce" },
];

describe("describeStatus", () => {
  it.each(STATUSES.map((s) => [s.code, s] as const))(
    "says %s in a sentence, never the port",
    (_, status) => {
      const text = describeStatus(status);
      expect(text).toMatch(/^\S.*[.?)]$/);
      expect(text).not.toContain("60030");
    },
  );

  it("covers every code", () => {
    expect(new Set(STATUSES.map((s) => s.code))).toEqual(
      new Set(SESSION_CODES),
    );
  });

  it("gives each refusal by the browser its way out", () => {
    expect(
      describeStatus({ addressClass: "public", code: "blocked-insecure" }),
    ).toMatch(
      /Ask the room's host for a wss:\/\/ address, or use the desktop app\.$/,
    );
    expect(
      describeStatus({
        addressClass: "private",
        browser: "firefox",
        code: "blocked-browser",
      }),
    ).toBe(
      "Firefox does not let a secure site reach a ws:// server on your local network. Use Chrome or Edge, which ask first, or the desktop app.",
    );
    expect(
      describeStatus({
        addressClass: "loopback",
        browser: "safari",
        code: "blocked-browser",
      }),
    ).toMatch(
      /on this device\. Use the desktop app, or Chrome, Edge or Firefox/,
    );
    expect(
      describeStatus({
        code: "local-network-denied",
        permission: "loopback-network",
        retryInMs: null,
        state: "prompt",
        url: "ws://127.0.0.1:1",
      }),
    ).toBe(
      "The browser did not let this site reach this device. Retry, and choose Allow when it asks.",
    );
  });

  it("says before any socket what will happen", () => {
    expect(describeReach({ kind: "open" })).toBeNull();
    expect(
      describeReach({
        browser: "chromium",
        kind: "ask",
        permission: "local-network",
      }),
    ).toBe(
      "The browser will ask to let this site reach your local network: choose Allow.",
    );
    expect(
      describeReach({
        browser: "firefox",
        kind: "ask",
        permission: "loopback-network",
      }),
    ).toMatch(/^If the browser asks/);
    expect(
      describeReach({
        addressClass: "private",
        browser: "safari",
        kind: "blocked-browser",
      }),
    ).toMatch(/Use the desktop app, or Chrome or Edge on a computer\.$/);
  });

  it("says how to undo a refusal, in Chromium's own words", () => {
    const denied = {
      browser: "chromium",
      kind: "denied",
      permission: "loopback-network",
      retry: false,
      state: "denied",
    } as const;
    expect(describeReach(denied)).toBe(
      'The browser blocks this site from reaching this device. To undo it, click the icon left of the address and set "Apps on device" to Allow, then Connect.',
    );
    expect(
      describeReach({ ...denied, permission: "local-network", retry: true }),
    ).toBe(
      'The browser blocks this site from reaching your local network. To undo it, click the icon left of the address and set "Local network" to Allow, then Retry.',
    );
    // A prompt dismissed: Retry asks again, unless the browser stopped asking
    expect(describeReach({ ...denied, retry: true, state: "prompt" })).toBe(
      'The browser did not let this site reach this device. Retry, and choose Allow when it asks; if it no longer asks, click the icon left of the address and set "Apps on device" to Allow.',
    );
    // Other browsers' labels are not known: where to look instead
    expect(describeReach({ ...denied, browser: "firefox" })).toMatch(
      /To undo it, allow it in the site's settings \(the icon left of the address\), then Connect\.$/,
    );
  });

  it("explains a --compatibility 0 refusal with both versions", () => {
    expect(describeRefusal("IncompatibleVersion", "0.6.8")).toContain(
      "(0.6.8)",
    );
    expect(describeRefusal("IncompatibleVersion", "0.6.8")).toContain(
      `(${CLIENT_VERSION})`,
    );
    expect(describeRefusal("IncompatibleVersion", null)).toContain(
      CLIENT_VERSION,
    );
    expect(CLIENT_VERSION).toBe("0.6.3");
  });

  it("has one sentence per refusal reason, and a fallback", () => {
    const sentences = REFUSAL_REASONS.map((r) => describeRefusal(r, "0.6.8"));
    expect(new Set(sentences).size).toBe(REFUSAL_REASONS.length);
    expect(describeRefusal("Mystery", null)).toContain("Mystery");
  });
});

describe("diagnosticReport", () => {
  const at = (text: string): ServerAddress => {
    const parsed = parseAddress(text);
    if (!parsed.ok || parsed.kind !== "server") throw new Error(text);
    return parsed.address;
  };
  const connected = (() => {
    let s = EMPTY_SNAPSHOT;
    for (const p of packetsTo(fixture("normal-session"), "tracker"))
      s = reduce(s, p).snapshot;
    return s;
  })();

  it("holds no slot name, password or port", () => {
    const report = diagnosticReport({
      address: at("wss://archipelago.gg:60030"),
      now: Date.UTC(2026, 9, 24),
      page: { browser: "chromium", kind: "secure" },
      snapshot: connected,
      status: {
        code: "refused",
        reasons: ["InvalidPassword"],
        serverVersion: "0.6.8",
        url: URL_,
      },
      statusSince: Date.UTC(2026, 9, 24),
    });
    expect(report).not.toContain("60030");
    expect(report).not.toMatch(/\bLink\b(?! to the Past)/);
    expect(report).not.toContain("bench-pass");
    expect(report).toContain("address: wss://archipelago.gg:•••••");
    expect(report).toContain("url: wss://archipelago.gg:•••••");
    expect(report).toContain(
      "room: server 0.6.8, generator 0.6.8, 5 games, password none",
    );
    expect(report).toContain(
      "slot: game A Link to the Past, 5 items, 4/249 checked, race off",
    );
    expect(report).toContain("reasons: InvalidPassword");
    expect(report).toContain("page: site (chromium)");
    expect(report.endsWith("\n")).toBe(true);
  });

  it("reports what is not known yet", () => {
    const report = diagnosticReport({
      address: null,
      now: 0,
      page: { kind: "desktop" },
      snapshot: null,
      status: {
        attempt: 1,
        code: "unreachable",
        hint: "unknown",
        retryInMs: null,
        url: "ws://[::1]:5",
      },
      statusSince: 0,
    });
    expect(report).toContain("address: none");
    expect(report).toContain("room: not reached");
    expect(report).toContain("slot: not connected");
    expect(report).toContain("next retry: waiting for the user");
    expect(report).toContain("url: ws://[::1]:•••••");
    const scheme = diagnosticReport({
      address: at("localhost:38281"),
      now: 0,
      page: { kind: "insecure" },
      snapshot: { ...connected, raceMode: null },
      status: {
        attempt: 1,
        code: "reconnecting",
        retryInMs: 500,
        url: "ws://localhost:38281",
      },
      statusSince: 0,
    });
    expect(scheme).toContain("address: localhost:••••• (scheme not given)");
    expect(scheme).toContain("race unknown");
    expect(scheme).toContain("next retry: in 500 ms");
    expect(
      diagnosticReport({
        address: null,
        now: 0,
        page: { kind: "desktop" },
        snapshot: { ...connected, raceMode: true },
        status: { code: "idle" },
        statusSince: 0,
      }),
    ).toContain("race on");
  });

  it("masks what it cannot read", () => {
    expect(maskUrl("")).toBe("(address)");
    expect(maskUrl("archipelago.gg:1")).toBe("archipelago.gg:•••••");
    expect(
      describeStatus({
        attempt: 1,
        code: "connecting",
        stage: "socket",
        url: "",
      }),
    ).toBe("Reaching the server (attempt 1).");
  });

  it("says when the room wants a password", () => {
    const report = diagnosticReport({
      address: null,
      now: 0,
      page: { kind: "desktop" },
      snapshot: {
        ...EMPTY_SNAPSHOT,
        room: {
          checksums: {},
          games: ["APQuest"],
          generatorVersion: "0.6.8",
          hintCost: null,
          locationCheckPoints: null,
          passwordRequired: true,
          seedName: "s",
          serverVersion: "0.6.8",
        },
      },
      status: { code: "idle" },
      statusSince: 0,
    });
    expect(report).toContain("1 games, password required");
  });
});
