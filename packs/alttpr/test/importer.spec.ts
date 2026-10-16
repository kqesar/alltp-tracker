import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  dataProviderOf,
  formatFixture,
  importAll,
  importItems,
  importTestFile,
  matchAll,
  parseClass,
  parseLiteral,
  plain,
  readCommit,
  readLogic,
  tokenize,
} from "../scripts/import-upstream-tests.mjs";

const php = (source: string) => tokenize(`<?php ${source}`);
const literal = (source: string) => plain(parseLiteral(php(source), 0).node);
const values = (source: string) => php(source).map((token) => token.value);

const HEADER = {
  commit: "0".repeat(40),
  copyright: "Copyright (c) 2016 sporchia",
  license: "MIT",
  logic: 31,
  repo: "sporchia/alttp_vt_randomizer",
};

describe("tokenize", () => {
  it("reads numbers in every base PHP writes them in", () => {
    expect(values("0xA3 0b101 0o17 017 1_000 .25 1.5 2e3 0")).toEqual([
      0xa3, 5, 15, 15, 1000, 0.25, 1.5, 2000, 0,
    ]);
  });

  it("decodes single- and double-quoted strings as PHP does", () => {
    expect(values(String.raw`'it\'s' 'a\\b' 'c\n' "d\n\"e\$" "f\q"`)).toEqual([
      "it's",
      "a\\b",
      "c\\n",
      'd\n"e$',
      "f\\q",
    ]);
  });

  it("keeps docblocks and drops comments", () => {
    const tokens = php(
      "/** @dataProvider pool */ // line\n# hash\n/* block */ $x #[Attr]",
    );
    expect(tokens.map((token) => token.type)).toEqual([
      "doc",
      "var",
      "punct",
      "ident",
      "punct",
    ]);
  });

  it("counts lines across comments and strings", () => {
    const tokens = php("/*\n\n*/ 'a\nb'\n$c");
    expect(tokens.map((token) => token.line)).toEqual([3, 5]);
  });

  it("marks interpolated strings so no literal accepts them", () => {
    const tokens = php(`"a $b" "{$c["d"]}" "e"`);
    expect(tokens.map((token) => token.type)).toEqual([
      "interpolated",
      "interpolated",
      "string",
    ]);
    expect(() => parseLiteral(tokens, 0)).toThrow(/Expected a literal/);
  });

  it("rejects what it cannot read, with the line", () => {
    expect(() => tokenize("<html>")).toThrow(/start with <\?php/);
    expect(() => php("\n<<<EOT\nx\nEOT;")).toThrow(/Heredoc .* at line 2/);
    expect(() => php("'open")).toThrow(/Unterminated string/);
    expect(() => php("/* open")).toThrow(/Unterminated comment/);
    expect(() => php("`ls`")).toThrow(/Unexpected character "`"/);
    expect(() => php("?>")).toThrow(/inline HTML/);
  });
});

describe("parseLiteral", () => {
  it("reads scalars, lists and keyed arrays", () => {
    expect(literal("[1, -2, 'a', TRUE, False, null, [],]")).toEqual([
      1,
      -2,
      "a",
      true,
      false,
      null,
      [],
    ]);
    expect(literal("array('x' => [1, 2], 3 => array())")).toEqual({
      3: [],
      x: [1, 2],
    });
  });

  it("returns where the literal ends and on which line each row starts", () => {
    const tokens = php("[\n  ['a'],\n  ['b'],\n];");
    const { end, node } = parseLiteral(tokens, 0);
    expect(tokens[end]?.value).toBe(";");
    expect(node.kind === "list" && node.items.map((row) => row.line)).toEqual([
      2, 3,
    ]);
  });

  it("rejects what is not a literal", () => {
    expect(() => literal("FOO")).toThrow(/Expected a literal/);
    expect(() => literal("[Item::get('x')]")).toThrow(
      /Expected a literal at line 1 but found "Item"/,
    );
    expect(() => literal("['a' => 1, 2]")).toThrow(/mixes keyed/);
    expect(() => literal("[[1] => 2]")).toThrow(/string or integer key/);
    expect(() => literal("[1")).toThrow(/Expected "," or "\]"/);
  });
});

