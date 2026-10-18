import { describe, expect, it } from "vitest";
import { MEDALLION_VALUES } from "@/constants";
import { CONTROLS } from "@/data/keymap";
import {
  COMMANDS,
  changedValue,
  commandsOf,
  GRAMMAR,
  type VoiceAction,
  WAKE_WORD,
} from "@/logic/voice";

const set = (control: string, change: object): VoiceAction =>
  ({ change, control, kind: "set" }) as VoiceAction;

describe("the voice commands", () => {
  it("reach every control a shortcut can step", () => {
    const reached = new Set(
      [...COMMANDS.values()].flatMap((action) =>
        action.kind === "set" ? [action.control] : [],
      ),
    );
    expect(CONTROLS.filter((control) => !reached.has(control))).toEqual([]);
  });

  it("name nothing a shortcut cannot step", () => {
    const known = new Set(CONTROLS);
    const unknown = [...COMMANDS.values()].flatMap((action) =>
      action.kind === "set" && !known.has(action.control)
        ? [action.control]
        : [],
    );
    expect(unknown).toEqual([]);
  });

  it.each([
    ["hook shot", set("hookshot", { to: "on" })],
    ["master sword", set("sword", { atLeast: 2 })],
    ["silvers", set("bow", { bit: 1 })],
    ["bow", set("bow", { bit: 2 })],
    ["bom boss", set("bombos", { to: "on" })],
    ["samaria", set("somaria", { to: "on" })],
    ["eastern boss", set("boss0", { to: "on" })],
    ["pod chest", set("chest3", { to: "less" })],
    ["castle tower boss", set("agahnim", { to: "on" })],
    ["a gannon", set("agahnim", { to: "on" })],
    ["aga two", set("agahnim2", { to: "on" })],
    ["burner", set("byrna", { to: "on" })],
    ["g t boss", set("agahnim2", { to: "on" })],
    ["g t big key", set("bigkey12", { to: "on" })],
    ["high rule castle key", set("smallkey10", { to: "next" })],
    ["mire ether", set("medallion8", { exactly: MEDALLION_VALUES.ETHER })],
    ["turtle rock quake", set("medallion9", { exactly: 3 })],
    ["eastern green pendant", set("reward0", { exactly: 1 })],
    ["thieves crystal", set("reward6", { exactly: 3 })],
    ["skull red crystal", set("reward5", { exactly: 4 })],
    ["undo", { kind: "undo" }],
    ["start timer", { kind: "startTimer" }],
    ["pause", { kind: "pauseTimer" }],
  ])("hear %s", (phrase, action) => {
    expect(COMMANDS.get(phrase)).toEqual(action);
  });

  it.each([
    // Eastern Palace has no small key; Hyrule Castle no boss, prize or chest
    "eastern key",
    "escape boss",
    "escape crystal",
    "escape chest",
    // Only Misery Mire and Turtle Rock have a medallion
    "eastern ether",
  ])("have no %s", (phrase) => {
    expect(COMMANDS.has(phrase)).toBe(false);
  });
});

describe("GRAMMAR", () => {
  it("is each command after the wake word, then anything else", () => {
    expect(GRAMMAR).toContain(`${WAKE_WORD} hook shot`);
    expect(GRAMMAR.at(-1)).toBe("[unk]");
    expect(GRAMMAR).toHaveLength(COMMANDS.size + 1);
    expect(new Set(GRAMMAR).size).toBe(GRAMMAR.length);
  });

  it("speaks only in lower-case words the dictionary can hold", () => {
    const words = new Set(GRAMMAR.slice(0, -1).flatMap((p) => p.split(" ")));
    expect([...words].filter((word) => !/^[a-z]+$/.test(word))).toEqual([]);
  });
});

describe("commandsOf", () => {
  it("hears a command after the wake word, and nothing without it", () => {
    expect(commandsOf("tracker hook shot")).toEqual([
      set("hookshot", { to: "on" }),
    ]);
    // Talking about it marks nothing
    expect(commandsOf("i need the hook shot")).toEqual([]);
    expect(commandsOf("tracker")).toEqual([]);
    expect(commandsOf("tracker banana")).toEqual([]);
  });

  it("hears every command of one result, in order, around the unknown", () => {
    expect(commandsOf("[unk] tracker hammer [unk] tracker  undo")).toEqual([
      set("hammer", { to: "on" }),
      { kind: "undo" },
    ]);
  });

  it("drops a command cut short", () => {
    expect(commandsOf("tracker master")).toEqual([]);
    expect(commandsOf("tracker eastern")).toEqual([]);
  });
});

describe("changedValue", () => {
  it("holds a toggle, whatever it was", () => {
    expect(changedValue({ to: "on" }, false, 0, 1)).toBe(true);
    expect(changedValue({ to: "on" }, true, 0, 1)).toBe(true);
  });

  it("beats a boss, takes a dungeon item, to the top of its range", () => {
    expect(changedValue({ to: "on" }, 1, 1, 2)).toBe(2);
    expect(changedValue({ to: "on" }, 0, 0, 1)).toBe(1);
  });

  it("goes one level up, never past the top nor round to none", () => {
    expect(changedValue({ to: "next" }, 1, 0, 4)).toBe(2);
    expect(changedValue({ to: "next" }, 4, 0, 4)).toBe(4);
  });

  it("takes one item from a dungeon's count, never below none", () => {
    expect(changedValue({ to: "less" }, 3, 0, 3)).toBe(2);
    expect(changedValue({ to: "less" }, 0, 0, 3)).toBe(0);
  });

  it("adds a bit, keeping the other", () => {
    expect(changedValue({ bit: 2 }, 0, 0, 3)).toBe(2);
    expect(changedValue({ bit: 1 }, 2, 0, 3)).toBe(3);
    expect(changedValue({ bit: 2 }, 3, 0, 3)).toBe(3);
  });

  it("names a level without lowering the one held", () => {
    expect(changedValue({ atLeast: 2 }, 1, 0, 4)).toBe(2);
    expect(changedValue({ atLeast: 2 }, 3, 0, 4)).toBe(3);
  });

  it("picks a medallion or a prize as said", () => {
    expect(changedValue({ exactly: 1 }, 3, 0, 4)).toBe(1);
  });
});
