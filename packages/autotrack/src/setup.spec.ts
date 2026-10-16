import { describe, expect, it } from "vitest";
import { infoFor, RETROARCH, SNI } from "../test/memory-transport";
import {
  SESSION_CODES,
  type SessionStatus,
  type UnreadableCause,
} from "./diagnostics";
import { parseUserAgent } from "./environment";
import { SETUP_STEPS, setupProgress, sniAssets, statusKeys } from "./setup";

const FIREFOX_LINUX = parseUserAgent(
  "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
);
const CHROME_WINDOWS = parseUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
);

const CAUSES: readonly UnreadableCause[] = [
  "no-memory-map",
  "no-content",
  "address-unmapped",
  "rom-unreadable",
  "zero-filled",
  "read-failed",
];

describe("SETUP_STEPS", () => {
  it("only names keys a status can have", () => {
    const valid = new Set<string>([
      ...SESSION_CODES,
      ...CAUSES.map((cause) => `memory-unreadable:${cause}`),
    ]);
    for (const step of SETUP_STEPS) {
      for (const key of [...step.done, ...step.failing])
        expect(valid.has(key)).toBe(true);
    }
  });

  it("cites a source for every variant, and links over https", () => {
    for (const step of SETUP_STEPS) {
      expect(step.variants.length).toBeGreaterThan(0);
      for (const variant of step.variants) {
        if (variant.title !== "Other emulators")
          expect(variant.sources.length).toBeGreaterThan(0);
        for (const url of [
          ...variant.sources,
          ...variant.links.map((l) => l.url),
        ])
          expect(url).toMatch(/^https:\/\//);
      }
    }
  });

  it("gives every failing diagnostic exactly one step to open", () => {
    const failures = [
      "local-network-prompt",
      "local-network-denied",
      "browser-blocks-bridge",
      "bridge-unreachable",
      "bridge-refused",
      "no-device",
      "attach-failed",
      "game-mismatch",
      ...CAUSES.map((cause) => `memory-unreadable:${cause}`),
    ];
    for (const key of failures) {
      expect(
        SETUP_STEPS.filter((step) => step.failing.includes(key)).map(
          (s) => s.id,
        ),
      ).toHaveLength(1);
    }
  });
});

describe("setupProgress", () => {
  const unreadable = (cause: UnreadableCause): SessionStatus => ({
    bridge: SNI,
    cause,
    code: "memory-unreadable",
    detail: "",
    device: infoFor(RETROARCH),
    evidence: "inferred",
    remedy: { action: "switch-core", core: "bsnes-mercury" },
    retryInMs: 1000,
  });

  it("ticks the steps behind the session and opens the failing one", () => {
    const progress = setupProgress(unreadable("no-memory-map"), FIREFOX_LINUX, {
      game: "ALttPR",
    });
    expect(progress.steps.map((s) => [s.step.id, s.state])).toEqual([
      ["get-bridge", "done"],
      ["run-bridge", "done"],
      ["emulator", "failing"],
      ["permission", "done"],
      ["game", "pending"],
    ]);
    expect(progress.focus).toBe("emulator");
    // Only the RetroArch variants, the generic one and the Linux one.
    const emulator = progress.steps[2];
    expect(emulator.variants.map((v) => v.title)).toEqual([
      "RetroArch",
      "RetroArch on Linux",
    ]);
    expect(emulator.variants[0].items[1]).toContain(
      "Custom System Name to ALttPR",
    );
    expect(emulator.variants[0].items.join(" ")).not.toContain("{game}");
  });

  it("opens the browser step on a denied permission, with that browser's text", () => {
    const status: SessionStatus = {
      code: "local-network-denied",
      permission: { name: "loopback-network", state: "denied" },
      retryInMs: null,
      url: "ws://localhost:23074",
    };
    const progress = setupProgress(status, CHROME_WINDOWS);
    expect(progress.focus).toBe("permission");
    const permission = progress.steps.find((s) => s.step.id === "permission");
    expect(permission?.variants.map((v) => v.title)).toEqual([
      "Chrome, Edge and other Chromium browsers",
    ]);
  });

  it("counts a missing ROM against the game step, not the emulator", () => {
    const progress = setupProgress(unreadable("no-content"), null);
    expect(progress.steps.find((s) => s.step.id === "emulator")?.state).toBe(
      "done",
    );
    expect(progress.focus).toBe("game");
  });

  it("starts at the first step and ends with every step done", () => {
    expect(setupProgress({ code: "idle" }, null).focus).toBe("get-bridge");
    const connected: SessionStatus = {
      bridge: SNI,
      code: "connected",
      device: infoFor(RETROARCH),
      paused: false,
      race: {
        active: false,
        flag: "open",
        overridden: false,
        raceLegal: false,
        setting: "auto",
      },
      unreadable: [],
    };
    const done = setupProgress(connected, null);
    expect(done.steps.every((s) => s.state === "done")).toBe(true);
    expect(done.focus).toBeNull();
  });

  it("splits memory failures into keys", () => {
    expect(statusKeys(unreadable("zero-filled"))).toEqual([
      "memory-unreadable",
      "memory-unreadable:zero-filled",
    ]);
    expect(statusKeys({ code: "idle" })).toEqual(["idle"]);
  });
});

describe("sniAssets", () => {
  it("names the release file for the OS and CPU, or all of the OS's", () => {
    expect(
      sniAssets({ arch: "x86_64", os: "linux" }).map((a) => a.name),
    ).toEqual([
      "sni-v0.0.103-linux-amd64.tar.xz",
      "sni-v0.0.103-linux-amd64-notray.tar.xz",
    ]);
    expect(
      sniAssets({ arch: "arm64", os: "macos" }, "0.0.104").map((a) => a.name),
    ).toEqual(["sni-v0.0.104-darwin-universal.tar.gz"]);
    expect(sniAssets({ arch: "unknown", os: "windows" })).toHaveLength(4);
    expect(sniAssets({ arch: "x86_64", os: "android" })).toEqual([]);
  });
});