describe("parseClass", () => {
  it("reads the namespace, the name and each method", () => {
    const parsed = parseClass(
      php(`namespace A\\B; use C; /** class */ final class T extends TestCase {
        /** @dataProvider pool */
        public function testX(string $a, ?array $b = [], bool $c = null): void { return 1; }
        protected static function pool() { return [[1]]; }
      }`),
    );
    expect(parsed.namespace).toBe("A\\B");
    expect(parsed.name).toBe("T");
    expect(parsed.methods.map((m) => [m.name, m.line])).toEqual([
      ["testX", 3],
      ["pool", 4],
    ]);
    expect(parsed.methods[0]?.params).toEqual([
      { name: "a" },
      { default: [], name: "b" },
      { default: null, name: "c" },
    ]);
    expect(dataProviderOf(parsed.methods[0]?.doc ?? "")).toBe("pool");
    expect(dataProviderOf(parsed.methods[1]?.doc ?? "")).toBeUndefined();
  });

  it("rejects class members it does not know", () => {
    expect(() => parseClass(php("class T { protected $x = 1; }"))).toThrow(
      /Unexpected "x" in the class/,
    );
    expect(() => parseClass(php("$x = 1;"))).toThrow(/before the class/);
    expect(() => parseClass(php("class T { function f() { ( }"))).toThrow(
      /Unbalanced|Unclosed/,
    );
  });
});

describe("matchAll", () => {
  const pattern = php("$this->world->getRegion($__str_region)->x($__items);");

  it("captures placeholders and the item collection", () => {
    expect(
      matchAll(
        pattern,
        php("$this->world->getRegion('R')->x($this->allItems());"),
      ),
    ).toEqual({
      items: { add: [], base: "allItems", except: [] },
      region: "R",
    });
    expect(
      matchAll(
        pattern,
        php("$this->world->getRegion('R')->x($this->allItemsExcept(['A']));"),
      )?.items,
    ).toEqual({ add: [], base: "allItems", except: ["A"] });
    expect(
      matchAll(
        pattern,
        php("$this->world->getRegion('R')->x($this->collected);"),
      )?.items,
    ).toEqual({ add: [], base: "setUp" });
  });

  it("matches the whole body or nothing", () => {
    const body = "$this->world->getRegion('R')->x($this->collected);";
    expect(matchAll(pattern, php(`${body} $extra;`))).toBeUndefined();
    expect(matchAll(pattern, php(body.replace("'R'", "$r")))).toBeUndefined();
    expect(
      matchAll(pattern, php(body.replace("collected", "other"))),
    ).toBeUndefined();
  });
});

