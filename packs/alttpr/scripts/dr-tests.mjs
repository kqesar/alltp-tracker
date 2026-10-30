/// <reference types="node" />
// The Door Randomizer's own tests as fixtures (stage C of import-dr.mjs).
//
// DR keeps the entrance randomizer's unit tests, re-aimed at its world:
// test/vanilla, test/inverted, test/dungeons, test/owg and
// test/inverted_owg, one class a file, each test method a list of cases (a
// location or an entrance, whether it is reached, the items held and, for
// an "everything but" case, the items taken out of the pool). At 1.5.6
// their setUps no longer ran (they predate the door and entrance rewrite);
// upstream restored them (626691a, "test: restore the unit test suite", in
// the release since 1.5.7), changing the harness only: every suite builds
// its world as Main does (build_vanilla_world), and the dungeon tests map
// their old starting regions onto today's portal regions
// (STARTING_REGION_MAP). That harness is read from the pinned commit
// (upstream.json, doorRandomizer.testHarness, the release's own since
// 1.5.8) through `git show`, the cases from the release.
//
// What comes out, for the contract (upstream true is our yes, upstream false
// is not our yes): a fixture per test file, the pool "everything but" draws
// from, and the customizer seeds of test/suite (their Verification
// placements: Fill.py:711-740). Disabled tests (a `return` first) are kept
// and marked. Nothing is run: python.mjs and js-yaml read the files.

import { execFileSync } from "node:child_process";
import { load } from "js-yaml";
import { caseValue, classOf, valueAfter } from "./er-tests.mjs";
import {
  assigned,
  expression,
  functionBody,
  pythonExpression,
  tokens,
} from "./python.mjs";

/**
 * @typedef {import("./python.mjs").Statement} Statement
 * @typedef {{ suite: string, mode: string, logic: string, keyLogic: string, startingRegions?: Record<string, string[]>, extra: string[], source: string }} Harness
 */

/** DR's test suites, and the base class each file's class derives from. */
export const SUITES = {
  dungeons: "TestDungeon",
  inverted: "TestInverted",
  inverted_owg: "TestInvertedOWG",
  owg: "TestVanillaOWG",
  vanilla: "TestVanilla",
};

/** DR's default key logic (BaseClasses.py:156), which no test sets. */
const KEY_LOGIC = "partial";

/**
 * A file of the test harness commit.
 * @param {string} checkout
 * @param {string} commit
 * @param {string} file
 */
export function harnessFile(checkout, commit, file) {
  return execFileSync("git", ["-C", checkout, "show", `${commit}:${file}`], {
    encoding: "utf8",
  });
}

/**
 * The world a suite's base class builds at the harness commit:
 * build_vanilla_world's mode and logic, and what its setUp does beyond.
 * @param {string} suite
 * @param {(file: string) => string} harness - A file at the harness commit
 * @param {string} commit
 * @returns {Harness}
 */
function harnessOf(suite, harness, commit) {
  const base = SUITES[/** @type {keyof typeof SUITES} */ (suite)];
  const file = `test/${suite}/${base}.py`;
  const { methods } = classOf(harness(file), file);
  const setUp = methods.find((m) => m.text === "def setUp(self)");
  if (setUp === undefined) throw new Error(`${file}@${commit}: no setUp`);
  const [first, ...rest] = setUp.body;
  const built =
    /^self\.world = build_vanilla_world\((?:mode='(\w+)', logic='(\w+)')?\)$/.exec(
      first?.text ?? "",
    );
  if (built === null)
    throw new Error(`${file}@${commit}: a setUp of no build_vanilla_world`);
  /** @type {Harness} */
  const out = {
    // build_vanilla_world's defaults (test/TestBase.py)
    extra: rest
      .map((s) => s.text)
      .filter((text) => text !== "self.starting_regions = []"),
    keyLogic: KEY_LOGIC,
    logic: built[2] ?? "noglitches",
    mode: built[1] ?? "open",
    source: `${file}:${setUp.line}@${commit.slice(0, 7)}`,
    suite,
  };
  if (suite === "dungeons") {
    const map = assigned(harness(file), "STARTING_REGION_MAP", file);
    out.startingRegions = /** @type {Record<string, string[]>} */ (map.value);
  }
  return out;
}

/** The runs a test method may call, and what each checks. */
const RUNS = {
  "self.run_entrance_tests(": "entrance",
  "self.run_location_tests(": "location",
  "self.run_tests(": "location",
};

