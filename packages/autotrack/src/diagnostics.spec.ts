import { describe, expect, it } from "vitest";
import { infoFor, RETROARCH, SNI } from "../test/memory-transport";
import { classifyReadFailure, isOriginRefusal } from "./diagnostics";
import { TransportError } from "./errors";
import type { BridgeInfo } from "./transport";

const QUSB2SNES: BridgeInfo = {
  kind: "qusb2snes",
  url: "ws://localhost:23074",
  version: "0.7.42",
};
const FXPAK = { id: "fxpakpro://./dev/ttyACM0", kind: "fxpakpro" } as const;

function closed(reason = "", closeCode = 1006) {
  return new TransportError("closed", "read", "closed", { closeCode, reason });
}

describe("classifyReadFailure", () => {
  it.each([
    // RetroArch's replies (command.c), as a direct transport would carry them.
    [
      "READ_CORE_MEMORY 7e0000 -1 no memory map defined",
      "no-memory-map",
      "switch-core",
    ],
    [
      "READ_CORE_MEMORY 40ffb0 -1 no descriptor for address",
      "address-unmapped",
      "switch-core",
    ],
    [
      "READ_CORE_MEMORY 40ffb0 -1 no data for descriptor",
      "address-unmapped",
      "switch-core",
    ],
    // QUsb2Snes's RetroArch errors (retroarchhost.cpp).
    [
      "No game is running or core does not support memory read.",
      "no-memory-map",
      "switch-core",
    ],
    ["RetroArch not running a super nintendo game", "no-content", "load-game"],
  ])("reads %j as %s", (text, cause, action) => {
    const result = classifyReadFailure(
      closed(text, 1000),
      infoFor(RETROARCH),
      SNI,
    );
    expect(result).toMatchObject({
      cause,
      evidence: "reply",
      remedy: { action },
    });
  });

  it("points QUsb2Snes users without ROM access to SNI", () => {
    const result = classifyReadFailure(
      closed("Can't get ROM info", 1000),
      infoFor(RETROARCH),
      QUSB2SNES,
    );
    expect(result).toMatchObject({
      cause: "rom-unreadable",
      remedy: { action: "use-sni" },
    });
  });

  it("infers a missing memory map from SNI dropping a RetroArch read", () => {
    expect(
      classifyReadFailure(closed(), infoFor(RETROARCH), SNI),
    ).toMatchObject({
      cause: "no-memory-map",
      detail: "closed",
      evidence: "inferred",
    });
    // Not on QUsb2Snes, nor on an FX Pak Pro: nothing to infer there.
    expect(
      classifyReadFailure(closed(), infoFor(RETROARCH), QUSB2SNES).cause,
    ).toBe("read-failed");
    expect(classifyReadFailure(closed(), infoFor(FXPAK), SNI)).toMatchObject({
      cause: "read-failed",
      remedy: { action: "check-bridge-log" },
    });
  });

  it("blames missing content first when Info said nothing is loaded", () => {
    expect(
      classifyReadFailure(closed(), infoFor(RETROARCH, { rom: null }), SNI)
        .cause,
    ).toBe("no-content");
  });

  it("sends non-RetroArch memory errors to the bridge log", () => {
    const error = new TransportError("device", "read", "no memory map defined");
    expect(classifyReadFailure(error, infoFor(FXPAK), SNI).remedy).toEqual({
      action: "check-bridge-log",
    });
  });
});

describe("isOriginRefusal", () => {
  it("matches QUsb2Snes's close, by code or by text", () => {
    expect(
      isOriginRefusal(
        new TransportError("closed", "app-version", "x", { closeCode: 1008 }),
      ),
    ).toBe(true);
    expect(isOriginRefusal(closed("Not in trusted origin", 1000))).toBe(true);
    expect(isOriginRefusal(closed())).toBe(false);
    expect(
      isOriginRefusal(
        new TransportError("unreachable", "open", "x", { closeCode: 1008 }),
      ),
    ).toBe(false);
  });
});
