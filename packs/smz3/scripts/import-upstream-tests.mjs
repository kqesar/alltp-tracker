#!/usr/bin/env node
// Imports the SMZ3 randomizer's logic tests as JSON fixtures, from a
// checkout of tewtal/SMZ3Randomizer at the commit upstream.json pins:
//
//   pnpm --filter @alltp/pack-smz3 import-upstream <checkout>
//
// Randomizer.SMZ3.Tests/Logic holds four fixtures (Normal and Hard SM logic,
// with and without keysanity), each a class of LogicCases whose properties
// list, per region or location, the cases that reach it: CaseWith(x =>
// x.Morph.Bombs). LogicTests.cs asserts each case minimal: with all it lists
// the region or location is reachable, without any one of them it is not.
// This reader turns every case into those arrangements, so the pack's tests
// run them without C#. The checkout is read, never run.
//
// It understands only the regular subset these files use, and stops on
// anything else: a property is `=> new() { CaseWith(...), ... };`,
// `=> CaseWithNothing;` or `=> Other;`, and a case a chain of items and the
// builder's words (Case.cs: Has, HasAt("..."), Assume, IfSkipping, AlsoSkip).

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LOGIC = "Randomizer.SMZ3.Tests/Logic";
const ITEM_FILE = "Randomizer.SMZ3/Item.cs";

/** The four fixtures, as LogicTests.cs sets each up. */
export const FIXTURES = [
  { keysanity: false, logic: "normal", name: "SMNormal" },
  { keysanity: false, logic: "hard", name: "SMHard" },
  { keysanity: true, logic: "normal", name: "SMNormalKeysanity" },
  { keysanity: true, logic: "hard", name: "SMHardKeysanity" },
];

/** LogicTests.AllKeycards: every case holds them without keysanity. */
export const ALL_KEYCARDS = [
  "CardCrateriaL1",
  "CardCrateriaL2",
  "CardCrateriaBoss",
  "CardBrinstarL1",
  "CardBrinstarL2",
  "CardBrinstarBoss",
  "CardMaridiaL1",
  "CardMaridiaL2",
  "CardMaridiaBoss",
  "CardNorfairL1",
  "CardNorfairL2",
  "CardNorfairBoss",
  "CardLowerNorfairL1",
  "CardLowerNorfairBoss",
  "CardWreckedShipL1",
  "CardWreckedShipBoss",
];

/**
 * @typedef {{ kind: string, name: string }} Locality A region or location a
 *   property's cases are for.
 * @typedef {{ private: boolean, cases?: string[], alias?: string }} Property
 *   A fixture property: its case chains, or the property it aliases.
 * @typedef {{ base: string, name: string, properties: Map<string, Property> }}
 *   FixtureClass
 * @typedef {{ name: string, count?: number, at?: string }} Word A builder word.
 * @typedef {{ type: "item", name: string, count: number, assumed: boolean,
 *   alsoSkip?: InventoryItem }} InventoryItem
 * @typedef {{ type: "place", name: string, at: string | null }} Placed
 * @typedef {InventoryItem | Placed} Preparation
 * @typedef {{ items: Map<string, number>, placed: Map<string, string> }}
 *   Arranged
 */

/**
 * Case.cs InventoryItem.ItemType: the builder's names for counted items.
 * @type {Readonly<Record<string, string>>}
 */
const ITEM_TYPE = {
  Glove: "ProgressiveGlove",
  MasterSword: "ProgressiveSword",
  MirrorShield: "ProgressiveShield",
  Mitt: "ProgressiveGlove",
  Sword: "ProgressiveSword",
  TwoPowerBombs: "PowerBomb",
};

/**
 * Case.cs InventoryItem.ItemCount: how many it adds, and leaves once skipped.
 * @type {Readonly<Record<string, [number, number]>>}
 */
const ITEM_COUNT = {
  Glove: [1, 0],
  MasterSword: [2, 1],
  MirrorShield: [3, 0],
  Mitt: [2, 1],
  Sword: [1, 0],
  TwoPowerBombs: [2, 1],
};

/**
 * Removes line and block comments, keeping strings as they are.
 * @param {string} source
 */
export function stripComments(source) {
  let out = "";
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      const end = source.indexOf('"', i + 1);
      if (end < 0) throw new Error("Unterminated string");
      out += source.slice(i, end + 1);
      i = end;
    } else if (c === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      i = (end < 0 ? source.length : end) - 1;
    } else if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) throw new Error("Unterminated comment");
      i = end + 1;
    } else {
      out += c;
    }
  }
  return out;
}