const TEST_CLASS = `<?php
namespace NoGlitches;

class SampleTest extends TestCase
{
    public function setUp(): void
    {
        parent::setUp();
        $this->world = World::factory('open', ['difficulty' => 'test_rules', 'region.wildMaps' => true]);
        $this->world->getLocation("Misery Mire Medallion")->setItem(Item::get('Ether', $this->world));
        $this->addCollected(['RescueZelda']);
        $this->collected->setChecksForWorld($this->world->id);
        $this->somethingNew();
    }

    public function tearDown(): void
    {
        parent::tearDown();
        unset($this->world);
    }

    public function testCanEnterWithEverything()
    {
        $this->assertTrue($this->world->getRegion('Tower of Hera')->canEnter($this->world->getLocations(), $this->allItems()));
    }

    /**
     * @dataProvider accessPool
     */
    public function testLocation(string $location, bool $access, array $items, array $except = [])
    {
        if (count($except)) {
            $this->collected = $this->allItemsExcept($except);
        }

        $this->addCollected($items);

        $this->assertEquals($access, $this->world->getLocation($location)
            ->canAccess($this->collected));
    }

    /**
     * @dataProvider lockedPool
     */
    public function testRegionLockedItems(bool $access, string $item_name, bool $free = null, string $config = null)
    {
        if ($config) {
            $this->world->testSetConfig($config, $free);
        }

        $this->assertEquals($access, $this->world->getRegion('Swamp Palace')->canFill(Item::get($item_name, $this->world)));
    }

    /**
     * @dataProvider accessPool
     */
    public function testSomethingElse(string $location, bool $access, array $items, array $except = [])
    {
        $this->assertTrue(true);
    }

    public function lockedPool()
    {
        return [
            [true, 'Key'],
            [false, 'MapH2', false, 'region.wildMaps'],
        ];
    }

    public function accessPool()
    {
        return [
            ["Link's House", true, []],
            ["Sanctuary", False, [], ['Lamp']],
        ];
    }

    private function helper()
    {
    }
}
`;