/**
 * A test file's tests: each method's runs, its starting regions, whether a
 * `return` first disables it.
 * @param {string} source
 * @param {string} file
 */
function testsOf(source, file) {
  const { methods } = classOf(source, file);
  return methods
    .filter((m) => /^def test\w+\(self\)$/.test(m.text))
    .flatMap((m) => {
      /** @type {Map<string, unknown>} */
      const names = new Map();
      for (const s of m.body) {
        const bound = /^(\w+) = /.exec(s.text);
        if (bound?.[1] === undefined) continue;
        // A name of no literal (TestInvertedBombRules' tables) is no case's
        try {
          names.set(bound[1], valueAfter(s, bound[0], names, file));
        } catch {
          names.delete(bound[1]);
        }
      }
      const start = m.body.find((s) =>
        s.text.startsWith("self.starting_regions = "),
      );
      const disabled = /^return\b/.test(m.body[0]?.text ?? "");
      const name = /^def (\w+)/.exec(m.text)?.[1] ?? "";
      return m.body.flatMap((s) => {
        const run = Object.entries(RUNS).find(([prefix]) =>
          s.text.startsWith(prefix),
        );
        if (run === undefined) return [];
        const [prefix, kind] = run;
        return [
          {
            cases: valueAfter(
              { ...s, text: s.text.replace(/\)$/, "") },
              prefix,
              names,
              file,
            ),
            ...(disabled ? { disabled: true } : {}),
            kind,
            line: m.line,
            name,
            ...(start === undefined
              ? {}
              : {
                  startingRegions: valueAfter(
                    start,
                    "self.starting_regions = ",
                    names,
                    file,
                  ),
                }),
          },
        ];
      });
    });
}

/**
 * The pool an "everything but" case draws from (run_location_tests): what
 * generate_itempool gives the tests' world (build_vanilla_world: Open or
 * Inverted, normal difficulty, progressive items, random swords, the
 * progressive bow, the Ganon goal), the dungeons' items
 * (get_dungeon_item_pool) and the prizes the harness adds. Rupees,
 * ammunition and the pool's junk are left out: no rule reads them. The
 * bottles' contents are random (ItemList.py get_pool_core), any bottle.
 * @param {(file: string) => string} read
 * @param {(file: string) => string} harness
 */
function poolOf(read, harness) {
  const items = read("ItemList.py");
  const dungeons = read("Dungeons.py");
  /**
   * A module list, a literal or lists joined and repeated
   * (`normalbaseitems = ([…] + […] * 4 + …)`).
   * @param {string} name
   */
  const list = (name) => {
    const at = new RegExp(`^${name} = `, "m").exec(items);
    if (at === null) throw new Error(`ItemList.py: no ${name}`);
    const line = items.slice(0, at.index).split("\n").length;
    const value = caseValue(
      expression(tokens(items, at.index + at[0].length, "ItemList.py")),
      new Map(),
      `ItemList.py:${line}`,
    );
    return {
      items: /** @type {string[]} */ (value),
      source: `ItemList.py:${line}`,
    };
  };
  const base = list("normalbaseitems");
  const progression = [
    list("alwaysitems"),
    list("progressivegloves"),
    {
      items: ["Magic Mirror", "Moon Pearl"],
      source: `ItemList.py:${lineOf(items, "pool.extend(['Magic Mirror', 'Moon Pearl'])")}`,
    },
    {
      items: base.items.filter(
        (item) => !/^(Rupees? |Arrows |Bombs |Single Arrow)/.test(item),
      ),
      source: base.source,
    },
    {
      items: Array(4).fill("Bottle"),
      source: `ItemList.py:${lineOf(items, "bottle_count = 4,")}`,
    },
    ...[
      "progressiveshield = ['Progressive Shield'] * 3,",
      "progressivearmor = ['Progressive Armor'] * 2,",
      "progressivesword = ['Progressive Sword'] * 4,",
    ].map((text) => {
      const [, name = "", n = "0"] =
        /= \['([^']+)'\] \* (\d+),$/.exec(text) ?? [];
      return {
        items: Array(Number(n)).fill(name),
        source: `ItemList.py:${lineOf(items, text)}`,
      };
    }),
    {
      items: ["Progressive Bow", "Progressive Bow"],
      source: `ItemList.py:${lineOf(items, "pool.extend(['Progressive Bow'] * 2)")}`,
    },
  ];
  // Dungeons.py create_dungeons: each big key and small key
  /** @type {string[]} */
  const keys = [];
  for (const m of dungeons.matchAll(
    /ItemFactory\((\[?'(?:Big|Small) Key \([^)]+\)'\]?(?: \* \d+)?), player\)/g,
  )) {
    const [, text = ""] = m;
    const name = /'([^']+)'/.exec(text)?.[1] ?? "";
    const times = Number(/\* (\d+)/.exec(text)?.[1] ?? "1");
    keys.push(...Array(times).fill(name));
  }
  const prizes = assigned(
    harness("test/TestBase.py"),
    "PRIZES",
    "test/TestBase.py",
  );
  return {
    dungeonItems: { items: keys, source: "Dungeons.py:16-28" },
    prizes: {
      items: /** @type {string[]} */ (prizes.value),
      source: `test/TestBase.py:${prizes.line}`,
    },
    progression,
  };
}

