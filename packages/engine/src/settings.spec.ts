import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";
import { parse } from "./parser";
import { print } from "./printer";
import { DefinitionError, loadRules } from "./rules";
import { foldSettings, type Settings } from "./settings";
import { solve } from "./solve";
import { type CompileOptions, compileWorld, type World } from "./world";

const SETTINGS: Settings = {
  crystalsTower: 7,
  minSword: 2,
  open: true,
  swordless: false,
};

const fold = (source: string, settings: Settings = SETTINGS) =>
  print(foldSettings(parse(source), settings, "Requirement"));

function definitionError(run: () => unknown): DefinitionError {
  try {
    run();
  } catch (error) {
    if (error instanceof DefinitionError) return error;
    throw error;
  }
  throw new Error("expected a DefinitionError");
}

describe("foldSettings", () => {
  it.each<[string, string]>([
    ["setting(open)", "true"],
    ["!setting(open)", "false"],
    ["setting(swordless)", "false"],
    ["!setting(swordless)", "true"],
    ["sword >= setting(minSword)", "sword >= 2"],
    ["count(crystal) >= setting(crystalsTower)", "count(crystal) >= 7"],
    // Constants left by the fold are simplified away.
    ["setting(swordless) | hammer", "hammer"],
    ["setting(open) | hammer", "true"],
    ["setting(swordless) & hammer | sword", "sword"],
    ["!setting(swordless) & sword >= setting(minSword)", "sword >= 2"],
    ["a & (setting(open) | b) & c", "a & c"],
    ["setting(swordless) & a | setting(swordless) & b", "false"],
    ["?setting(swordless)", "maybe"],
    ["?!setting(swordless)", "true"],
    ["setting(swordless) & ?lantern", "false"],
    ["setting(open) & maybe", "maybe"],
  ])("folds %j to %j", (source, expected) => {
    expect(fold(source)).toBe(expected);
  });

  it("keeps the parser's flat shape when a branch collapses", () => {
    // (false | b & c) is b & c, which then joins the outer and.
    const folded = foldSettings(
      parse("a & (setting(swordless) | b & c)"),
      SETTINGS,
      "Requirement",
    );
    expect(folded).toEqual(parse("a & b & c"));
  });

  it("returns a requirement without settings as it is", () => {
    const expr = parse("a & (b | ?c) & count(crystal) >= 3");
    expect(foldSettings(expr, {}, "Requirement")).toBe(expr);
  });

  it.each<[string, Settings, string]>([
    ["setting(typo)", SETTINGS, 'Requirement uses unknown setting "typo"'],
    ["sword >= setting(typo)", {}, 'Requirement uses unknown setting "typo"'],
    // A branch the fold drops is checked as well.
    [
      "setting(open) | setting(typo)",
      SETTINGS,
      'Requirement uses unknown setting "typo"',
    ],
    [
      "setting(minSword)",
      SETTINGS,
      'Requirement uses setting "minSword" as a condition, but it is 2, not a boolean',
    ],
    [
      "sword >= setting(open)",
      SETTINGS,
      'Requirement compares with setting "open", but it is true, not a non-negative integer',
    ],
    [
      "sword >= setting(n)",
      { n: 1.5 },
      'Requirement compares with setting "n", but it is 1.5, not a non-negative integer',
    ],
    [
      "count(a) >= setting(n)",
      { n: -1 },
      'Requirement compares with setting "n", but it is -1, not a non-negative integer',
    ],
    // Inherited members of Object.prototype are not settings.
    ["setting(constructor)", {}, 'unknown setting "constructor"'],
  ])("rejects %j with %j", (source, settings, message) => {
    expect(definitionError(() => fold(source, settings)).message).toContain(
      message,
    );
  });
});

describe("evaluate with settings", () => {
  it("reads settings as it meets them", () => {
    const check = (source: string, state = {}) =>
      evaluate(parse(source), state, undefined, { settings: SETTINGS });
    expect(check("setting(open)")).toBe("yes");
    expect(check("!setting(open)")).toBe("no");
    expect(check("sword >= setting(minSword)", { sword: 1 })).toBe("no");
    expect(check("sword >= setting(minSword)", { sword: 2 })).toBe("yes");
    expect(() => evaluate(parse("setting(open)"), {})).toThrow(
      'Requirement uses unknown setting "open"',
    );
  });
});

describe("compileWorld with settings", () => {
  const rules = loadRules({
    groups: { crystal: ["c1", "c2", "c3"] },
    helpers: {
      canBeatAgahnim:
        "setting(swordless) & hammer | !setting(swordless) & sword >= setting(minSword)",
    },
  });
  const world: World = {
    regions: [
      {
        exits: [{ req: "@canBeatAgahnim", to: "pyramid" }],
        id: "castle",
        locations: [
          { id: "tower", req: "count(crystal) >= setting(crystalsTower)" },
        ],
      },
      { id: "pyramid", locations: [{ id: "fatFairy" }] },
    ],
    start: "castle",
  };
  const compile = (settings: Settings) =>
    compileWorld(world, rules, { settings });

  it("folds helpers and requirements with the run's settings", () => {
    const swordless = compile({
      crystalsTower: 2,
      minSword: 2,
      swordless: true,
    });
    const standard = compile({
      crystalsTower: 3,
      minSword: 2,
      swordless: false,
    });

    expect(solve(swordless, { hammer: true }).region("pyramid")).toBe("yes");
    expect(solve(swordless, { sword: 4 }).region("pyramid")).toBe("no");
    expect(solve(standard, { hammer: true }).region("pyramid")).toBe("no");
    expect(solve(standard, { sword: 1 }).region("pyramid")).toBe("no");
    expect(solve(standard, { sword: 2 }).region("pyramid")).toBe("yes");

    const twoCrystals = { c1: true, c2: true };
    expect(solve(swordless, twoCrystals).location("tower")).toBe("yes");
    expect(solve(standard, twoCrystals).location("tower")).toBe("no");
  });

  it.each<[string, World, CompileOptions, string]>([
    [
      "a location",
      {
        regions: [{ id: "r", locations: [{ id: "l", req: "setting(open)" }] }],
        start: "r",
      },
      {},
      'Location "l" uses unknown setting "open"',
    ],
    [
      "an exit",
      {
        regions: [
          { exits: [{ req: "a >= setting(n)", to: "s" }], id: "r" },
          { id: "s" },
        ],
        start: "r",
      },
      { settings: { n: true } },
      'Exit "r" -> "s" compares with setting "n", but it is true, not a non-negative integer',
    ],
  ])(
    "names %s that uses a missing or mistyped setting",
    (_, w, options, message) => {
      expect(
        definitionError(() => compileWorld(w, undefined, options)).message,
      ).toBe(message);
    },
  );

  it("checks every helper, used or not, and names it", () => {
    expect(
      definitionError(() => compile({ crystalsTower: 7, swordless: false }))
        .message,
    ).toBe('Helper "@canBeatAgahnim" uses unknown setting "minSword"');
  });

  it("checks item names in branches a setting switches off", () => {
    const typo: World = {
      regions: [
        {
          id: "r",
          locations: [{ id: "l", req: "setting(swordless) & hamer | sword" }],
        },
      ],
      start: "r",
    };
    expect(
      definitionError(() =>
        compileWorld(typo, undefined, {
          items: ["hammer", "sword"],
          settings: { swordless: false },
        }),
      ).message,
    ).toBe('Location "l" uses unknown item "hamer"');
  });
});