/**
 * LogicCases.cs's declarations: each property, and the regions or
 * locations its cases are for.
 * @param {string} source
 * @returns {Map<string, Locality[]>}
 */
export function readDeclarations(source) {
  const text = stripComments(source);
  /** @type {Map<string, Locality[]>} */
  const declarations = new Map();
  const pattern =
    /((?:\[(?:Region|Location)\("[^"]+"\)\]\s*)+)protected abstract List<Case> (\w+) \{ get; \}/g;
  for (const match of text.matchAll(pattern)) {
    const localities = [
      ...match[1].matchAll(/\[(Region|Location)\("([^"]+)"\)\]/g),
    ].map(([, kind, name]) => ({ kind: kind.toLowerCase(), name }));
    declarations.set(match[2], localities);
  }
  if (declarations.size === 0) throw new Error("No declaration in LogicCases");
  return declarations;
}

/**
 * The text between `open` at `from` and its matching `close`.
 * @param {string} text
 * @param {number} from
 * @param {string} open
 * @param {string} close
 */
function balanced(text, from, open, close) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '"') {
      i = text.indexOf('"', i + 1);
    } else if (text[i] === open) {
      depth++;
    } else if (text[i] === close && --depth === 0) {
      return { body: text.slice(from + 1, i), end: i };
    }
  }
  throw new Error(`Unbalanced ${open}${close}`);
}

/**
 * A fixture class: its base class and its properties, each a list of case
 * chains, CaseWithNothing (`[""]`, the empty case) or another property.
 * `private` marks a helper list (no `override`), seen from its class only.
 * @param {string} source
 * @returns {FixtureClass}
 */
export function readClass(source) {
  const text = stripComments(source);
  const header = /public class (\w+) : (\w+) \{/.exec(text);
  if (header === null) throw new Error("No fixture class");
  /** @type {Map<string, Property>} */
  const properties = new Map();
  const pattern = /(protected override )?List<Case> (\w+) => /g;
  for (const match of text.matchAll(pattern)) {
    const name = match[2];
    const at = match.index + match[0].length;
    const rest = text.slice(at);
    /** @type {Property} */
    const property = { private: match[1] === undefined };
    if (rest.startsWith("new() {")) {
      const { body } = balanced(text, at + "new() ".length, "{", "}");
      property.cases = readCases(body, name);
    } else if (rest.startsWith("CaseWithNothing;")) {
      property.cases = [""];
    } else {
      const alias = /^(\w+);/.exec(rest);
      if (alias === null) throw new Error(`Unexpected body for ${name}`);
      property.alias = alias[1];
    }
    properties.set(name, property);
  }
  return { base: header[2], name: header[1], properties };
}

/**
 * The chains of `CaseWith(x => x.A.B), ...`, and nothing else.
 * @param {string} body
 * @param {string} property
 */
function readCases(body, property) {
  /** @type {string[]} */
  const chains = [];
  let rest = body;
  for (;;) {
    rest = rest.trimStart();
    if (rest === "") return chains;
    if (!rest.startsWith("CaseWith(x => x")) {
      throw new Error(`Unexpected case in ${property}: ${rest.slice(0, 40)}`);
    }
    const { body: inner, end } = balanced(rest, "CaseWith".length, "(", ")");
    chains.push(inner.slice("x => x".length));
    rest = rest.slice(end + 1).trimStart();
    if (rest.startsWith(",")) rest = rest.slice(1);
  }
}

/**
 * A case's chain as builder words: `{name, count?, at?}`.
 * @param {string} chain
 */
export function parseChain(chain) {
  /** @type {Word[]} */
  const words = [];
  const pattern = /^\.(\w+)(?:\((?:(\d+)|"([^"]+)")\))?/;
  let rest = chain;
  while (rest !== "") {
    const match = pattern.exec(rest);
    if (match === null) throw new Error(`Unexpected chain: ${chain}`);
    const [whole, name, count, at] = match;
    words.push({
      name,
      ...(count === undefined ? {} : { count: Number(count) }),
      ...(at === undefined ? {} : { at }),
    });
    rest = rest.slice(whole.length);
  }
  return words;
}

/**
 * Case.Builder: the preparations a chain makes, in order. An inventory item
 * `{type: "item", name, count, assumed, alsoSkip?}`; an item placed at a
 * location (this one when `at` is null) `{type: "place", name, at}`.
 * @param {readonly Word[]} words
 */
export function buildCase(words) {
  /** @type {Preparation[]} */
  const list = [];
  let has = false;
  /** @type {string | null} */
  let at = null;
  let assumed = false;
  let skip = "none";
  /** @type {InventoryItem[] | null} */
  let subjects = null;
  for (const word of words) {
    switch (word.name) {
      case "Has":
        has = true;
        continue;
      case "HasAt":
        at = word.at ?? null;
        has = true;
        continue;
      case "Assume":
        assumed = true;
        continue;
      case "IfSkipping":
        skip = "which";
        continue;
      case "AlsoSkip":
        skip = "also";
        continue;
    }
    /** @type {InventoryItem} */
    const item = {
      assumed,
      count: word.count ?? 1,
      name: word.name,
      type: "item",
    };
    if (has) {
      list.push({ at, name: word.name, type: "place" });
    } else if (skip === "which") {
      subjects ??= [];
      subjects.push(item);
    } else if (skip === "also") {
      for (const subject of subjects ?? []) {
        list.push(subject);
        subject.alsoSkip = item;
      }
      subjects = null;
      skip = "none";
    } else {
      list.push(item);
    }
    has = false;
    at = null;
    assumed = false;
  }
  return list;
}

/** @param {InventoryItem} item */
const itemType = (item) => ITEM_TYPE[item.name] ?? item.name;
/**
 * @param {InventoryItem} item
 * @returns {[number, number]}
 */
const itemCount = (item) =>
  ITEM_COUNT[item.name] ?? [item.count, item.count - 1];

/**
 * Case.Prepare: the inventory (item type to count) and the placements a
 * case arranges for location `here`, or arranges once preparation `skip`
 * is skipped.
 * @param {readonly Preparation[]} preparations
 * @param {string} here
 * @param {number} [skip]
 * @returns {Arranged}
 */
export function arrange(preparations, here, skip) {
  /** @type {Map<string, number>} */
  const items = new Map();
  /** @type {Map<string, string>} */
  const placed = new Map();
  /**
   * @param {string} type
   * @param {number} n
   */
  const add = (type, n) => items.set(type, (items.get(type) ?? 0) + n);
  for (const preparation of preparations) {
    if (preparation.type === "item") {
      add(itemType(preparation), itemCount(preparation)[0]);
    } else {
      placed.set(preparation.at ?? here, preparation.name);
    }
  }
  if (skip !== undefined) {
    const skipped = preparations[skip];
    if (skipped.type === "place") {
      placed.delete(skipped.at ?? here);
    } else {
      items.set(itemType(skipped), itemCount(skipped)[1]);
      const also = skipped.alsoSkip;
      if (also !== undefined) {
        const type = itemType(also);
        items.set(type, Math.max(0, (items.get(type) ?? 0) - also.count));
      }
    }
  }
  return { items, placed };
}

/**
 * Case.IndicesToSkip: every preparation but the assumed items.
 * @param {readonly Preparation[]} preparations
 */
export function skippable(preparations) {
  return preparations.flatMap((preparation, i) =>
    preparation.type === "item" && preparation.assumed ? [] : [i],
  );
}

/** @param {Map<string, number | string>} map */
const sorted = (map) =>
  Object.fromEntries(
    [...map].filter(([, n]) => n !== 0).sort(([a], [b]) => (a < b ? -1 : 1)),
  );

/**
 * A case as the fixture holds it: what it arranges, which must reach, and
 * what each skip changes, which must not. A skip names the item counts it
 * changes (`items`) or the placement it removes (`unplace`).
 * @param {string} chain
 * @param {string} here
 */
export function fixtureCase(chain, here) {
  const preparations = buildCase(parseChain(chain));
  const full = arrange(preparations, here);
  const without = skippable(preparations).map((index) => {
    const skipped = arrange(preparations, here, index);
    /** @type {Record<string, number>} */
    const items = {};
    for (const type of new Set([
      ...full.items.keys(),
      ...skipped.items.keys(),
    ])) {
      const n = skipped.items.get(type) ?? 0;
      if (n !== (full.items.get(type) ?? 0)) items[type] = n;
    }
    const unplace = [...full.placed.keys()].find(
      (at) => !skipped.placed.has(at),
    );
    return unplace === undefined ? { items } : { unplace };
  });
  const placed = sorted(full.placed);
  return {
    items: sorted(full.items),
    ...(Object.keys(placed).length === 0 ? {} : { placed }),
    without,
  };
}

/**
 * The cases a fixture runs, per region and location: each property taken
 * from the most derived class that defines it. An alias reads a helper list
 * of the class that declares it, or else the property as the fixture's
 * class resolves it (C# dispatches it virtually).
 * @param {string} name
 * @param {ReadonlyMap<string, FixtureClass>} classes
 * @param {ReadonlyMap<string, Locality[]>} declarations
 */
export function resolveFixture(name, classes, declarations) {
  /** @type {FixtureClass[]} */
  const chain = [];
  for (let at = name; at !== "LogicCases"; ) {
    const fixtureClass = classes.get(at);
    if (fixtureClass === undefined) throw new Error(`No class ${at}`);
    chain.push(fixtureClass);
    at = fixtureClass.base;
  }
  /**
   * @param {string} property
   * @param {ReadonlySet<string>} seen
   * @returns {string[]}
   */
  const casesOf = (property, seen = new Set()) => {
    if (seen.has(property)) throw new Error(`Alias cycle at ${property}`);
    const owner = chain.find(
      (c) => c.properties.get(property)?.private === false,
    );
    const found = owner?.properties.get(property);
    if (owner === undefined || found === undefined) {
      throw new Error(`${name} has no ${property}`);
    }
    return read(owner, found, new Set([...seen, property]));
  };
  /**
   * @param {FixtureClass} owner
   * @param {Property} property
   * @param {ReadonlySet<string>} seen
   * @returns {string[]}
   */
  const read = (owner, property, seen) => {
    if (property.cases) return property.cases;
    const alias = property.alias ?? "";
    const helper = owner.properties.get(alias);
    if (helper?.private) return read(owner, helper, seen);
    return casesOf(alias, seen);
  };
  /** @type {Record<string, unknown>[]} */
  const cases = [];
  for (const [property, localities] of declarations) {
    const chains = casesOf(property);
    for (const { kind, name: locality } of localities) {
      for (const chain of chains) {
        cases.push({ [kind]: locality, ...fixtureCase(chain, locality) });
      }
    }
  }
  return cases;
}

/**
 * The commit a git checkout (or worktree) is at.
 * @param {string} checkout
 */
export function readCommit(checkout) {
  let gitDir = join(checkout, ".git");
  if (statSync(gitDir).isFile()) {
    const pointer = readFileSync(gitDir, "utf8").trim();
    gitDir = resolve(checkout, pointer.slice("gitdir: ".length));
  }
  const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
  if (/^[0-9a-f]{40}$/.test(head)) return head;
  const ref = head.replace(/^ref: /, "");
  return readFileSync(join(gitDir, ref), "utf8").trim();
}

/**
 * Every region file of the logic, under Randomizer.SMZ3/Regions.
 * @param {string} dir
 * @returns {string[]}
 */
function regionFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? regionFiles(join(dir, entry.name))
        : entry.name.endsWith(".cs")
          ? [join(dir, entry.name)]
          : [],
    )
    .sort();
}

/**
 * A region file's regions as the pack mirrors them: the region's name, the
 * line of its CanEnter (none when it keeps Region's, open to all), and each
 * location's name, line and id, in file order. A Super Metroid location's id
 * is its item's bit in the game's collected items, which autotracking reads.
 * @param {string} source
 * @param {string} file
 */
export function readRegionFile(source, file) {
  /**
   * A location's id: a number, or Zelda's `256+n`.
   * @param {string} text
   * @param {string} where
   */
  const idOf = (text, where) => {
    const match = /^(?:(\d+)\s*\+\s*)?(\d+)$/.exec(text.trim());
    if (match === null) {
      throw new Error(`Unread location id ${text} in ${where}`);
    }
    return Number(match[1] ?? 0) + Number(match[2]);
  };
  const lines = source.split("\n");
  /** @param {RegExp} pattern */
  const lineOf = (pattern) => {
    const at = lines.findIndex((line) => pattern.test(line));
    return at < 0 ? undefined : at + 1;
  };
  const name = /public override string Name => "([^"]+)";/.exec(source);
  if (name === null) throw new Error(`No region name in ${file}`);
  /** @type {{ id: number, line: number, name: string }[]} */
  const locations = [];
  lines.forEach((line, i) => {
    const match =
      /new Location\(this, ([^,]+), 0x[0-9A-Fa-f]+, LocationType\.\w+, "([^"]+)"/.exec(
        line,
      );
    if (match) {
      locations.push({
        id: idOf(match[1], file),
        line: i + 1,
        name: match[2],
      });
    }
  });
  const canEnter = lineOf(/public override bool CanEnter\(/);
  return {
    file,
    locations,
    name: name[1],
    ...(canEnter === undefined ? {} : { canEnter }),
  };
}