/**
 * The line of `text` in `source`.
 * @param {string} source
 * @param {string} text
 */
function lineOf(source, text) {
  const at = source.indexOf(text);
  if (at < 0) throw new Error(`no ${text}`);
  return source.slice(0, at).split("\n").length;
}

/**
 * The customizer seeds of test/suite: their settings, placements and
 * Verification checks (a location reached or not once an item is placed,
 * Fill.py:711-740), as the files write them.
 * @param {(file: string) => string} read
 * @param {readonly string[]} files - Paths under test/suite
 */
function suiteOf(read, files) {
  return files.map((file) => {
    const data = /** @type {Record<string, any>} */ (
      load(read(`test/suite/${file}`))
    );
    const verifications = (data.advanced_placements?.[1] ?? []).filter(
      (/** @type {{ type: string }} */ p) => p.type === "Verification",
    );
    return {
      file: `test/suite/${file}`,
      placements: data.placements?.[1] ?? {},
      settings: data.settings?.[1] ?? {},
      ...(data.enemies === undefined ? {} : { enemies: data.enemies }),
      verifications,
    };
  });
}

/**
 * KeyDoorShuffle.py's validate_vanilla_key_logic (:1919-2093), which no
 * code calls: per dungeon, each door rule it expects (val_rule: the small
 * key number, allow_small and its location, the alternate number and big
 * key locations) and the big key restrictions it asserts, with the modes
 * each holds in (its `if`s read for vanilla entrances, no glitches) and the
 * comment a line carries.
 * @param {(file: string) => string} read
 */
