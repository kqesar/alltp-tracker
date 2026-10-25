import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  arrange,
  buildCase,
  fixtureCase,
  formatFixture,
  importAll,
  parseChain,
  readClass,
  readCommit,
  readDeclarations,
  readItemTypes,
  readRegionFile,
  resolveFixture,
  skippable,
  stripComments,
} from "../scripts/import-upstream-tests.mjs";

const DECLARATIONS = `
  public abstract class LogicCases {
    [Region("Crateria West")]
    protected abstract List<Case> CrateriaWest { get; }
    [Location("Missile (Crateria gauntlet right)")]
    [Location("Missile (Crateria gauntlet left)")]
    protected abstract List<Case> MissileCrateriaGauntlet { get; }
    [Location("Desert Ledge")]
    protected abstract List<Case> DesertLedge { get; }
    [Region("Desert Palace")]
    protected abstract List<Case> DesertPalace { get; }
  }`;

const BASE = `
  public class SMNormal : LogicCases {
    protected override List<Case> CrateriaWest => new() {
      CaseWith(x => x.Morph.Bombs), // a comment
      CaseWith(x => x.ScrewAttack),
    };
    protected override List<Case> MissileCrateriaGauntlet => Shared;
    List<Case> Shared => CaseWithNothing;
    protected override List<Case> DesertLedge => DesertPalace;
    protected override List<Case> DesertPalace => new() {
      CaseWith(x => x.Book),
    };
  }`;

const DERIVED = `
  public class SMHard : SMNormal {
    /* Hard reaches the desert with a mirror */
    protected override List<Case> DesertPalace => new() {
      CaseWith(x => x.Mirror),
    };
  }`;

describe("reading C#", () => {
  it("drops comments and keeps strings", () => {
    expect(stripComments('a // x\n"b // c" /* d */ e')).toBe('a \n"b // c"  e');
    expect(() => stripComments('"open')).toThrow(/Unterminated string/);
    expect(() => stripComments("/* open")).toThrow(/Unterminated comment/);
  });

  it("reads which regions and locations each property is for", () => {
    const declarations = readDeclarations(DECLARATIONS);
    expect(declarations.get("MissileCrateriaGauntlet")).toEqual([
      { kind: "location", name: "Missile (Crateria gauntlet right)" },
      { kind: "location", name: "Missile (Crateria gauntlet left)" },
    ]);
    expect(() => readDeclarations("class X {}")).toThrow(/No declaration/);
  });

  it("reads a fixture class's cases, nothing-cases and aliases", () => {
    const fixture = readClass(BASE);
    expect(fixture.base).toBe("LogicCases");
    expect(fixture.properties.get("CrateriaWest")?.cases).toEqual([
      ".Morph.Bombs",
      ".ScrewAttack",
    ]);
    expect(fixture.properties.get("Shared")).toEqual({
      cases: [""],
      private: true,
    });
    expect(fixture.properties.get("DesertLedge")).toEqual({
      alias: "DesertPalace",
      private: false,
    });
    expect(() => readClass("class X {}")).toThrow(/No fixture class/);
    expect(() =>
      readClass("public class A : B { List<Case> P => x.y; }"),
    ).toThrow(/Unexpected body for P/);
    expect(() =>
      readClass("public class A : B { List<Case> P => new() { Other(), }; }"),
    ).toThrow(/Unexpected case in P/);
  });
});

