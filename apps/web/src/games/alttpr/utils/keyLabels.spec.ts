import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ariaChord,
  chordKeys,
  chordText,
  keyLabel,
} from "@/games/alttpr/utils/keyLabels";

/** What Chromium reports for a French AZERTY keyboard, in part. */
const AZERTY = new Map([
  ["Digit1", "&"],
  ["KeyA", "q"],
  ["KeyM", ","],
  ["KeyQ", "a"],
  ["KeyW", "z"],
  ["Semicolon", "m"],
  ["Minus", "ß"],
  ["Quote", " "],
]);

describe("keyLabel", () => {
  it("reads a US keyboard's keycaps without a layout map", () => {
    expect(keyLabel("KeyQ")).toBe("Q");
    expect(keyLabel("Digit0")).toBe("0");
    expect(keyLabel("Semicolon")).toBe(";");
    expect(keyLabel("Numpad7")).toBe("Num 7");
    expect(keyLabel("NumpadAdd")).toBe("Num +");
    expect(keyLabel("F13")).toBe("F13");
  });

  it("says what the key types on the player's layout", () => {
    expect(keyLabel("KeyQ", AZERTY)).toBe("A");
    expect(keyLabel("Semicolon", AZERTY)).toBe("M");
    expect(keyLabel("Digit1", AZERTY)).toBe("&");
  });

  it("keeps a character whose upper case is longer", () => {
    expect(keyLabel("Minus", AZERTY)).toBe("ß");
  });

  it("falls back for a key the layout leaves blank or unlisted", () => {
    expect(keyLabel("Quote", AZERTY)).toBe("'");
    expect(keyLabel("Numpad1", AZERTY)).toBe("Num 1");
  });
});

describe("chords", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("are drawn key by key, modifiers first", () => {
    expect(chordKeys("Alt+Shift+KeyW")).toEqual(["Alt", "Shift", "W"]);
    expect(chordText("Shift+KeyW", AZERTY)).toBe("Shift+Z");
    expect(chordText("Control+Meta+KeyR")).toBe("Ctrl+Win+R");
  });

  it("name Option and Cmd on an Apple keyboard", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });

    expect(chordText("Alt+Meta+KeyR")).toBe("Option+Cmd+R");
  });

  it("show a malformed chord as it is written", () => {
    expect(chordKeys("Shift+Shift+KeyW")).toEqual(["Shift+Shift+KeyW"]);
  });

  it("are written in aria-keyshortcuts syntax", () => {
    expect(ariaChord("Shift+KeyW")).toBe("Shift+W");
    expect(ariaChord("Alt+KeyQ", AZERTY)).toBe("Alt+A");
    expect(ariaChord("Numpad4")).toBe("4");
    expect(ariaChord("Digit1", AZERTY)).toBe("&");
  });

  it("leave out of aria-keyshortcuts what its syntax cannot say", () => {
    expect(ariaChord("NumpadAdd")).toBeNull();
    expect(ariaChord("F13")).toBeNull();
    expect(ariaChord("Shift+Shift+KeyW")).toBeNull();
  });
});
