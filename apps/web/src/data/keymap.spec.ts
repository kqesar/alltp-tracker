import { describe, expect, it } from "vitest";
import { defaultItemGrid } from "@/data/items";
import {
  ACTIONS,
  actionFor,
  bind,
  CONTROLS,
  chordOf,
  controlName,
  controlTitle,
  DEFAULT_KEYMAP,
  DEFAULT_SHORTCUTS,
  dungeonControls,
  dungeonOf,
  ITEM_CONTROLS,
  isBindable,
  isKeyControl,
  isMapCompassControl,
  parseAction,
  parseChord,
  refusalOf,
  restoreShortcuts,
  unbind,
} from "@/data/keymap";

/** A keydown with no modifier held unless given. */
const press = (code: string, held: Partial<KeyboardEvent> = {}) => ({
  altKey: false,
  code,
  ctrlKey: false,
  key: code.replace(/^Key/, "").toLowerCase(),
  metaKey: false,
  shiftKey: false,
  ...held,
});

describe("the controls", () => {
  it("lists every grid item once, in reading order, then the retro shops", () => {
    expect(ITEM_CONTROLS).toHaveLength(31);
    expect(ITEM_CONTROLS.slice(-2)).toEqual(["shoparrow", "shopkey"]);
    expect(ITEM_CONTROLS.slice(0, 8)).toEqual([
      "flute",
      "hookshot",
      "hammer",
      "firerod",
      "icerod",
      "boomerang",
      "net",
      "bow",
    ]);
    expect(new Set(ITEM_CONTROLS).size).toBe(ITEM_CONTROLS.length);
  });

  it("gives every dungeon its boss, chests, reward, keys, map and compass, and a medallion to Mire and Turtle Rock", () => {
    // Eastern Palace has no small key in v31
    expect(dungeonControls(0)).toEqual([
      "boss0",
      "chest0",
      "reward0",
      "bigkey0",
      "map0",
      "compass0",
    ]);
    expect(dungeonControls(1)).toContain("smallkey1");
    expect(dungeonControls(8)).toEqual([
      "boss8",
      "medallion8",
      "chest8",
      "reward8",
      "bigkey8",
      "smallkey8",
      "map8",
      "compass8",
    ]);
    // The castles' key cells hold what their pools do
    expect(dungeonControls(10)).toEqual(["smallkey10", "map10"]);
    expect(dungeonControls(11)).toEqual(["smallkey11"]);
    expect(dungeonControls(12)).toEqual([
      "agahnim2",
      "chest12",
      "bigkey12",
      "smallkey12",
      "map12",
      "compass12",
    ]);
    expect(CONTROLS).toHaveLength(31 + 10 * 7 - 1 + 2 + 2 + 1 + 6);
    expect(ACTIONS).toHaveLength(CONTROLS.length * 2);
  });

  it("tells the key cell's controls, and those it shows in keysanity only", () => {
    expect(
      ["bigkey3", "smallkey3", "map3", "compass3", "chest3"].map(isKeyControl),
    ).toEqual([true, true, true, true, false]);
    expect(
      ["bigkey3", "smallkey3", "map3", "compass3"].map(isMapCompassControl),
    ).toEqual([false, false, true, true]);
    expect(controlTitle("map3")).toBe("Palace of Darkness map");
    expect(controlTitle("compass9")).toBe("Turtle Rock compass");
    expect(dungeonOf("compass9")).toBe(9);
  });

  it("names a control within its dungeon and on its own", () => {
    expect(controlName("hookshot")).toBe("Hookshot");
    expect(controlName("chest3")).toBe("Chests");
    expect(controlName("boss3")).toBe("Boss");
    expect(controlTitle("moonpearl")).toBe("Moon Pearl");
    expect(controlTitle("chest3")).toBe("Palace of Darkness chests");
    expect(controlTitle("smallkey9")).toBe("Turtle Rock small keys");
    expect(dungeonOf("medallion8")).toBe(8);
    expect(dungeonOf("bow")).toBeNull();
  });

  it("splits an action into its control and direction", () => {
    expect(parseAction("back:chest3")).toEqual({
      control: "chest3",
      direction: "back",
    });
  });
});

