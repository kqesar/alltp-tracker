/// <reference types="node" />
// Imports the entrance randomizer's own tests as fixtures, for import-er.mjs:
// the cases of its dungeon tests (test/dungeons/) and of Death Mountain's
// (test/TestDeathMountain.py), the Open world's. Inverted's are left out,
// as the pack ports no Inverted crossed world.
//
// A test method sets the regions it starts in (`self.starting_regions`) and
// passes `run_tests` a list of cases: a location, whether it is reached,
// the items held and, for an "everything but" case, the items taken out of
// the test world's pool. Its class's setUp builds the world the cases run
// in, which the fixture records as a harness: how the entrances are
// connected (the mandatory connections alone, or the vanilla ones), whether
// regions are marked light or dark (the bunny's rules hang on it), whether
// Swamp Palace needs its patch, where the Big Bomb Shop's door is, and
// whether the pool "everything" draws from was generated at all.

import { expression, statementsOf, tokens } from "./python.mjs";

/** The test files imported, the Open world's. */
export const ER_TEST_FILES = [
  "test/dungeons/TestAgahnimsTower.py",
  "test/dungeons/TestDarkPalace.py",
  "test/dungeons/TestDesertPalace.py",
  "test/dungeons/TestEasternPalace.py",
  "test/dungeons/TestGanonsTower.py",
  "test/dungeons/TestIcePalace.py",
  "test/dungeons/TestMiseryMire.py",
  "test/dungeons/TestSkullWoods.py",
  "test/dungeons/TestSwampPalace.py",
  "test/dungeons/TestThievesTown.py",
  "test/dungeons/TestTowerOfHera.py",
  "test/TestDeathMountain.py",
];

/** The file each base class lives in, for a setUp a test inherits. */
const BASES = {
  TestDungeon: "test/dungeons/TestDungeon.py",
  TestVanilla: "test/TestVanilla.py",
};

/**
 * @typedef {import("./python.mjs").Statement} Statement
 * @typedef {{
 *   connections: "mandatory" | "vanilla",
 *   marked: boolean,
 *   pool: boolean,
 *   swampPatch: boolean | null,
 *   bombShop: string | null,
 *   source: string,
 * }} Harness
 */

/**
 * The world a setUp builds, read off what it calls.
 * @param {Statement} setUp
 * @param {string} file
 * @returns {Harness}
 */
function harnessOf(setUp, file) {
  const text = setUp.body.map((s) => s.text).join("\n");
  const has = (/** @type {RegExp} */ pattern) => pattern.test(text);
  if (has(/mark_dark_world_regions/))
    throw new Error(`${file}:${setUp.line}: an Inverted marking`);
  const mandatory = has(/for exitname, regionname in mandatory_connections/);
  const linked = has(/link_entrances\(self\.world, 1\)/);
  if (mandatory === linked)
    throw new Error(`${file}:${setUp.line}: connections of no kind known`);
  const shop =
    /connect_simple\(self\.world, self\.world\.get_entrance\('([^']+)', 1\), self\.world\.get_region\('Big Bomb Shop', 1\), 1\)/.exec(
      text,
    );
  const patch = /self\.world\.swamp_patch_required\[1\] = (True|False)/.exec(
    text,
  );
  return {
    bombShop: shop?.[1] ?? null,
    connections: mandatory ? "mandatory" : "vanilla",
    marked: has(/mark_light_world_regions/),
    pool: has(/generate_itempool\(self\.world, 1\)/),
    source: `${file}:${setUp.line}`,
    swampPatch: patch === null ? null : patch[1] === "True",
  };
}

/**
 * The class a test file defines, its base and its methods.
 * @param {string} source
 * @param {string} file
 */
function classOf(source, file) {
  const found = statementsOf(source).find((s) => s.text.startsWith("class "));
  const base = found && /^class \w+\(([\w.]+)\)$/.exec(found.text)?.[1];
  if (found === undefined || base === undefined)
    throw new Error(`${file}: no test class`);
  return { base, methods: found.body };
}

/**
 * The value of an expression of a test's cases: a literal, a name the method
 * bound (`key = 'Small Key (…)'`), a list repeated (`[key] * 5`) or two
 * joined (`['Lamp'] + [key] * 4`).
 * @param {import("./python.mjs").Expr} expr
 * @param {ReadonlyMap<string, unknown>} names
 * @param {string} where
 * @returns {unknown}
 */
function caseValue(expr, names, where) {
  switch (expr.t) {
    case "const":
      return expr.value;
    case "seq":
      return expr.items.map((item) => caseValue(item, names, where));
    case "name":
      if (names.has(expr.name)) return names.get(expr.name);
      break;
    case "op": {
      const left = caseValue(expr.left, names, where);
      const right = caseValue(expr.right, names, where);
      if (expr.op === "+" && Array.isArray(left) && Array.isArray(right))
        return [...left, ...right];
      if (expr.op === "*" && Array.isArray(left) && typeof right === "number")
        return Array.from({ length: right }, () => left).flat();
      break;
    }
  }
  throw new Error(`${where}: a value the import does not read`);
}

/**
 * What follows `prefix` in a statement, as a value: `self.run_tests([...])`.
 * @param {Statement} statement
 * @param {string} prefix
 * @param {ReadonlyMap<string, unknown>} names
 * @param {string} file
 */
const valueAfter = (statement, prefix, names, file) =>
  caseValue(
    expression(
      tokens(statement.text.slice(prefix.length), 0, file, statement.line),
    ),
    names,
    `${file}:${statement.line}`,
  );

/**
 * Every imported test file's cases, with the harness they run in.
 * @param {(file: string) => string} read - A file of the checkout, by name
 */
export function importErTests(read) {
  return ER_TEST_FILES.map((file) => {
    const { base, methods } = classOf(read(file), file);
    let setUp = methods.find((m) => m.text === "def setUp(self)");
    let setUpFile = file;
    if (setUp === undefined) {
      setUpFile = BASES[/** @type {keyof typeof BASES} */ (base)];
      if (setUpFile === undefined) throw new Error(`${file}: no setUp`);
      setUp = classOf(read(setUpFile), setUpFile).methods.find(
        (m) => m.text === "def setUp(self)",
      );
    }
    if (setUp === undefined) throw new Error(`${setUpFile}: no setUp`);
    const tests = methods
      .filter((m) => /^def test\w+\(self\)$/.test(m.text))
      .map((m) => {
        // The names the method binds before its cases: key = '…'
        /** @type {Map<string, unknown>} */
        const names = new Map();
        for (const s of m.body) {
          const bound = /^(\w+) = /.exec(s.text);
          if (bound?.[1] !== undefined)
            names.set(bound[1], valueAfter(s, bound[0], names, file));
        }
        const start = m.body.find((s) =>
          s.text.startsWith("self.starting_regions = "),
        );
        const run = m.body.find((s) => s.text.startsWith("self.run_tests("));
        if (run === undefined)
          throw new Error(`${file}:${m.line}: no run_tests`);
        // The call's argument, its closing parenthesis dropped
        const cases = valueAfter(
          { ...run, text: run.text.replace(/\)$/, "") },
          "self.run_tests(",
          names,
          file,
        );
        return {
          cases,
          line: m.line,
          name: /^def (\w+)/.exec(m.text)?.[1] ?? "",
          startingRegions:
            start === undefined
              ? []
              : valueAfter(start, "self.starting_regions = ", names, file),
        };
      });
    return { file, harness: harnessOf(setUp, setUpFile), tests };
  });
}