export function vanillaKeyLogicOf(read) {
  const file = "KeyDoorShuffle.py";
  const source = read(file);
  const lines = source.split("\n");
  const validate = functionBody(source, "validate_vanilla_key_logic", file);
  const [validators] = validate.body;
  if (validators === undefined) throw new Error(`${file}: no validators`);
  // validators = {'Hyrule Castle': val_hyrule, ...}
  const dungeons = [...validators.text.matchAll(/'([^']+)': (val_\w+)/g)].map(
    ([, dungeon, name]) => ({
      dungeon: String(dungeon),
      function: String(name),
    }),
  );
  const MODES = ["open", "standard", "inverted"];
  /**
   * A condition of world settings, read for one mode with vanilla
   * entrances and no glitches.
   * @param {any} e
   * @param {string} mode
   * @returns {unknown}
   */
  const value = (e, mode) => {
    if (e.t === "const") return e.value;
    if (e.t === "seq")
      return e.items.map((/** @type {any} */ x) => value(x, mode));
    if (e.t === "index" && e.of.t === "attr" && e.of.of.name === "world") {
      const setting = /** @type {Record<string, string>} */ ({
        logic: "noglitches",
        mode,
        shuffle: "vanilla",
      })[e.of.name];
      if (setting === undefined) throw new Error(`${file}: world.${e.of.name}`);
      return setting;
    }
    if (e.t === "compare") {
      const left = value(e.left, mode);
      const right = value(e.right, mode);
      if (e.op === "==") return left === right;
      if (e.op === "!=") return left !== right;
      if (e.op === "in") return /** @type {unknown[]} */ (right).includes(left);
    }
    if (e.t === "and")
      return e.args.every((/** @type {any} */ a) => value(a, mode));
    if (e.t === "or")
      return e.args.some((/** @type {any} */ a) => value(a, mode));
    if (e.t === "not") return !value(e.of, mode);
    throw new Error(`${file}: cannot read ${JSON.stringify(e)}`);
  };
  /** @param {string} text @param {number} line */
  const noteOf = (text, line) => {
    const raw = lines[line - 1] ?? "";
    const at = raw.indexOf("#");
    return at >= 0 && !text.includes("#")
      ? raw.slice(at + 1).trim()
      : undefined;
  };
  return {
    called: false,
    dungeons: dungeons.map(({ dungeon, function: name }) => {
      const fn = functionBody(source, name, file);
      /** @type {Record<string, string[]>} */
      const sets = {};
      /** @type {unknown[]} */
      const checks = [];
      /**
       * @param {any} e
       * @returns {string[]}
       */
      const strings = (e) => {
        if (e.t === "const" && e.value === null) return [];
        if (e.t === "seq")
          return e.items.map((/** @type {any} */ x) => String(x.value));
        if (e.t === "name") {
          const found = sets[e.name];
          if (found === undefined) throw new Error(`${file}: no set ${e.name}`);
          return found;
        }
        if (e.t === "call" && e.fn.t === "attr" && e.fn.name === "union")
          return [...strings(e.fn.of), ...e.args.flatMap(strings)];
        throw new Error(`${file}: cannot read a set ${JSON.stringify(e)}`);
      };
      /**
       * @param {Statement[]} statements
       * @param {string[]} modes
       */
      const walk = (statements, modes) => {
        /** @type {any} */
        let last;
        for (const st of statements) {
          if (st.block && st.text.startsWith("if ")) {
            last = pythonExpression(st.text.slice(3));
            walk(
              st.body,
              modes.filter((m) => value(last, m)),
            );
            continue;
          }
          if (st.block && st.text === "else") {
            walk(
              st.body,
              modes.filter((m) => !value(last, m)),
            );
            continue;
          }
          const note = noteOf(st.text, st.line);
          const where = { line: st.line, modes, ...(note ? { note } : {}) };
          const set = /^(\w+) = (\{.*\})$/.exec(st.text);
          if (set !== null) {
            sets[set[1] ?? ""] = strings(pythonExpression(set[2] ?? ""));
            continue;
          }
          const e = /** @type {any} */ (
            pythonExpression(st.text.replace(/^assert /, ""))
          );
          if (e.t === "call" && e.fn.name === "val_rule") {
            const [door, skn, allow, loc, askn, setCheck] = e.args;
            checks.push({
              allowSmall: allow ? allow.value : false,
              alternateBigKeyLoc: setCheck ? strings(setCheck).sort() : [],
              alternateSmallKey: askn ? askn.value : null,
              door: door.at.value,
              kind: "rule",
              smallKeyNum: skn.value,
              smallLocation: loc ? loc.value : null,
              ...where,
            });
          } else if (e.t === "compare" && e.op === "in")
            checks.push({
              kind: "bkRestricted",
              location: e.left.args[0].value,
              ...where,
            });
          else if (e.t === "compare" && e.op === "==" && e.left.t === "call")
            checks.push({
              count: e.right.value,
              kind: "bkRestrictedCount",
              ...where,
            });
          else throw new Error(`${file}:${st.line}: cannot read ${st.text}`);
        }
      };
      walk(fn.body, MODES);
      return { checks, dungeon, function: name, line: fn.line };
    }),
    file,
    line: validate.line,
  };
}

/**
 * Every DR test fixture.
 * @param {(file: string) => string} read - A file of the release's checkout
 * @param {(file: string) => string} harness - A file at the harness commit
 * @param {string} commit - The harness commit
 * @param {{ tests: Record<string, string[]>, suite: string[] }} files - The
 *   test files of each suite, and the suite's yaml files
 */
export function importDrTests(read, harness, commit, files) {
  const fixtures = Object.entries(files.tests).flatMap(([suite, names]) => {
    const harnessData = harnessOf(suite, harness, commit);
    return names.map((name) => {
      const file = `test/${suite}/${name}`;
      const tests = testsOf(read(file), file);
      // A test method of no case list: code over tables, not cases
      // (TestInvertedBombRules: code over the bomb shop's door options)
      const code = classOf(read(file), file)
        .methods.filter(
          (m) =>
            /^def test\w+\(self\)$/.test(m.text) &&
            !tests.some((t) => t.line === m.line),
        )
        .map((m) => ({
          line: m.line,
          name: /^def (\w+)/.exec(m.text)?.[1] ?? "",
        }));
      return {
        ...(code.length > 0 ? { code } : {}),
        file,
        harness: harnessData,
        suite,
        tests,
      };
    });
  });
  return {
    fixtures,
    pool: poolOf(read, harness),
    suite: suiteOf(read, files.suite),
    vanillaKeyLogic: vanillaKeyLogicOf(read),
  };
}