describe("a case, as Case.cs builds it", () => {
  it("parses a chain into the builder's words", () => {
    expect(
      parseChain(
        '.Has.KeyPD.HasAt("Ganon\'s Tower - Map Chest").BigKeyGT.ETank(2)',
      ),
    ).toEqual([
      { name: "Has" },
      { name: "KeyPD" },
      { at: "Ganon's Tower - Map Chest", name: "HasAt" },
      { name: "BigKeyGT" },
      { count: 2, name: "ETank" },
    ]);
    expect(() => parseChain(".Morph +")).toThrow(/Unexpected chain/);
  });

  it("places, assumes and skips together as the builder does", () => {
    const list = buildCase(
      parseChain(
        ".Has.KeyPD.Assume.Lamp.IfSkipping.Hammer.Bow.AlsoSkip.KeyPD(2).KeyPD(4)",
      ),
    );
    expect(list).toEqual([
      { at: null, name: "KeyPD", type: "place" },
      { assumed: true, count: 1, name: "Lamp", type: "item" },
      expect.objectContaining({
        alsoSkip: expect.objectContaining({ count: 2 }),
        name: "Hammer",
      }),
      expect.objectContaining({
        alsoSkip: expect.objectContaining({ count: 2 }),
        name: "Bow",
      }),
      { assumed: false, count: 4, name: "KeyPD", type: "item" },
    ]);
    // The assumed lamp is never skipped
    expect(skippable(list)).toEqual([0, 2, 3, 4]);
    const hammerless = arrange(list, "Here", 2);
    expect(hammerless.items.get("Hammer")).toBe(0);
    expect(hammerless.items.get("KeyPD")).toBe(2);
    expect(arrange(list, "Here", 0).placed.size).toBe(0);
  });

  it("counts the progressive items' levels as the builder names them", () => {
    expect(fixtureCase(".Mitt.MasterSword.TwoPowerBombs", "Here")).toEqual({
      items: { PowerBomb: 2, ProgressiveGlove: 2, ProgressiveSword: 2 },
      without: [
        { items: { ProgressiveGlove: 1 } },
        { items: { ProgressiveSword: 1 } },
        { items: { PowerBomb: 1 } },
      ],
    });
    expect(fixtureCase('.HasAt("There").KeyTT', "Here")).toEqual({
      items: {},
      placed: { There: "KeyTT" },
      without: [{ unplace: "There" }],
    });
  });
});

describe("a fixture's cases", () => {
  const classes = new Map([
    ["SMNormal", readClass(BASE)],
    ["SMHard", readClass(DERIVED)],
  ]);
  const declarations = readDeclarations(DECLARATIONS);

  it("take each property from the most derived class, aliases dispatched virtually", () => {
    const hard = resolveFixture("SMHard", classes, declarations);
    expect(hard).toContainEqual({
      items: { Mirror: 1 },
      location: "Desert Ledge",
      without: [{ items: { Mirror: 0 } }],
    });
    // A helper list stays its declaring class's
    expect(hard).toContainEqual({
      items: {},
      location: "Missile (Crateria gauntlet left)",
      without: [],
    });
    expect(resolveFixture("SMNormal", classes, declarations)).toContainEqual({
      items: { Book: 1 },
      location: "Desert Ledge",
      without: [{ items: { Book: 0 } }],
    });
  });

  it("refuse a missing class, property or alias cycle", () => {
    expect(() => resolveFixture("SMOther", classes, declarations)).toThrow(
      /No class SMOther/,
    );
    const cyclic = new Map([
      [
        "SMNormal",
        readClass(
          "public class SMNormal : LogicCases { protected override List<Case> CrateriaWest => CrateriaWest; }",
        ),
      ],
    ]);
    expect(() => resolveFixture("SMNormal", cyclic, declarations)).toThrow(
      /Alias cycle/,
    );
    expect(() =>
      resolveFixture(
        "SMNormal",
        cyclic,
        readDeclarations(DECLARATIONS.replace("CrateriaWest {", "Unknown {")),
      ),
    ).toThrow(/has no/);
  });
});

describe("a region file", () => {
  it("gives its region, CanEnter's line and each location's", () => {
    const source = [
      "class West : SMRegion {",
      '  public override string Name => "Crateria West";',
      '  new Location(this, 8, 0x8F8432, LocationType.Visible, "Energy Tank, Terminator"),',
      "  public override bool CanEnter(Progression items) {",
    ].join("\n");
    expect(readRegionFile(source, "F.cs")).toEqual({
      canEnter: 4,
      file: "F.cs",
      locations: [{ id: 8, line: 3, name: "Energy Tank, Terminator" }],
      name: "Crateria West",
    });
    expect(
      readRegionFile(source.replace(/.*CanEnter.*/, ""), "F.cs").canEnter,
    ).toBeUndefined();
    expect(() => readRegionFile("class X {}", "F.cs")).toThrow(
      /No region name/,
    );
    // Zelda's ids are written 256+n
    expect(
      readRegionFile(source.replace("this, 8,", "this, 256+117,"), "F.cs")
        .locations[0]?.id,
    ).toBe(373);
    expect(() =>
      readRegionFile(source.replace("this, 8,", "this, n,"), "F.cs"),
    ).toThrow(/Unread location id n in F.cs/);
  });
});