/**
 * A fixture's file: a header line, then one case per line.
 * @param {Record<string, unknown>} header
 * @param {readonly unknown[]} cases
 */
export function formatFixture(header, cases) {
  return `{\n  "header": ${JSON.stringify(header)},\n  "cases": [\n${cases
    .map((c) => `    ${JSON.stringify(c)}`)
    .join(",\n")}\n  ]\n}\n`;
}

/**
 * Reads every fixture of a checkout and writes them under `outDir`.
 * @param {string} checkout
 * @param {string} outDir
 */
export function importAll(checkout, outDir) {
  const logic = join(checkout, LOGIC);
  const declarations = readDeclarations(
    readFileSync(join(logic, "LogicCases.cs"), "utf8"),
  );
  const classes = new Map(
    FIXTURES.map(({ name }) => {
      const parsed = readClass(readFileSync(join(logic, `${name}.cs`), "utf8"));
      if (parsed.name !== name)
        throw new Error(`${name}.cs holds ${parsed.name}`);
      return [name, parsed];
    }),
  );
  const commit = readCommit(checkout);
  mkdirSync(outDir, { recursive: true });
  /** @type {Record<string, number>} */
  const counts = {};
  for (const fixture of FIXTURES) {
    const cases = resolveFixture(fixture.name, classes, declarations);
    const header = {
      commit,
      file: `${LOGIC}/${fixture.name}.cs`,
      keysanity: fixture.keysanity,
      license: "MIT, see LICENSE next to this file",
      ...(fixture.keysanity ? {} : { always: ALL_KEYCARDS }),
      logic: fixture.logic,
      repo: "tewtal/SMZ3Randomizer",
    };
    writeFileSync(
      join(outDir, `${fixture.name}.json`),
      formatFixture(header, cases),
    );
    counts[fixture.name] = cases.length;
  }
  const regionsDir = join(checkout, "Randomizer.SMZ3/Regions");
  const regions = regionFiles(regionsDir).map((path) =>
    readRegionFile(
      readFileSync(path, "utf8"),
      `Randomizer.SMZ3/Regions/${relative(regionsDir, path).split(sep).join("/")}`,
    ),
  );
  writeFileSync(
    join(outDir, "regions.json"),
    formatFixture(
      {
        commit,
        license: "MIT, see LICENSE next to this file",
        repo: "tewtal/SMZ3Randomizer",
      },
      regions,
    ).replace('"cases"', '"regions"'),
  );
  writeFileSync(
    join(outDir, "LICENSE"),
    readFileSync(join(checkout, "LICENSE"), "utf8"),
  );
  return counts;
}