describe("the default keymap", () => {
  it("lays the grid's item block on the letter keys like two newspaper columns", () => {
    const keyOf = (item: string) => DEFAULT_KEYMAP[`advance:${item}`];
    const keyRows = [
      ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT"],
      ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG"],
      ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB"],
      ["KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
      ["KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon"],
    ];

    expect(
      defaultItemGrid.slice(0, 5).map((row) => row.slice(0, 5).map(keyOf)),
    ).toEqual(keyRows);
    expect(["boomerang", "net", "agahnim", "boots"].map(keyOf)).toEqual([
      "KeyN",
      "KeyM",
      "Comma",
      "Period",
    ]);
  });

  it("puts each dungeon's chests on its number, Turtle Rock on 0", () => {
    expect(DEFAULT_KEYMAP["advance:chest0"]).toBe("Digit1");
    expect(DEFAULT_KEYMAP["advance:chest8"]).toBe("Digit9");
    expect(DEFAULT_KEYMAP["advance:chest9"]).toBe("Digit0");
  });

  it("steps back with Shift and the same key", () => {
    expect(DEFAULT_KEYMAP["back:hookshot"]).toBe("Shift+KeyW");
    expect(DEFAULT_KEYMAP["back:chest0"]).toBe("Shift+Digit1");
  });

  it("binds known actions only, each to a usable chord no other action has", () => {
    const entries = Object.entries(DEFAULT_KEYMAP);

    expect(entries).toHaveLength(2 * (29 + 10));
    for (const [action, chord] of entries) {
      expect(ACTIONS).toContain(action);
      expect(isBindable(chord as string)).toBe(true);
    }
    expect(new Set(entries.map(([, chord]) => chord)).size).toBe(
      entries.length,
    );
  });

  it("is switched on", () => {
    expect(DEFAULT_SHORTCUTS).toEqual({
      enabled: true,
      keymap: DEFAULT_KEYMAP,
    });
  });
});

describe("chordOf", () => {
  it("names the physical key, with its modifiers in a fixed order", () => {
    expect(chordOf(press("KeyQ"))).toBe("KeyQ");
    expect(
      chordOf(press("KeyQ", { altKey: true, metaKey: true, shiftKey: true })),
    ).toBe("Alt+Shift+Meta+KeyQ");
    expect(chordOf(press("Digit1", { ctrlKey: true }))).toBe("Control+Digit1");
  });

  it("waits for the key a modifier modifies", () => {
    expect(
      chordOf(press("ShiftLeft", { key: "Shift", shiftKey: true })),
    ).toBeNull();
    expect(
      chordOf(press("AltRight", { altKey: true, key: "AltGraph" })),
    ).toBeNull();
  });

  it("has nothing for an event that names no key", () => {
    expect(chordOf(press("", { key: "Unidentified" }))).toBeNull();
  });
});

describe("parseChord", () => {
  it("reads a canonical chord", () => {
    expect(parseChord("Alt+Shift+KeyQ")).toEqual({
      code: "KeyQ",
      modifiers: ["Alt", "Shift"],
    });
  });

  it.each([
    "Shift+Alt+KeyQ",
    "Shift+Shift+KeyQ",
    "Hyper+KeyQ",
    "Shift+",
    "",
    "Key Q",
  ])("refuses %j", (chord) => {
    expect(parseChord(chord)).toBeNull();
  });
});

describe("refusalOf", () => {
  it.each([
    "KeyQ",
    "Shift+KeyQ",
    "Alt+KeyK",
    "Alt+Shift+KeyK",
    "Digit5",
    "Numpad5",
    "NumpadAdd",
    "Semicolon",
    "Slash",
    "F13",
  ])("takes %s", (chord) => {
    expect(refusalOf(chord)).toBeNull();
  });

  it.each([
    "Control+KeyR",
    "Meta+KeyR",
    "Control+Shift+KeyZ",
    "Alt+KeyD",
    "Alt+KeyF",
    "Alt+Digit1",
    "Alt+Shift+KeyT",
  ])("leaves %s to the browser or the system", (chord) => {
    expect(refusalOf(chord)).toBe("browser");
  });

  it.each([
    "Tab",
    "Shift+Tab",
    "Enter",
    "Space",
    "Escape",
    "ArrowUp",
    "Home",
    "Backspace",
    "F5",
    "F12",
    "Minus",
    "NumpadEnter",
    "Shift+Alt+KeyQ",
  ])("keeps %s for its own job", (chord) => {
    expect(refusalOf(chord)).toBe("key");
  });
});

describe("binding", () => {
  const keymap = {
    "advance:hookshot": "KeyW",
    "advance:mirror": "KeyK",
  } as const;

  it("finds the action a chord is bound to", () => {
    expect(actionFor(keymap, "KeyK")).toBe("advance:mirror");
    expect(actionFor(keymap, "Shift+KeyK")).toBeUndefined();
  });

  it("binds a free chord and leaves the rest alone", () => {
    expect(bind(keymap, "back:hookshot", "Shift+KeyW")).toEqual({
      ...keymap,
      "back:hookshot": "Shift+KeyW",
    });
  });

  it("takes a chord from its holder on replace", () => {
    expect(bind(keymap, "advance:hookshot", "KeyK", "replace")).toEqual({
      "advance:hookshot": "KeyK",
    });
  });

  it("gives the holder the rebound action's old chord on swap", () => {
    expect(bind(keymap, "advance:hookshot", "KeyK", "swap")).toEqual({
      "advance:hookshot": "KeyK",
      "advance:mirror": "KeyW",
    });
  });

  it("swaps into nothing when the rebound action had no chord", () => {
    expect(bind(keymap, "advance:bow", "KeyK", "swap")).toEqual({
      "advance:bow": "KeyK",
      "advance:hookshot": "KeyW",
    });
  });

  it("keeps a chord on the action that already has it", () => {
    expect(bind(keymap, "advance:mirror", "KeyK", "replace")).toEqual(keymap);
  });

  it("clears one binding", () => {
    expect(unbind(keymap, "advance:mirror")).toEqual({
      "advance:hookshot": "KeyW",
    });
  });
});

describe("restoreShortcuts", () => {
  const base = { enabled: true, keymap: { "advance:bow": "KeyA" } };

  it("keeps a valid save as it is", () => {
    const saved = {
      enabled: false,
      keymap: { "advance:hookshot": "KeyK", "back:chest3": "Alt+Digit4" },
    };

    expect(restoreShortcuts(saved, base)).toEqual(saved);
  });

  it("keeps an emptied keymap: every shortcut removed", () => {
    expect(restoreShortcuts({ enabled: true, keymap: {} }, base)).toEqual({
      enabled: true,
      keymap: {},
    });
  });

  it("drops unknown actions, malformed chords and a chord bound twice", () => {
    const restored = restoreShortcuts(
      {
        enabled: true,
        keymap: {
          "advance:flute": "KeyQ",
          "advance:hookshot": "KeyQ",
          "advance:ocarina": "KeyO",
          "advance:sword": 4,
          "back:sword": "Shift+Shift+KeyF",
        },
      },
      base,
    );

    expect(restored.keymap).toEqual({ "advance:flute": "KeyQ" });
  });

  it("keeps a chord the browser cannot use, for the desktop app", () => {
    const saved = { enabled: true, keymap: { "advance:bow": "Control+KeyB" } };

    expect(restoreShortcuts(saved, base)).toEqual(saved);
  });

  it.each([
    ["nothing", undefined],
    ["an array", []],
    ["a string", "on"],
  ])("falls back on the base for %s", (_, saved) => {
    expect(restoreShortcuts(saved, base)).toBe(base);
  });

  it("falls back field by field", () => {
    expect(restoreShortcuts({ enabled: "yes", keymap: [] }, base)).toEqual(
      base,
    );
  });
});
