import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { infoFor, RETROARCH, SNI } from "../test/memory-transport";
import { SESSION_CODES, type SessionStatus } from "./diagnostics";
import { parseUserAgent } from "./environment";
import { describeStatus, diagnosticReport } from "./report";
import { AUTOTRACK_VERSION } from "./version";

const ENV = parseUserAgent(
  "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
);
const INFO = infoFor(RETROARCH, { rom: "my-secret-seed-name" });

const SAMPLES: Record<SessionStatus["code"], SessionStatus> = {
  "attach-failed": {
    bridge: SNI,
    code: "attach-failed",
    detail: "closed",
    device: RETROARCH,
    retryInMs: 1000,
  },
  attaching: {
    bridge: SNI,
    code: "attaching",
    device: RETROARCH,
    devices: [RETROARCH],
  },
  "bridge-refused": {
    code: "bridge-refused",
    detail: "Not in trusted origin",
    retryInMs: null,
    url: "ws://x",
  },
  "bridge-unreachable": {
    attempt: 2,
    code: "bridge-unreachable",
    detail: "refused",
    permission: { name: null, state: "unsupported" },
    retryInMs: 2000,
    url: "ws://localhost:23074",
  },
  "browser-blocks-bridge": {
    browser: "safari",
    code: "browser-blocks-bridge",
    retryInMs: null,
    url: "ws://x",
  },
  connected: {
    bridge: SNI,
    code: "connected",
    device: INFO,
    paused: true,
    race: {
      active: true,
      flag: "race",
      overridden: false,
      raceLegal: true,
      setting: "auto",
    },
    unreadable: ["header"],
  },
  connecting: { attempt: 1, code: "connecting", url: "ws://localhost:23074" },
  "game-mismatch": {
    bridge: SNI,
    check: { code: "not-alttp", message: "Not ALttP." },
    code: "game-mismatch",
    device: INFO,
    retryInMs: 1000,
  },
  idle: { code: "idle" },
  "local-network-denied": {
    code: "local-network-denied",
    permission: { name: "loopback-network", state: "denied" },
    retryInMs: null,
    url: "ws://x",
  },
  "local-network-prompt": {
    code: "local-network-prompt",
    permission: { name: "loopback-network", state: "prompt" },
    url: "ws://x",
  },
  "memory-unreadable": {
    bridge: SNI,
    cause: "no-memory-map",
    code: "memory-unreadable",
    detail: "closed",
    device: INFO,
    evidence: "inferred",
    remedy: { action: "switch-core", core: "bsnes-mercury" },
    retryInMs: 1000,
  },
  "no-device": {
    bridge: { ...SNI, version: null },
    code: "no-device",
    retryInMs: 1000,
  },
  stopped: { code: "stopped" },
};

describe("describeStatus", () => {
  it("has a distinct sentence for every code", () => {
    const sentences = SESSION_CODES.map((code) =>
      describeStatus(SAMPLES[code]),
    );
    expect(new Set(sentences).size).toBe(SESSION_CODES.length);
    expect(describeStatus(SAMPLES["no-device"])).toBe(
      "SNI is running but sees no emulator or console.",
    );
  });
});

describe("diagnosticReport", () => {
  it("states what ran, what was found and what failed, without the ROM name", () => {
    const report = diagnosticReport({
      bridge: SNI,
      devices: [RETROARCH],
      environment: ENV,
      now: Date.UTC(2026, 9, 16, 12, 0, 5),
      status: SAMPLES["memory-unreadable"],
      statusSince: Date.UTC(2026, 9, 16, 12, 0, 0),
    });
    expect(report).toBe(
      [
        "ALttP tracker autotracking report",
        `package: @alltp/autotrack ${AUTOTRACK_VERSION}`,
        "time: 2026-10-16T12:00:05.000Z",
        "environment: linux x86_64, Firefox 158, loopback prompt",
        "bridge: sni 0.0.103 at ws://localhost:23074",
        "devices: ra://127.0.0.1:55355 (retroarch)",
        "status: memory-unreadable since 2026-10-16T12:00:00.000Z",
        "message: ra://127.0.0.1:55355 does not let the tracker read memory: no-memory-map (inferred; closed).",
        "remedy: switch-core",
        "device info: retroarch 1.22.2, rom loaded, flags none",
        "next retry: in 1000 ms",
        "",
      ].join("\n"),
    );
    expect(report).not.toContain("my-secret-seed-name");
  });

  it("reports race state, unknowns and waits", () => {
    const connected = diagnosticReport({
      bridge: null,
      devices: [],
      environment: null,
      now: 0,
      status: SAMPLES.connected,
      statusSince: 0,
    });
    expect(connected).toContain("environment: unknown");
    expect(connected).toContain("bridge: not reached");
    expect(connected).toContain("devices: none listed");
    expect(connected).toContain(
      "race: setting auto, flag race, active true, legal true",
    );
    expect(connected).toContain("unreadable ranges: header");
    const waiting = diagnosticReport({
      bridge: null,
      devices: [],
      environment: parseUserAgent(""),
      now: 0,
      status: SAMPLES["bridge-refused"],
      statusSince: 0,
    });
    expect(waiting).toContain("next retry: waiting for the user");
    expect(waiting).toContain("(CPU not reported)");
  });

  it("carries the package version from package.json", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    expect(AUTOTRACK_VERSION).toBe(manifest.version);
  });
});