describe("importing a checkout", () => {
  let dir = "";
  afterEach(() => rmSync(dir, { force: true, recursive: true }));

  const checkout = (head: string) => {
    dir = mkdtempSync(join(tmpdir(), "smz3-"));
    const logic = join(dir, "Randomizer.SMZ3.Tests/Logic");
    mkdirSync(logic, { recursive: true });
    writeFileSync(join(logic, "LogicCases.cs"), DECLARATIONS);
    writeFileSync(join(logic, "SMNormal.cs"), BASE);
    writeFileSync(join(logic, "SMHard.cs"), DERIVED);
    for (const name of ["SMNormalKeysanity", "SMHardKeysanity"]) {
      writeFileSync(
        join(logic, `${name}.cs`),
        DERIVED.replace("SMHard : SMNormal", `${name} : SMNormal`),
      );
    }
    const regions = join(dir, "Randomizer.SMZ3/Regions/SuperMetroid");
    mkdirSync(regions, { recursive: true });
    writeFileSync(
      join(regions, "West.cs"),
      'public override string Name => "Crateria West";',
    );
    writeFileSync(join(dir, "LICENSE"), "MIT");
    mkdirSync(join(dir, ".git/refs/heads"), { recursive: true });
    writeFileSync(join(dir, ".git/HEAD"), head);
    writeFileSync(
      join(dir, ".git/refs/heads/production"),
      `${"d".repeat(40)}\n`,
    );
    return dir;
  };

  it("writes the four fixtures, the regions and the licence", () => {
    const root = checkout("ref: refs/heads/production\n");
    const out = join(root, "out");
    expect(importAll(root, out)).toEqual({
      SMHard: 6,
      SMHardKeysanity: 6,
      SMNormal: 6,
      SMNormalKeysanity: 6,
    });
    const normal = JSON.parse(readFileSync(join(out, "SMNormal.json"), "utf8"));
    expect(normal.header).toMatchObject({
      commit: "d".repeat(40),
      keysanity: false,
      logic: "normal",
    });
    expect(normal.header.always).toHaveLength(16);
    const keysanity = JSON.parse(
      readFileSync(join(out, "SMNormalKeysanity.json"), "utf8"),
    );
    expect(keysanity.header.always).toBeUndefined();
    expect(
      JSON.parse(readFileSync(join(out, "regions.json"), "utf8")).regions,
    ).toEqual([
      {
        file: "Randomizer.SMZ3/Regions/SuperMetroid/West.cs",
        locations: [],
        name: "Crateria West",
      },
    ]);
    expect(readFileSync(join(out, "LICENSE"), "utf8")).toBe("MIT");
  });

  it("reads a detached checkout's commit, and a worktree's", () => {
    const root = checkout(`${"a".repeat(40)}\n`);
    expect(readCommit(root)).toBe("a".repeat(40));
    const worktree = join(root, "worktree");
    mkdirSync(worktree);
    writeFileSync(join(worktree, ".git"), `gitdir: ${join(root, ".git")}\n`);
    expect(readCommit(worktree)).toBe("a".repeat(40));
  });

  it("formats one case per line", () => {
    expect(formatFixture({ a: 1 }, [{ b: 2 }, { c: 3 }])).toBe(
      '{\n  "header": {"a":1},\n  "cases": [\n    {"b":2},\n    {"c":3}\n  ]\n}\n',
    );
  });
});

describe("Item.cs's item types", () => {
  const ITEM_CS = `
    public enum ItemType : byte {
      [Description("Nothing")]
      Nothing,

      /* a comment, [Description("Ghost")] Ghost, */
      [Description("Hyrule Castle Map")]
      MapHC = 0x7F,
      [Description("Progressive Sword")] ProgressiveSword = 0x5E,
      [Description("Twenty Rupees")]
      TwentyRupees = 0x36,
      [Description("Twenty Rupees")]
      TwentyRupees2 = 0x47,
    }
    class Item { [Description("Not an item")] int X; }`;

  it("reads each description and its type, the first of two alike", () => {
    expect(readItemTypes(ITEM_CS)).toEqual({
      "Hyrule Castle Map": "MapHC",
      Nothing: "Nothing",
      "Progressive Sword": "ProgressiveSword",
      "Twenty Rupees": "TwentyRupees",
    });
  });

  it("stops on a file that has no enum", () => {
    expect(() => readItemTypes("class Item {}")).toThrow("No ItemType enum");
    expect(() => readItemTypes("enum ItemType { A }")).toThrow("empty");
  });
});