/**
 * Item.cs's `ItemType` enum: each item's name as the randomizer writes it
 * (its `[Description]`, which Item.Name is, and so what a spoiler log
 * prints) and the type it stands for. Two types may share a name
 * (`TwentyRupees` and `TwentyRupees2`): the first one is kept, as a log
 * cannot tell them apart.
 * @param {string} source
 * @returns {Record<string, string>}
 */
export function readItemTypes(source) {
  const text = stripComments(source);
  const start = text.indexOf("enum ItemType");
  const open = start < 0 ? -1 : text.indexOf("{", start);
  const close = open < 0 ? -1 : text.indexOf("}", open);
  if (close < 0) throw new Error("No ItemType enum in Item.cs");
  /** @type {Record<string, string>} */
  const items = {};
  const pattern =
    /\[Description\("([^"]+)"\)\]\s*(\w+)\s*(?:=\s*[^,\s]+\s*)?,/g;
  for (const [, name, type] of text.slice(open, close).matchAll(pattern)) {
    if (!(name in items)) items[name] = type;
  }
  if (Object.keys(items).length === 0) throw new Error("ItemType is empty");
  return items;
}

/**
 * Writes `src/spoiler/item-types.json`: the table that turns a spoiler
 * log's item names into upstream item types.
 * @param {string} checkout
 * @param {string} file
 */
export function importItemTypes(checkout, file) {
  const items = readItemTypes(readFileSync(join(checkout, ITEM_FILE), "utf8"));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        header: {
          commit: readCommit(checkout),
          file: ITEM_FILE,
          license: "MIT, see test/upstream/LICENSE",
          repo: "tewtal/SMZ3Randomizer",
        },
        items,
      },
      null,
      2,
    )}\n`,
  );
  return Object.keys(items).length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const checkout = process.argv[2];
  if (!checkout || !existsSync(join(checkout, LOGIC))) {
    console.error("Usage: import-upstream-tests.mjs <SMZ3Randomizer checkout>");
    process.exit(1);
  }
  const outDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../test/upstream",
  );
  const counts = importAll(resolve(checkout), outDir);
  for (const [name, count] of Object.entries(counts)) {
    console.log(`${name}: ${count} cases`);
  }
  const itemTypes = importItemTypes(
    resolve(checkout),
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../src/spoiler/item-types.json",
    ),
  );
  console.log(`item-types: ${itemTypes} names`);
}