describe("importTestFile", () => {
  const fixture = importTestFile(
    TEST_CLASS,
    "tests/NoGlitches/SampleTest.php",
    HEADER,
  );

  it("records the world, the setUp and the provenance header", () => {
    expect(fixture.class).toBe("NoGlitches\\SampleTest");
    expect(fixture.upstream).toBe(HEADER);
    expect(fixture.worlds).toEqual({
      world: {
        config: { difficulty: "test_rules", "region.wildMaps": true },
        line: 9,
        mode: "open",
      },
    });
    expect(fixture.setUp).toEqual({
      collected: ["RescueZelda"],
      line: 6,
      locationItems: { "Misery Mire Medallion": "Ether" },
    });
  });

  it("turns each data row into a case of its kind, sorted by line", () => {
    const file = "tests/NoGlitches/SampleTest.php";
    expect(fixture.cases).toEqual([
      {
        expected: true,
        file,
        items: { add: [], base: "allItems", except: [] },
        kind: "regionEnter",
        line: 22,
        method: "testCanEnterWithEverything",
        region: "Tower of Hera",
      },
      {
        config: {},
        dataSet: 0,
        expected: true,
        file,
        item: "Key",
        kind: "regionFill",
        line: 65,
        method: "testRegionLockedItems",
        region: "Swamp Palace",
      },
      {
        config: { "region.wildMaps": false },
        dataSet: 1,
        expected: false,
        file,
        item: "MapH2",
        kind: "regionFill",
        line: 66,
        method: "testRegionLockedItems",
        region: "Swamp Palace",
      },
      {
        dataSet: 0,
        expected: true,
        file,
        items: { add: [], base: "setUp" },
        kind: "location",
        line: 73,
        location: "Link's House",
        method: "testLocation",
      },
      {
        dataSet: 1,
        expected: false,
        file,
        items: { add: [], base: "allItems", except: ["Lamp"] },
        kind: "location",
        line: 74,
        location: "Sanctuary",
        method: "testLocation",
      },
    ]);
  });

  it("records what it cannot model instead of dropping it", () => {
    expect(fixture.unsupported).toEqual([
      expect.objectContaining({
        line: 13,
        method: "setUp",
        reason: expect.stringContaining("$this -> somethingNew ( ) ;"),
      }),
      {
        line: 57,
        method: "testSomethingElse",
        reason: "the method body matches no known kind of test",
        rows: [
          {
            args: {
              access: true,
              except: [],
              items: [],
              location: "Link's House",
            },
            dataSet: 0,
            line: 73,
          },
          {
            args: {
              access: false,
              except: ["Lamp"],
              items: [],
              location: "Sanctuary",
            },
            dataSet: 1,
            line: 74,
          },
        ],
      },
      {
        line: 78,
        method: "helper",
        reason: "not a test, data provider, setUp or tearDown",
      },
    ]);
  });

  it("refuses data rows that do not fit the method", () => {
    const broken = TEST_CLASS.replace(`[true, 'Key'],`, `[true],`);
    expect(() =>
      importTestFile(broken, "tests/NoGlitches/SampleTest.php", HEADER),
    ).toThrow(/Data set #0 of lockedPool at line 65 misses item_name/);
  });
});

const ITEM_PHP = `<?php
namespace ALttP;

class Item
{
    protected $name;

    public static function all(World $world)
    {
        static::$items[$world->id] = new ItemCollection([
            new Item('Nothing', [0x5A], $world),
            new Item\\Bottle('Bottle', [0x16], $world),
            new Item\\Upgrade\\Health('PieceOfHeart', [0x17], $world, .25),
        ]);
        static::$items[$world->id]->addItem(new ItemAlias('UncleSword', 'ProgressiveSword', $world));
        return new ItemAlias($this->getName(), $item->getName(), $this->world);
    }
}
`;

const ENGLISH_PHP = `<?php
return [
    'Nothing' => 'Nothing',
    'Bottle' => 'Bottle (Empty)',
    'Random' => 'Random',
];
`;

describe("importItems", () => {
  it("lists Item::all in order with each class, alias and English name", () => {
    const table = importItems(ITEM_PHP, ENGLISH_PHP, HEADER);
    expect(table.items).toEqual([
      { class: "Item", line: 11, name: "Nothing" },
      { class: "Bottle", line: 12, name: "Bottle" },
      { class: "Upgrade\\Health", line: 13, name: "PieceOfHeart" },
      {
        alias: "ProgressiveSword",
        class: "ItemAlias",
        line: 15,
        name: "UncleSword",
      },
    ]);
    expect(table.english).toEqual({
      Bottle: "Bottle (Empty)",
      Nothing: "Nothing",
    });
    expect(table.upstream).toBe(HEADER);
  });

  it("refuses a table it cannot trust", () => {
    const twice = ITEM_PHP.replace("'Nothing', [0x5A]", "'Bottle', [0x5A]");
    expect(() => importItems(twice, ENGLISH_PHP, HEADER)).toThrow(
      /Bottle is defined twice/,
    );
    expect(() =>
      importItems("<?php class Item {}", ENGLISH_PHP, HEADER),
    ).toThrow(/No items/);
    expect(() => importItems(ITEM_PHP, "<?php $x = 1;", HEADER)).toThrow(
      /does not return/,
    );
    expect(() => importItems(ITEM_PHP, "<?php return ['a'];", HEADER)).toThrow(
      /keyed array/,
    );
  });
});

describe("formatFixture", () => {
  it("writes the header first, one case per line, keys sorted", () => {
    // Built from entries: Biome sorts the keys of object literals, and the
    // point is to feed keys out of order.
    const entries = (...pairs: [string, unknown][]) =>
      Object.fromEntries(pairs);
    const text = formatFixture(
      entries(
        ["zeta", 1],
        [
          "cases",
          [
            entries(["line", 2], ["kind", "b"]),
            entries(["line", 1], ["kind", "a"]),
          ],
        ],
        ["alpha", true],
        ["unsupported", []],
        ["upstream", entries(["repo", "r"], ["commit", "c"])],
      ),
    );
    expect(text.split("\n")).toEqual([
      "{",
      '  "upstream": {',
      '    "commit": "c",',
      '    "repo": "r"',
      "  },",
      '  "unsupported": [],',
      '  "cases": [',
      '    {"kind":"b","line":2},',
      '    {"kind":"a","line":1}',
      "  ],",
      '  "alpha": true,',
      '  "zeta": 1',
      "}",
      "",
    ]);
    expect(JSON.parse(text).cases).toHaveLength(2);
  });
});

describe("the checkout", () => {
  let root = "";
  afterEach(() => {
    if (root !== "") rmSync(root, { force: true, recursive: true });
  });
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const SHA = "219fcafd029dab597b8db400efafd8f56f8b4edb";

  it("reads the commit from a loose ref, packed refs or a detached HEAD", () => {
    root = mkdtempSync(join(tmpdir(), "alttpr-importer-"));
    write(".git/HEAD", "ref: refs/heads/master\n");
    write(".git/packed-refs", `# pack-refs\n${SHA} refs/heads/master\n`);
    expect(readCommit(root)).toBe(SHA);
    write(".git/refs/heads/master", `${"a".repeat(40)}\n`);
    expect(readCommit(root)).toBe("a".repeat(40));
    write(".git/HEAD", `${"b".repeat(40)}\n`);
    expect(readCommit(root)).toBe("b".repeat(40));
    write(".git/HEAD", "ref: refs/heads/gone\n");
    expect(() => readCommit(root)).toThrow(/Cannot resolve refs\/heads\/gone/);
  });

  it("follows the .git file of a worktree to its common directory", () => {
    root = mkdtempSync(join(tmpdir(), "alttpr-importer-"));
    write("main/.git/refs/heads/wt", `${SHA}\n`);
    write("main/.git/worktrees/wt/HEAD", "ref: refs/heads/wt\n");
    write("main/.git/worktrees/wt/commondir", "../..\n");
    write("wt/.git", "gitdir: ../main/.git/worktrees/wt\n");
    expect(readCommit(join(root, "wt"))).toBe(SHA);
  });

  it("reads LOGIC from app/Randomizer.php", () => {
    root = mkdtempSync(join(tmpdir(), "alttpr-importer-"));
    write(
      "app/Randomizer.php",
      `<?php class Randomizer { const VERSION = "$v"; const LOGIC = 31; }`,
    );
    expect(readLogic(root)).toBe(31);
    write("app/Randomizer.php", "<?php class Randomizer {}");
    expect(() => readLogic(root)).toThrow(/No const LOGIC/);
  });

  it("imports every test class, replaces stale fixtures and copies the license", () => {
    root = mkdtempSync(join(tmpdir(), "alttpr-importer-"));
    write(".git/HEAD", `${SHA}\n`);
    write("LICENSE", "MIT License\n\nCopyright (c) 2016 sporchia\n");
    write("app/Randomizer.php", "<?php class R { const LOGIC = 31; }");
    write("tests/NoGlitches/Dark/SampleTest.php", TEST_CLASS);
    write("tests/NoGlitches/TestCase.php", "<?php // not a test class");
    write("app/Item.php", ITEM_PHP);
    write("resources/lang/en/item.php", ENGLISH_PHP);
    write("out/NoGlitches/Removed.json", "{}");

    const out = join(root, "out");
    const { items, summary, upstream } = importAll(root, out);
    expect(items).toBe(4);
    expect(
      JSON.parse(readFileSync(join(out, "items.json"), "utf8")).items,
    ).toHaveLength(4);
    expect(upstream).toEqual({
      commit: SHA,
      copyright: "Copyright (c) 2016 sporchia",
      license: "MIT, see LICENSE next to this file",
      logic: 31,
      repo: "sporchia/alttp_vt_randomizer",
    });
    expect(summary.map((s) => [s.file, s.cases.length])).toEqual([
      ["tests/NoGlitches/Dark/SampleTest.php", 5],
    ]);
    const written = join(out, "NoGlitches/Dark/Sample.json");
    const first = readFileSync(written, "utf8");
    expect(JSON.parse(first).cases).toHaveLength(5);
    expect(() => readFileSync(join(out, "NoGlitches/Removed.json"))).toThrow();
    expect(readFileSync(join(out, "LICENSE"), "utf8")).toContain("sporchia");

    importAll(root, out);
    expect(readFileSync(written, "utf8")).toBe(first);
  });
});
