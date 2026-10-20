import { describe, expect, it } from "vitest";
import {
  globalRefusalOf,
  windowHolderOf,
} from "@/games/alttpr/desktop/globalKeymap";

describe("what a global chord may be", () => {
  it("takes a character key with two modifiers", () => {
    for (const chord of [
      "Control+Alt+KeyH",
      "Control+Shift+Digit1",
      "Alt+Shift+Semicolon",
      "Control+Meta+F5",
      "Alt+Shift+Backquote",
    ]) {
      expect(globalRefusalOf(chord, "linux", {})).toBeNull();
    }
  });

  it("refuses a character key that one modifier or none would take from every app", () => {
    for (const chord of [
      "KeyH",
      "Shift+KeyH",
      "Alt+KeyH",
      "Control+KeyH",
      "Meta+Digit1",
      "F5",
      "Control+F12",
      "Semicolon",
    ]) {
      expect(globalRefusalOf(chord, "linux", {})).toBe("typing");
    }
  });

  it("leaves the numpad and the high function keys free, alone or with any modifiers", () => {
    for (const chord of [
      "Numpad1",
      "Shift+Numpad7",
      "NumpadAdd",
      "Control+NumpadDecimal",
      "F13",
      "Shift+F24",
    ]) {
      expect(globalRefusalOf(chord, "windows", {})).toBeNull();
    }
  });

  it("refuses what cannot be grabbed", () => {
    for (const chord of [
      "",
      "Control+Alt+Tab",
      "Control+Alt+Enter",
      "Control+Alt+Space",
      "Control+Alt+ArrowUp",
      "Control+Alt+Escape",
      "Control+Alt+IntlBackslash",
      "Control+Alt+IntlRo",
      "Control+Alt+NumpadEqual",
      "Control+Alt+F25",
      "Alt+Control+KeyH", // not the canonical order
      "Control+Alt+keyh",
    ]) {
      expect(globalRefusalOf(chord, "linux", {})).toBe("key");
    }
  });

  it("refuses Ctrl+Alt on a character key on Windows, where it is AltGr", () => {
    expect(globalRefusalOf("Control+Alt+KeyQ", "windows", {})).toBe("altgr");
    expect(globalRefusalOf("Control+Alt+Digit2", "windows", {})).toBe("altgr");
    // With a third modifier it is no AltGr, and elsewhere it never was
    expect(globalRefusalOf("Control+Alt+Shift+KeyQ", "windows", {})).toBeNull();
    expect(globalRefusalOf("Control+Alt+KeyQ", "linux", {})).toBeNull();
    expect(globalRefusalOf("Control+Alt+KeyQ", "macos", {})).toBeNull();
    // The numpad types nothing: AltGr costs nothing there
    expect(globalRefusalOf("Control+Alt+Numpad1", "windows", {})).toBeNull();
  });

  it("asks Ctrl or Cmd on a character key on macOS, where Option types characters", () => {
    for (const chord of [
      "Alt+Shift+KeyQ",
      "Alt+Shift+Digit1",
      "Alt+Shift+Backquote",
    ]) {
      expect(globalRefusalOf(chord, "macos", {})).toBe("typing");
      expect(globalRefusalOf(chord, "linux", {})).toBeNull();
      expect(globalRefusalOf(chord, "windows", {})).toBeNull();
    }
    for (const chord of [
      "Control+Shift+KeyQ",
      "Shift+Meta+KeyQ",
      "Control+Alt+KeyQ",
      "Alt+Meta+KeyE",
    ]) {
      expect(globalRefusalOf(chord, "macos", {})).toBeNull();
    }
    // The numpad and F13+ stay free, with Option or alone
    expect(globalRefusalOf("Alt+Numpad1", "macos", {})).toBeNull();
    expect(globalRefusalOf("F13", "macos", {})).toBeNull();
  });

  it("refuses a chord the tracker window already uses", () => {
    const windowKeymap = { "advance:hookshot": "Alt+Shift+KeyW" };
    expect(globalRefusalOf("Alt+Shift+KeyW", "linux", windowKeymap)).toBe(
      "window",
    );
    expect(windowHolderOf(windowKeymap, "Alt+Shift+KeyW")).toBe(
      "advance:hookshot",
    );
    expect(windowHolderOf(windowKeymap, "Alt+Shift+KeyE")).toBeUndefined();
    expect(globalRefusalOf("Alt+Shift+KeyE", "linux", windowKeymap)).toBeNull();
    // The numpad is a window key too
    expect(
      globalRefusalOf("Numpad1", "linux", { "advance:bow": "Numpad1" }),
    ).toBe("window");
  });
});
