#!/usr/bin/env node
/// <reference types="node" />
// Imports the official randomizer's NoGlitches and Inverted tests as JSON
// fixtures.
//
//   node scripts/import-upstream-tests.mjs <upstream-checkout> [--out <dir>]
//
// The checkout (sporchia/alttp_vt_randomizer, MIT, (c) 2016 sporchia) is
// untrusted data: this script only reads its files. It never runs PHP,
// composer, git or anything else from it. Test classes are read with a small
// tokenizer for the PHP they use, and every test method is matched, token by
// token, against an explicit template for one kind of test. A method or a
// setUp statement that matches no template is recorded under `unsupported`
// with its data rows, never dropped. Anything the tokenizer cannot read stops
// the import with the file and line.
//
// Output, under test/upstream/ by default: one JSON file per test class,
// mirroring its path (tests/NoGlitches/EasternPalaceTest.php becomes
// NoGlitches/EasternPalace.json), the item table of app/Item.php as
// items.json, the regions and locations of the Standard, Open and Inverted
// worlds as locations.json (with the locations a subclass removes: Inverted
// moves some), and a copy of the upstream LICENSE. Files
// are deterministic: classes, cases (by line) and object keys are sorted, and
// each case sits on one line so a re-import diffs case by case.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const UPSTREAM_REPO = "sporchia/alttp_vt_randomizer";

/** Test directories imported, relative to the checkout. */
export const TEST_ROOTS = ["tests/NoGlitches", "tests/Inverted"];

// ---------------------------------------------------------------------------
// Tokenizer

/**
 * @typedef {"var" | "ident" | "string" | "interpolated" | "number" | "punct" | "doc"} TokenType
 * @typedef {{ type: TokenType, value: string | number, line: number }} Token
 */

// Longest first: the scanner takes the first one that matches.
const PUNCTUATION = [
  "<=>",
  "===",
  "!==",
  "**=",
  "...",
  "<<=",
  ">>=",
  "??=",
  "?->",
  "->",
  "=>",
  "::",
  "==",
  "!=",
  "<>",
  "<=",
  ">=",
  "&&",
  "||",
  "??",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  ".=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<",
  ">>",
  "**",
  "#[",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ";",
  ",",
  "=",
  ".",
  "+",
  "-",
  "*",
  "/",
  "%",
  "!",
  "?",
  ":",
  "<",
  ">",
  "&",
  "|",
  "^",
  "~",
  "@",
  "\\",
  "$",
];

const DOUBLE_QUOTE_ESCAPES = /** @type {Record<string, string>} */ ({
  '"': '"',
  "\\": "\\",
  $: "$",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
});

/** @param {string} c */
function isDigit(c) {
  return c >= "0" && c <= "9";
}

/** @param {string} c */
function isIdentStart(c) {
  return (
    (c >= "a" && c <= "z") ||
    (c >= "A" && c <= "Z") ||
    c === "_" ||
    c.charCodeAt(0) >= 0x80
  );
}

/** @param {string} c */
function isIdentPart(c) {
  return isIdentStart(c) || isDigit(c);
}

/** @param {string} c */
function isSpace(c) {
  return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";
}

/**
 * Splits PHP source into tokens. Comments are dropped, but docblocks
 * (`/** … *\/`) are kept: PHPUnit reads `@dataProvider` from them.
 *
 * @param {string} source
 * @returns {Token[]}
 */
export function tokenize(source) {
  if (!source.startsWith("<?php")) {
    throw new SyntaxError("Expected the file to start with <?php");
  }
  /** @type {Token[]} */
  const tokens = [];
  let i = "<?php".length;
  let line = 1;
  const fail = (/** @type {string} */ message) => {
    throw new SyntaxError(`${message} at line ${line}`);
  };

  while (i < source.length) {
    const c = source.charAt(i);
    if (c === "\n") {
      line++;
      i++;
      continue;
    }
    if (isSpace(c)) {
      i++;
      continue;
    }
    if (source.startsWith("?>", i)) fail("Unexpected ?> (inline HTML)");
    if (source.startsWith("<<<", i))
      fail("Heredoc and nowdoc are not supported");

    // Comments and docblocks
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) fail("Unterminated comment");
      const text = source.slice(i, end + 2);
      if (text.startsWith("/**") && isSpace(text.charAt(3))) {
        tokens.push({ line, type: "doc", value: text });
      }
      line += text.split("\n").length - 1;
      i = end + 2;
      continue;
    }
    if (
      source.startsWith("//", i) ||
      (c === "#" && source.charAt(i + 1) !== "[")
    ) {
      while (i < source.length && source.charAt(i) !== "\n") i++;
      continue;
    }

    // Variables
    if (c === "$" && isIdentStart(source.charAt(i + 1))) {
      let end = i + 1;
      while (end < source.length && isIdentPart(source.charAt(end))) end++;
      tokens.push({ line, type: "var", value: source.slice(i + 1, end) });
      i = end;
      continue;
    }

    // Identifiers and keywords
    if (isIdentStart(c)) {
      let end = i;
      while (end < source.length && isIdentPart(source.charAt(end))) end++;
      tokens.push({ line, type: "ident", value: source.slice(i, end) });
      i = end;
      continue;
    }

    // Numbers
    if (isDigit(c) || (c === "." && isDigit(source.charAt(i + 1)))) {
      const start = i;
      const read = (/** @type {(c: string) => boolean} */ accept) => {
        while (
          i < source.length &&
          (accept(source.charAt(i)) || source.charAt(i) === "_")
        ) {
          i++;
        }
      };
      const prefix = source.slice(i, i + 2).toLowerCase();
      let value;
      if (prefix === "0x" || prefix === "0b" || prefix === "0o") {
        i += 2;
        const radix = { "0b": 2, "0o": 8, "0x": 16 }[prefix] ?? 10;
        const digits = "0123456789abcdef".slice(0, radix);
        read((d) => digits.includes(d.toLowerCase()));
        value = Number.parseInt(
          source.slice(start + 2, i).replaceAll("_", ""),
          radix,
        );
      } else {
        read(isDigit);
        let float = false;
        if (source.charAt(i) === "." && isDigit(source.charAt(i + 1))) {
          float = true;
          i++;
          read(isDigit);
        }
        if (source.charAt(i).toLowerCase() === "e") {
          float = true;
          i++;
          if (source.charAt(i) === "+" || source.charAt(i) === "-") i++;
          read(isDigit);
        }
        const text = source.slice(start, i).replaceAll("_", "");
        // PHP reads a leading 0 as octal: 0777
        value =
          !float && text.length > 1 && text.startsWith("0")
            ? Number.parseInt(text, 8)
            : Number(text);
      }
      if (Number.isNaN(value)) fail(`Invalid number ${source.slice(start, i)}`);
      tokens.push({ line, type: "number", value });
      continue;
    }

    // Strings. One with interpolation ("$x", "{$x}") becomes an
    // `interpolated` token, which no literal or template accepts.
    if (c === "'" || c === '"') {
      const startLine = line;
      let value = "";
      let interpolated = false;
      i++;
      for (;;) {
        if (i >= source.length) fail("Unterminated string");
        const d = source.charAt(i);
        if (d === c) {
          i++;
          break;
        }
        if (d === "\n") line++;
        if (d === "\\") {
          const e = source.charAt(i + 1);
          if (c === "'" && (e === "'" || e === "\\")) {
            value += e;
            i += 2;
            continue;
          }
          if (c === '"' && e in DOUBLE_QUOTE_ESCAPES) {
            value += DOUBLE_QUOTE_ESCAPES[e];
            i += 2;
            continue;
          }
          // Any other backslash is kept as written.
          value += d;
          i++;
          continue;
        }
        if (c === '"' && d === "$" && isIdentStart(source.charAt(i + 1))) {
          interpolated = true;
        }
        if (c === '"' && d === "{" && source.charAt(i + 1) === "$") {
          // "{$expr}": the expression may hold quotes of its own.
          interpolated = true;
          const end = skipBraces(source, i);
          value += source.slice(i, end);
          line += source.slice(i, end).split("\n").length - 1;
          i = end;
          continue;
        }
        value += d;
        i++;
      }
      tokens.push({
        line: startLine,
        type: interpolated ? "interpolated" : "string",
        value,
      });
      continue;
    }

    const symbol = PUNCTUATION.find((p) => source.startsWith(p, i));
    if (symbol === undefined) fail(`Unexpected character ${JSON.stringify(c)}`);
    else {
      tokens.push({ line, type: "punct", value: symbol });
      i += symbol.length;
    }
  }
  return tokens;
}

/**
 * The index after the `}` that closes the `{` at `start`, skipping the
 * quoted strings inside.
 *
 * @param {string} source
 * @param {number} start
 */
function skipBraces(source, start) {
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const c = source.charAt(i);
    if (c === "'" || c === '"') {
      i++;
      while (i < source.length && source.charAt(i) !== c) {
        i += source.charAt(i) === "\\" ? 2 : 1;
      }
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  throw new SyntaxError("Unterminated {$…} in a string");
}

// ---------------------------------------------------------------------------
// Literals: the values of data providers, defaults and World configs

/**
 * @typedef {string | number | boolean | null | PlainValue[] | { [key: string]: PlainValue }} PlainValue
 * @typedef {{ kind: "scalar", value: string | number | boolean | null, line: number }} ScalarNode
 * @typedef {{ kind: "list", items: LiteralNode[], line: number }} ListNode
 * @typedef {{ kind: "map", entries: { key: string | number, value: LiteralNode }[], line: number }} MapNode
 * @typedef {ScalarNode | ListNode | MapNode} LiteralNode
 */

/** @param {Token | undefined} token */
function describe(token) {
  return token === undefined ? "end of input" : JSON.stringify(token.value);
}

/**
 * @param {Token | undefined} token
 * @param {string} value
 */
function isPunct(token, value) {
  return token?.type === "punct" && token.value === value;
}

/**
 * @param {Token | undefined} token
 * @param {string} value case-insensitive, as PHP keywords are
 */
function isKeyword(token, value) {
  return token?.type === "ident" && String(token.value).toLowerCase() === value;
}

/**
 * Reads one PHP literal: a string, a number, true / false / null (any
 * case), or an array (`[…]` or `array(…)`) of literals, with or without
 * keys. Anything else, such as a constant or a call, is a SyntaxError.
 *
 * @param {Token[]} tokens
 * @param {number} start
 * @returns {{ node: LiteralNode, end: number }}
 */
export function parseLiteral(tokens, start) {
  const token = tokens[start];
  const fail = () => {
    throw new SyntaxError(
      `Expected a literal at line ${token?.line ?? "?"} but found ${describe(token)}`,
    );
  };
  if (token === undefined) return fail();
  if (token.type === "string" || token.type === "number") {
    return {
      end: start + 1,
      node: { kind: "scalar", line: token.line, value: token.value },
    };
  }
  const next = tokens[start + 1];
  if (isPunct(token, "-") && next?.type === "number") {
    return {
      end: start + 2,
      node: { kind: "scalar", line: token.line, value: -Number(next.value) },
    };
  }
  for (const [keyword, value] of /** @type {const} */ ([
    ["true", true],
    ["false", false],
    ["null", null],
  ])) {
    if (isKeyword(token, keyword)) {
      return {
        end: start + 1,
        node: { kind: "scalar", line: token.line, value },
      };
    }
  }
  if (isPunct(token, "["))
    return parseArray(tokens, start + 1, "]", token.line);
  if (isKeyword(token, "array") && isPunct(next, "(")) {
    return parseArray(tokens, start + 2, ")", token.line);
  }
  return fail();
}

/**
 * @param {Token[]} tokens
 * @param {number} start the first token after the opening bracket
 * @param {string} close
 * @param {number} line
 * @returns {{ node: ListNode | MapNode, end: number }}
 */
function parseArray(tokens, start, close, line) {
  /** @type {LiteralNode[]} */
  const items = [];
  /** @type {{ key: string | number, value: LiteralNode }[]} */
  const entries = [];
  let i = start;
  while (!isPunct(tokens[i], close)) {
    const first = parseLiteral(tokens, i);
    i = first.end;
    if (isPunct(tokens[i], "=>")) {
      const key = first.node;
      if (
        key.kind !== "scalar" ||
        (typeof key.value !== "string" && typeof key.value !== "number")
      ) {
        throw new SyntaxError(
          `Expected a string or integer key at line ${key.line}`,
        );
      }
      const value = parseLiteral(tokens, i + 1);
      entries.push({ key: key.value, value: value.node });
      i = value.end;
    } else {
      items.push(first.node);
    }
    if (items.length > 0 && entries.length > 0) {
      throw new SyntaxError(
        `Array mixes keyed and positional values at line ${line}`,
      );
    }
    if (isPunct(tokens[i], ",")) i++;
    else if (!isPunct(tokens[i], close)) {
      throw new SyntaxError(
        `Expected "," or "${close}" at line ${tokens[i]?.line ?? line} but found ${describe(tokens[i])}`,
      );
    }
  }
  const node =
    entries.length > 0
      ? /** @type {MapNode} */ ({ entries, kind: "map", line })
      : /** @type {ListNode} */ ({ items, kind: "list", line });
  return { end: i + 1, node };
}

/**
 * A literal as plain JSON data: lists become arrays, keyed arrays objects.
 *
 * @param {LiteralNode} node
 * @returns {PlainValue}
 */
export function plain(node) {
  switch (node.kind) {
    case "scalar":
      return node.value;
    case "list":
      return node.items.map(plain);
    case "map":
      return Object.fromEntries(
        node.entries.map(({ key, value }) => [String(key), plain(value)]),
      );
  }
}

// ---------------------------------------------------------------------------
// Classes and methods

/**
 * @typedef {{ name: string, default?: PlainValue }} Param
 * @typedef {{ name: string, line: number, doc: string, params: Param[], body: Token[] }} Method
 * @typedef {{ name: string, namespace: string, methods: Method[] }} PhpClass
 */

/**
 * @param {Token[]} tokens
 * @param {number} open index of an opening bracket
 * @returns {number} index of the matching closing bracket
 */
function matching(tokens, open) {
  const pairs = /** @type {Record<string, string>} */ ({
    "(": ")",
    "[": "]",
    "{": "}",
  });
  const stack = [];
  for (let i = open; i < tokens.length; i++) {
    const token = /** @type {Token} */ (tokens[i]);
    if (token.type !== "punct") continue;
    const value = String(token.value);
    if (value in pairs) stack.push(pairs[value]);
    else if (value === ")" || value === "]" || value === "}") {
      if (stack.pop() !== value) {
        throw new SyntaxError(`Unbalanced "${value}" at line ${token.line}`);
      }
      if (stack.length === 0) return i;
    }
  }
  throw new SyntaxError(`Unclosed bracket from line ${tokens[open]?.line}`);
}

const MODIFIERS = new Set([
  "abstract",
  "final",
  "private",
  "protected",
  "public",
  "static",
]);

/**
 * Reads the one class of a PHPUnit test file: its namespace, name and
 * methods (docblock, parameters with their literal defaults, body tokens).
 *
 * @param {Token[]} tokens
 * @returns {PhpClass}
 */
export function parseClass(tokens) {
  let namespace = "";
  let i = 0;
  // Header: namespace, use imports, the class docblock
  for (;;) {
    const token = tokens[i];
    if (token === undefined) throw new SyntaxError("Expected a class");
    if (isKeyword(token, "class")) break;
    if (isKeyword(token, "namespace") || isKeyword(token, "use")) {
      const start = i + 1;
      while (i < tokens.length && !isPunct(tokens[i], ";")) i++;
      if (isKeyword(token, "namespace")) {
        namespace = tokens
          .slice(start, i)
          .map((t) => t.value)
          .join("");
      }
      i++;
    } else if (
      token.type === "doc" ||
      isKeyword(token, "abstract") ||
      isKeyword(token, "final")
    ) {
      i++;
    } else {
      throw new SyntaxError(
        `Unexpected ${describe(token)} before the class at line ${token.line}`,
      );
    }
  }
  const nameToken = tokens[i + 1];
  if (nameToken?.type !== "ident")
    throw new SyntaxError("Expected a class name");
  i += 2;
  while (i < tokens.length && !isPunct(tokens[i], "{")) i++; // extends, implements
  const close = matching(tokens, i);

  /** @type {Method[]} */
  const methods = [];
  let doc = "";
  i++;
  while (i < close) {
    const token = /** @type {Token} */ (tokens[i]);
    if (token.type === "doc") {
      doc = String(token.value);
      i++;
    } else if (
      token.type === "ident" &&
      MODIFIERS.has(String(token.value).toLowerCase())
    ) {
      i++;
    } else if (isKeyword(token, "function")) {
      const name = tokens[i + 1];
      if (name?.type !== "ident" || !isPunct(tokens[i + 2], "(")) {
        throw new SyntaxError(`Expected a method name at line ${token.line}`);
      }
      const paramsEnd = matching(tokens, i + 2);
      const params = parseParams(tokens.slice(i + 3, paramsEnd), token.line);
      let bodyStart = paramsEnd + 1;
      while (bodyStart < close && !isPunct(tokens[bodyStart], "{")) bodyStart++; // return type
      const bodyEnd = matching(tokens, bodyStart);
      methods.push({
        body: tokens.slice(bodyStart + 1, bodyEnd),
        doc,
        line: name.line,
        name: String(name.value),
        params,
      });
      doc = "";
      i = bodyEnd + 1;
    } else {
      throw new SyntaxError(
        `Unexpected ${describe(token)} in the class at line ${token.line}`,
      );
    }
  }
  return { methods, name: String(nameToken.value), namespace };
}

/**
 * @param {Token[]} tokens the tokens between the parentheses
 * @param {number} line
 * @returns {Param[]}
 */
function parseParams(tokens, line) {
  /** @type {Param[]} */
  const params = [];
  let i = 0;
  while (i < tokens.length) {
    // Skip the type: names, `?`, `|`, `\`
    while (i < tokens.length && tokens[i]?.type !== "var") i++;
    const variable = tokens[i];
    if (variable === undefined)
      throw new SyntaxError(`Expected a parameter at line ${line}`);
    i++;
    /** @type {Param} */
    const param = { name: String(variable.value) };
    if (isPunct(tokens[i], "=")) {
      const value = parseLiteral(tokens, i + 1);
      param.default = plain(value.node);
      i = value.end;
    }
    params.push(param);
    if (isPunct(tokens[i], ",")) i++;
    else if (i < tokens.length) {
      throw new SyntaxError(
        `Expected "," between parameters at line ${tokens[i]?.line}`,
      );
    }
  }
  return params;
}

/**
 * The data provider a docblock names (`@dataProvider accessPool`), if any.
 *
 * @param {string} doc
 * @returns {string | undefined}
 */
export function dataProviderOf(doc) {
  const words = doc.split(/\s+/);
  const at = words.indexOf("@dataProvider");
  return at < 0 ? undefined : words[at + 1];
}

// ---------------------------------------------------------------------------
// Templates: one per kind of test, matched token by token

// A placeholder is a variable named `$__<type>_<name>` in a template:
// `$__str_x` matches a string, `$__num_x` a number, `$__ident_x` an
// identifier, `$__array_x` an array literal, `$__assert` assertTrue /
// assertFalse, and `$__items` one of the item collections below.

/** @param {string} php */
function template(php) {
  return tokenize(`<?php ${php}`);
}

/**
 * @typedef {{ base: "setUp" | "allItems", add: string[], except?: string[] }} Collection
 * @typedef {Record<string, PlainValue | LiteralNode | Collection | boolean>} Captures
 */

/** @type {ReadonlyMap<string, TokenType>} */
const SCALAR_PLACEHOLDERS = new Map([
  ["ident", "ident"],
  ["num", "number"],
  ["str", "string"],
]);

/** The item collections a single-assertion test may pass. */
const COLLECTIONS = [
  {
    build: () => ({ add: [], base: "allItems", except: [] }),
    tokens: template("$this->allItems()"),
  },
  {
    build: () => ({ add: [], base: "setUp" }),
    tokens: template("$this->collected"),
  },
  {
    build: (/** @type {Captures} */ c) => ({
      add: [],
      base: "allItems",
      except: strings(plain(/** @type {LiteralNode} */ (c.except)), "except"),
    }),
    tokens: template("$this->allItemsExcept($__array_except)"),
  },
];

/**
 * Matches a template at `start`. Returns the index after the match and the
 * placeholders' captures, or undefined.
 *
 * @param {Token[]} pattern
 * @param {Token[]} tokens
 * @param {number} start
 * @returns {{ end: number, captures: Captures } | undefined}
 */
export function matchAt(pattern, tokens, start) {
  /** @type {Captures} */
  const captures = {};
  let i = start;
  for (const want of pattern) {
    const got = tokens[i];
    if (got === undefined) return undefined;
    const placeholder =
      want.type === "var" && String(want.value).startsWith("__")
        ? String(want.value).slice(2)
        : undefined;
    if (placeholder === undefined) {
      if (got.type !== want.type || got.value !== want.value) return undefined;
      i++;
      continue;
    }
    const [type = "", name = type] = placeholder.split(/_(.*)/s);
    const scalar = SCALAR_PLACEHOLDERS.get(type);
    if (scalar !== undefined) {
      if (got.type !== scalar) return undefined;
      captures[name] = got.value;
      i++;
    } else if (type === "assert") {
      if (
        got.type !== "ident" ||
        (got.value !== "assertTrue" && got.value !== "assertFalse")
      ) {
        return undefined;
      }
      captures.assert = got.value === "assertTrue";
      i++;
    } else if (type === "array") {
      if (!isPunct(got, "[") && !isKeyword(got, "array")) return undefined;
      const literal = parseLiteral(tokens, i);
      captures[name] = literal.node;
      i = literal.end;
    } else if (type === "items") {
      const found = COLLECTIONS.map((collection) => {
        const match = matchAt(collection.tokens, tokens, i);
        return (
          match && { end: match.end, value: collection.build(match.captures) }
        );
      }).find((match) => match !== undefined);
      if (found === undefined) return undefined;
      captures.items = found.value;
      i = found.end;
    } else {
      throw new Error(`Unknown placeholder $__${placeholder}`);
    }
  }
  return { captures, end: i };
}

/**
 * @param {Token[]} pattern
 * @param {Token[]} tokens
 * @returns {Captures | undefined} the captures when the template covers all of `tokens`
 */
export function matchAll(pattern, tokens) {
  const match = matchAt(pattern, tokens, 0);
  return match !== undefined && match.end === tokens.length
    ? match.captures
    : undefined;
}

/**
 * @param {PlainValue | undefined} value
 * @param {string} what
 * @returns {string[]}
 */
function strings(value, what) {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new TypeError(`Expected ${what} to be a list of strings`);
  }
  return /** @type {string[]} */ (value);
}

/**
 * @param {PlainValue | undefined} value
 * @param {string} what
 * @returns {string}
 */
function string(value, what) {
  if (typeof value !== "string")
    throw new TypeError(`Expected ${what} to be a string`);
  return value;
}

/**
 * @param {PlainValue | undefined} value
 * @param {string} what
 * @returns {boolean}
 */
function boolean(value, what) {
  if (typeof value !== "boolean")
    throw new TypeError(`Expected ${what} to be a boolean`);
  return value;
}

/**
 * `testLocation`'s collection: everything but `except` when it is not
 * empty, otherwise what setUp collected; then `items` on top.
 *
 * @param {Record<string, PlainValue>} args
 * @returns {Collection}
 */
function providerCollection(args) {
  const add = strings(args.items, "items");
  const except = strings(args.except, "except");
  return except.length > 0
    ? { add, base: "allItems", except }
    : { add, base: "setUp" };
}

const EXCEPT_OR_SETUP = `
  if (count($except)) {
    $this->collected = $this->allItemsExcept($except);
  }
  $this->addCollected($items);
`;

/**
 * @typedef {{
 *   kind: string,
 *   provider: boolean,
 *   params?: string[],
 *   tokens: Token[],
 *   build?: (args: Record<string, PlainValue>, captures: Captures) => Record<string, unknown>,
 *   unsupported?: string,
 * }} Kind
 */

/**
 * Every kind of test method in tests/NoGlitches/**, as the method body it
 * must match exactly. `build` turns one data row into a case; a kind with
 * `unsupported` is recognized but not imported as cases, for the reason given.
 *
 * @type {Kind[]}
 */
export const KINDS = [
  {
    // Location::canAccess with a collection
    build: (args) => ({
      expected: boolean(args.access, "access"),
      items: providerCollection(args),
      location: string(args.location, "location"),
    }),
    kind: "location",
    params: ["location", "access", "items", "except"],
    provider: true,
    tokens: template(`${EXCEPT_OR_SETUP}
      $this->assertEquals($access, $this->world->getLocation($location)
        ->canAccess($this->collected));`),
  },
  {
    // The same, after placing a medallion at a medallion location
    build: (args, captures) => ({
      expected: boolean(args.access, "access"),
      items: providerCollection(args),
      location: string(args.location, "location"),
      locationItems: {
        [String(captures.medallionLocation)]: string(
          args.medallion,
          "medallion",
        ),
      },
    }),
    kind: "location",
    params: ["location", "access", "medallion", "items", "except"],
    provider: true,
    tokens: template(`${EXCEPT_OR_SETUP}
      $this->world->getLocation($__str_medallionLocation)
        ->setItem(Item::get($medallion, $this->world));
      $this->assertEquals($access, $this->world->getLocation($location)
        ->canAccess($this->collected));`),
  },
  {
    // Location::fill: may this item be placed here, with this collection?
    build: (args) => ({
      expected: boolean(args.access, "access"),
      item: string(args.item, "item"),
      items: providerCollection(args),
      location: string(args.location, "location"),
    }),
    kind: "fill",
    params: ["location", "access", "item", "items", "except"],
    provider: true,
    tokens: template(`${EXCEPT_OR_SETUP}
      $this->assertEquals($access, $this->world->getLocation($location)
        ->fill(Item::get($item, $this->world), $this->collected));`),
  },
  {
    // Region::canEnter with a collection
    build: (args, captures) => ({
      expected: boolean(args.access, "access"),
      items: providerCollection(args),
      region: String(captures.region),
    }),
    kind: "regionEnter",
    params: ["access", "items", "except"],
    provider: true,
    tokens: template(`${EXCEPT_OR_SETUP}
      $this->assertEquals($access, $this->world->getRegion($__str_region)
        ->canEnter($this->world->getLocations(), $this->collected));`),
  },
  {
    // Region::canFill: may this dungeon item be placed in this region, under
    // one config override? No items are involved.
    build: (args, captures) => ({
      config:
        args.config === null || args.config === undefined
          ? {}
          : { [string(args.config, "config")]: boolean(args.free, "free") },
      expected: boolean(args.access, "access"),
      item: string(args.item_name, "item_name"),
      region: String(captures.region),
    }),
    kind: "regionFill",
    params: ["access", "item_name", "free", "config"],
    provider: true,
    tokens: template(`
      if ($config) {
        $this->world->testSetConfig($config, $free);
      }
      $this->assertEquals($access, $this->world->getRegion($__str_region)
        ->canFill(Item::get($item_name, $this->world)));`),
  },
  {
    // Region::canComplete with a collection (Inverted's Hyrule Castle Tower)
    build: (args, captures) => ({
      expected: boolean(args.access, "access"),
      items: providerCollection(args),
      region: String(captures.region),
    }),
    kind: "regionComplete",
    params: ["access", "items", "except"],
    provider: true,
    tokens: template(`${EXCEPT_OR_SETUP}
      $this->assertEquals($access, $this->world->getRegion($__str_region)
        ->canComplete($this->world->getLocations(), $this->collected));`),
  },
  {
    // One assertion: Region::canEnter
    build: (_, captures) => ({
      expected: Boolean(captures.assert),
      items: captures.items,
      region: String(captures.region),
    }),
    kind: "regionEnter",
    provider: false,
    tokens: template(`$this->$__assert($this->world->getRegion($__str_region)
      ->canEnter($this->world->getLocations(), $__items));`),
  },
  {
    // One assertion: Region::canComplete
    build: (_, captures) => ({
      expected: Boolean(captures.assert),
      items: captures.items,
      region: String(captures.region),
    }),
    kind: "regionComplete",
    provider: false,
    tokens: template(`$this->$__assert($this->world->getRegion($__str_region)
      ->canComplete($this->world->getLocations(), $__items));`),
  },
  {
    kind: "romWrite",
    params: ["chest_location", "item_name", "expected", "free"],
    provider: true,
    tokens: template(`
      $rom = new Rom();
      $world = $free ? $this->world_free_items : $this->world;
      $location = $world->getLocation($chest_location);
      $location->fill(Item::get($item_name, $world), new ItemCollection(), false);
      $location->writeItem($rom, Item::get($item_name, $world));
      $this->assertEquals($expected, $rom->read($location->getAddress()[0]));`),
    unsupported:
      "writes an item into a ROM and reads the byte back: ROM output, not logic",
  },
];

/**
 * @typedef {{ mode: string, config: PlainValue, line: number }} WorldSetup
 * @typedef {{ bosses?: Record<string, string>, collected: string[], locationItems: Record<string, string>, line: number }} SetUp
 * @typedef {{ method: string, line: number, reason: string, rows?: { dataSet: number, line: number, args: PlainValue }[] }} Unsupported
 */

/** setUp statements, each matched on its own. */
const SETUP_STATEMENTS = [
  { apply: () => {}, tokens: template("parent::setUp();") },
  {
    apply: (
      /** @type {Captures} */ c,
      /** @type {{ worlds: Record<string, WorldSetup>, setUp: SetUp }} */ out,
      /** @type {number} */ line,
    ) => {
      out.worlds[String(c.prop)] = {
        config: plain(/** @type {LiteralNode} */ (c.config)),
        line,
        mode: String(c.mode),
      };
    },
    tokens: template(
      "$this->$__ident_prop = World::factory($__str_mode, $__array_config);",
    ),
  },
  {
    apply: (/** @type {Captures} */ c, /** @type {{ setUp: SetUp }} */ out) => {
      out.setUp.collected.push(
        ...strings(plain(/** @type {LiteralNode} */ (c.items)), "addCollected"),
      );
    },
    tokens: template("$this->addCollected($__array_items);"),
  },
  // Item names carry the world id upstream; a tracker state has one world.
  {
    apply: () => {},
    tokens: template("$this->collected->setChecksForWorld($this->world->id);"),
  },
  // A boss set in a region by name: "Dummy Boss" has no rule, so it is
  // always beaten (Boss.php:142-146, 177-184)
  {
    apply: (/** @type {Captures} */ c, /** @type {{ setUp: SetUp }} */ out) => {
      out.setUp.bosses = {
        ...out.setUp.bosses,
        [String(c.region)]: String(c.boss),
      };
    },
    tokens: template(
      "$this->world->getRegion($__str_region)->setBoss(new Boss($__str_boss));",
    ),
  },
  {
    apply: (/** @type {Captures} */ c, /** @type {{ setUp: SetUp }} */ out) => {
      out.setUp.locationItems[String(c.location)] = String(c.item);
    },
    tokens: template(
      "$this->world->getLocation($__str_location)->setItem(Item::get($__str_item, $this->world));",
    ),
  },
];

const TEARDOWN = template("parent::tearDown(); unset($this->world);");

/**
 * Splits a method body into statements: at top-level `;`, with an `if`
 * statement and its block kept whole.
 *
 * @param {Token[]} body
 * @returns {Token[][]}
 */
function statements(body) {
  /** @type {Token[][]} */
  const out = [];
  let start = 0;
  let i = 0;
  while (i < body.length) {
    const token = /** @type {Token} */ (body[i]);
    if (isPunct(token, "(") || isPunct(token, "[")) {
      i = matching(body, i) + 1;
    } else if (isPunct(token, "{")) {
      i = matching(body, i) + 1;
      if (!isKeyword(body[i], "else")) {
        out.push(body.slice(start, i));
        start = i;
      }
    } else if (isPunct(token, ";")) {
      i++;
      out.push(body.slice(start, i));
      start = i;
    } else {
      i++;
    }
  }
  if (start < body.length) out.push(body.slice(start));
  return out;
}

/** @param {Token[]} tokens */
function code(tokens) {
  return tokens
    .map((t) => {
      if (t.type === "var") return `$${t.value}`;
      if (t.type === "string") return JSON.stringify(t.value);
      return String(t.value);
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Import

/**
 * @typedef {{ repo: string, commit: string, logic: number, license: string, copyright: string }} UpstreamHeader
 */

/**
 * Imports one test class.
 *
 * @param {string} source the PHP source
 * @param {string} file its path in the checkout, for provenance
 * @param {UpstreamHeader} upstream
 */
export function importTestFile(source, file, upstream) {
  const php = parseClass(tokenize(source));
  /** @type {{ worlds: Record<string, WorldSetup>, setUp: SetUp }} */
  const out = {
    setUp: { collected: [], line: 0, locationItems: {} },
    worlds: {},
  };
  /** @type {Record<string, unknown>[]} */
  const cases = [];
  /** @type {Unsupported[]} */
  const unsupported = [];
  const methods = new Map(php.methods.map((method) => [method.name, method]));
  const providers = new Set();

  const setUp = methods.get("setUp");
  if (setUp !== undefined) {
    out.setUp.line = setUp.line;
    for (const statement of statements(setUp.body)) {
      const match = SETUP_STATEMENTS.map((s) => ({
        captures: matchAll(s.tokens, statement),
        s,
      })).find(({ captures }) => captures !== undefined);
      if (match?.captures === undefined) {
        unsupported.push({
          line: statement[0]?.line ?? setUp.line,
          method: "setUp",
          reason: `statement matches no known setUp step: ${code(statement)}`,
        });
      } else {
        match.s.apply(match.captures, out, statement[0]?.line ?? setUp.line);
      }
    }
  }

  for (const method of php.methods) {
    if (method.name === "setUp") continue;
    if (method.name === "tearDown") {
      if (matchAll(TEARDOWN, method.body) === undefined) {
        unsupported.push({
          line: method.line,
          method: method.name,
          reason: `tearDown does more than reset the world: ${code(method.body)}`,
        });
      }
      continue;
    }
    if (!method.name.startsWith("test")) continue; // providers, read below
    const providerName = dataProviderOf(method.doc);
    const provider =
      providerName === undefined ? undefined : methods.get(providerName);
    if (providerName !== undefined) providers.add(providerName);
    if (providerName !== undefined && provider === undefined) {
      throw new SyntaxError(
        `${method.name} names a missing data provider ${providerName}`,
      );
    }
    const params = method.params.map((p) => p.name);
    const matched = KINDS.map((kind) => ({
      captures:
        kind.provider === (provider !== undefined) &&
        (kind.params === undefined || kind.params.join() === params.join())
          ? matchAll(kind.tokens, method.body)
          : undefined,
      kind,
    })).find(({ captures }) => captures !== undefined);

    const rows = provider === undefined ? [] : providerRows(provider, method);
    const kind = matched?.kind;
    const captures = matched?.captures ?? {};
    if (kind === undefined || kind.build === undefined) {
      unsupported.push({
        line: method.line,
        method: method.name,
        reason:
          kind?.unsupported ?? "the method body matches no known kind of test",
        ...(provider === undefined ? {} : { rows }),
      });
      continue;
    }
    const build = kind.build;
    if (provider === undefined) {
      cases.push({
        file,
        kind: kind.kind,
        line: method.line,
        method: method.name,
        ...build({}, captures),
      });
    } else {
      for (const row of rows) {
        const args = /** @type {Record<string, PlainValue>} */ (row.args);
        cases.push({
          dataSet: row.dataSet,
          file,
          kind: kind.kind,
          line: row.line,
          method: method.name,
          ...build(args, captures),
        });
      }
    }
  }

  // A method that is neither a test, a provider nor setUp / tearDown would be
  // dead code upstream; say so rather than ignore it.
  for (const method of php.methods) {
    const known =
      method.name === "setUp" ||
      method.name === "tearDown" ||
      method.name.startsWith("test") ||
      providers.has(method.name);
    if (!known) {
      unsupported.push({
        line: method.line,
        method: method.name,
        reason: "not a test, data provider, setUp or tearDown",
      });
    }
  }

  cases.sort(
    (a, b) =>
      Number(a.line) - Number(b.line) ||
      Number(a.dataSet ?? 0) - Number(b.dataSet ?? 0),
  );
  unsupported.sort((a, b) => a.line - b.line);
  return {
    cases,
    class: `${php.namespace}\\${php.name}`,
    file,
    generated:
      "By packs/alttpr/scripts/import-upstream-tests.mjs from the upstream test file. Re-import, never edit.",
    setUp: out.setUp,
    unsupported,
    upstream,
    worlds: out.worlds,
  };
}

/**
 * A data provider's rows, bound to the test method's parameters (with their
 * defaults), each with its PHPUnit data set number and line.
 *
 * @param {Method} provider
 * @param {Method} method
 */
function providerRows(provider, method) {
  const body = provider.body;
  if (!isKeyword(body[0], "return")) {
    throw new SyntaxError(
      `Data provider ${provider.name} does not return a literal`,
    );
  }
  const literal = parseLiteral(body, 1);
  if (!isPunct(body[literal.end], ";") || literal.end + 1 !== body.length) {
    throw new SyntaxError(
      `Data provider ${provider.name} does more than return a literal`,
    );
  }
  if (literal.node.kind !== "list") {
    throw new SyntaxError(
      `Data provider ${provider.name} returns named data sets`,
    );
  }
  return literal.node.items.map((row, dataSet) => {
    if (row.kind !== "list") {
      throw new SyntaxError(
        `Data set #${dataSet} of ${provider.name} at line ${row.line} is not a list`,
      );
    }
    if (row.items.length > method.params.length) {
      throw new SyntaxError(
        `Data set #${dataSet} of ${provider.name} at line ${row.line} has too many values`,
      );
    }
    /** @type {Record<string, PlainValue>} */
    const args = {};
    method.params.forEach((param, index) => {
      const value = row.items[index];
      if (value !== undefined) args[param.name] = plain(value);
      else if ("default" in param) args[param.name] = param.default ?? null;
      else {
        throw new SyntaxError(
          `Data set #${dataSet} of ${provider.name} at line ${row.line} misses ${param.name}`,
        );
      }
    });
    return { args, dataSet, line: row.line };
  });
}

// ---------------------------------------------------------------------------
// Output

/**
 * @param {unknown} value
 * @returns {unknown} the value with every object's keys sorted
 */
export function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          sortKeys(/** @type {Record<string, unknown>} */ (value)[key]),
        ]),
    );
  }
  return value;
}

/** Top-level keys in reading order: the header, then the cases. */
const FIXTURE_ORDER = [
  "generated",
  "upstream",
  "file",
  "files",
  "class",
  "worlds",
  "setUp",
  "english",
  "unsupported",
  "cases",
  "items",
  "regions",
  "locations",
];

/** @param {string} key */
function fixtureRank(key) {
  const rank = FIXTURE_ORDER.indexOf(key);
  return rank < 0 ? FIXTURE_ORDER.length : rank;
}

/**
 * JSON with the header first (FIXTURE_ORDER, then any other key) and each
 * item of a top-level array on its own line; every object's keys sorted.
 *
 * @param {Record<string, unknown>} fixture
 */
export function formatFixture(fixture) {
  const keys = Object.keys(fixture).sort(
    (a, b) => fixtureRank(a) - fixtureRank(b) || (a < b ? -1 : a > b ? 1 : 0),
  );
  const lines = ["{"];
  keys.forEach((key, index) => {
    const comma = index < keys.length - 1 ? "," : "";
    const value = sortKeys(fixture[key]);
    if (Array.isArray(value) && value.length > 0) {
      lines.push(`  ${JSON.stringify(key)}: [`);
      value.forEach((item, i) => {
        lines.push(
          `    ${JSON.stringify(item)}${i < value.length - 1 ? "," : ""}`,
        );
      });
      lines.push(`  ]${comma}`);
    } else {
      const json = JSON.stringify(value, null, 2).replaceAll("\n", "\n  ");
      lines.push(`  ${JSON.stringify(key)}: ${json}${comma}`);
    }
  });
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// The checkout

/**
 * The commit the checkout is at, read from .git without running git.
 *
 * @param {string} checkout
 */
export function readCommit(checkout) {
  let gitDir = join(checkout, ".git");
  if (statSync(gitDir).isFile()) {
    const pointer = readFileSync(gitDir, "utf8").trim();
    if (!pointer.startsWith("gitdir: "))
      throw new Error(`Unexpected ${gitDir}`);
    gitDir = resolve(checkout, pointer.slice("gitdir: ".length));
  }
  const commonFile = join(gitDir, "commondir");
  const commonDir = existsSync(commonFile)
    ? resolve(gitDir, readFileSync(commonFile, "utf8").trim())
    : gitDir;
  const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
  let sha = head;
  if (head.startsWith("ref: ")) {
    const ref = head.slice("ref: ".length);
    const loose = [gitDir, commonDir]
      .map((dir) => join(dir, ref))
      .find(existsSync);
    if (loose !== undefined) sha = readFileSync(loose, "utf8").trim();
    else {
      const packed = join(commonDir, "packed-refs");
      const entry = existsSync(packed)
        ? readFileSync(packed, "utf8")
            .split("\n")
            .map((line) => line.split(" "))
            .find(([, name]) => name === ref)
        : undefined;
      if (entry?.[0] === undefined)
        throw new Error(`Cannot resolve ${ref} in ${gitDir}`);
      sha = entry[0];
    }
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Not a commit: ${sha}`);
  return sha;
}

/**
 * `const LOGIC = 31;` in app/Randomizer.php: the logic version the rules are.
 *
 * @param {string} checkout
 */
export function readLogic(checkout) {
  const tokens = tokenize(
    readFileSync(join(checkout, "app/Randomizer.php"), "utf8"),
  );
  const pattern = template("const LOGIC = $__num_logic;");
  for (let i = 0; i < tokens.length; i++) {
    const match = matchAt(pattern, tokens, i);
    if (match !== undefined) return Number(match.captures.logic);
  }
  throw new Error("No const LOGIC in app/Randomizer.php");
}

/**
 * @param {string} dir
 * @returns {string[]} every file under `dir`, recursively
 */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** @param {string} path */
function posix(path) {
  return path.split(sep).join("/");
}

/**
 * Imports every test class under TEST_ROOTS into `out`, replacing what was
 * there. Returns a summary per fixture.
 *
 * @param {string} checkout
 * @param {string} out
 */
export function importAll(checkout, out) {
  const licenseText = readFileSync(join(checkout, "LICENSE"), "utf8");
  const copyright = licenseText
    .split("\n")
    .find((line) => line.startsWith("Copyright"));
  if (copyright === undefined)
    throw new Error("No copyright line in the upstream LICENSE");
  /** @type {UpstreamHeader} */
  const upstream = {
    commit: readCommit(checkout),
    copyright,
    license: "MIT, see LICENSE next to this file",
    logic: readLogic(checkout),
    repo: UPSTREAM_REPO,
  };

  const sources = TEST_ROOTS.flatMap((root) => walk(join(checkout, root)))
    .map((path) => posix(relative(checkout, path)))
    .filter((path) => path.endsWith("Test.php"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const stale = new Set(
    existsSync(out) ? walk(out).filter((path) => path.endsWith(".json")) : [],
  );
  const summary = sources.map((file) => {
    const fixture = importTestFile(
      readFileSync(join(checkout, file), "utf8"),
      file,
      upstream,
    );
    const target = join(
      out,
      `${file.slice("tests/".length, -"Test.php".length)}.json`,
    );
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, formatFixture(fixture));
    stale.delete(target);
    return { cases: fixture.cases, file, unsupported: fixture.unsupported };
  });

  const items = importItems(
    readFileSync(join(checkout, ITEMS_FILE), "utf8"),
    readFileSync(join(checkout, ENGLISH_NAMES_FILE), "utf8"),
    upstream,
  );
  const itemsTarget = join(out, "items.json");
  mkdirSync(out, { recursive: true });
  writeFileSync(itemsTarget, formatFixture(items));
  stale.delete(itemsTarget);

  const locations = importLocations(
    (file) => readFileSync(join(checkout, file), "utf8"),
    upstream,
  );
  const locationsTarget = join(out, "locations.json");
  writeFileSync(locationsTarget, formatFixture(locations));
  stale.delete(locationsTarget);

  for (const path of stale) rmSync(path);
  copyFileSync(join(checkout, "LICENSE"), join(out, "LICENSE"));
  return {
    items: items.items.length,
    locations: locations.locations.length,
    summary,
    upstream,
  };
}

/** The worlds this pack covers, each the class that lists its regions. */
export const WORLD_FILES = /** @type {const} */ ({
  inverted: "app/World/Inverted.php",
  open: "app/World/Open.php",
  standard: "app/World/Standard.php",
});

/**
 * The `use` imports of a PHP file: alias to fully qualified name.
 *
 * @param {Token[]} tokens
 * @returns {Map<string, string>}
 */
function imports(tokens) {
  const aliases = new Map();
  for (let i = 0; i < tokens.length; i++) {
    if (isKeyword(tokens[i], "class")) break;
    if (!isKeyword(tokens[i], "use")) continue;
    const parts = [];
    let alias;
    i++;
    while (i < tokens.length && !isPunct(tokens[i], ";")) {
      if (isKeyword(tokens[i], "as")) alias = String(tokens[++i]?.value);
      else parts.push(String(tokens[i]?.value));
      i++;
    }
    const name = parts.join("").replace(/^\\/, "");
    aliases.set(alias ?? name.split("\\").pop(), name);
  }
  return aliases;
}

/**
 * The namespace a PHP file declares, or "".
 *
 * @param {Token[]} tokens
 */
function namespaceOf(tokens) {
  const start = tokens.findIndex((token) => isKeyword(token, "namespace"));
  if (start < 0) return "";
  const end = tokens.findIndex((token, i) => i > start && isPunct(token, ";"));
  return tokens
    .slice(start + 1, end)
    .map((token) => token.value)
    .join("");
}

/**
 * Resolves the class written by `tokens` (`Location\Chest`, `Medallion`,
 * `\ALttP\Region`) as PHP does, through the file's imports and namespace.
 *
 * @param {Token[]} tokens
 * @param {Map<string, string>} aliases
 * @param {string} namespace
 */
function resolveClass(tokens, aliases, namespace) {
  const written = tokens.map((token) => token.value).join("");
  if (written.startsWith("\\")) return written.slice(1);
  const [first = "", ...rest] = written.split("\\");
  const base = aliases.get(first);
  if (base !== undefined) return [base, ...rest].join("\\");
  return namespace === "" ? written : `${namespace}\\${written}`;
}

/** @param {string} fqn a class under ALttP\, which lives under app/ */
function classFile(fqn) {
  return `app/${fqn
    .replace(/^ALttP\\/, "")
    .split("\\")
    .join("/")}.php`;
}

/**
 * Every `new <class>(` in `tokens`: the class written, resolved, and the
 * index of its opening parenthesis.
 *
 * @param {Token[]} tokens
 */
function constructions(tokens) {
  const aliases = imports(tokens);
  const namespace = namespaceOf(tokens);
  /** @type {{ fqn: string, line: number, open: number, start: number }[]} */
  const found = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!isKeyword(tokens[i], "new")) continue;
    let end = i + 1;
    while (
      tokens[end]?.type === "ident" ||
      (isPunct(tokens[end], "\\") && tokens[end + 1]?.type === "ident")
    ) {
      end++;
    }
    if (end === i + 1 || !isPunct(tokens[end], "(")) continue;
    found.push({
      fqn: resolveClass(tokens.slice(i + 1, end), aliases, namespace),
      line: /** @type {Token} */ (tokens[i]).line,
      open: end,
      start: i,
    });
  }
  return found;
}

/**
 * The regions of the Standard and Open worlds (World/Standard.php,
 * World/Open.php: name, mode, file) and every location their region files
 * build: its name, its kind (the Location class: Chest, Prize\Crystal…),
 * file and line. A region class that extends another lists its parent, as
 * Open's escape does Standard's: its locations are built there.
 *
 * @param {(file: string) => string} read the text of a file of the checkout
 * @param {UpstreamHeader} upstream
 */
export function importLocations(read, upstream) {
  /** @type {{ extends?: string, file: string, line: number, mode: string, name: string }[]} */
  const regions = [];
  for (const [mode, worldFile] of Object.entries(WORLD_FILES)) {
    const tokens = tokenize(read(worldFile));
    for (const { fqn, line, start } of constructions(tokens)) {
      if (!fqn.startsWith("ALttP\\Region\\")) continue;
      // `'North East Light World' => new Region\Standard\…($this)`
      const name = tokens[start - 2];
      if (!isPunct(tokens[start - 1], "=>") || name?.type !== "string") {
        throw new SyntaxError(`${worldFile}:${line}: a region without a name`);
      }
      regions.push({
        file: classFile(fqn),
        line,
        mode,
        name: String(name.value),
      });
    }
  }
  if (regions.length === 0) throw new Error("No regions found in the worlds");

  /** @type {{ file: string, kind: string, line: number, name: string }[]} */
  const locations = [];
  /** @type {{ file: string, line: number, name: string }[]} */
  const removals = [];
  // The region files, and the classes they extend, which build locations too
  const files = [...new Set(regions.map((region) => region.file))].sort();
  /** @type {Map<string, string>} */
  const parents = new Map();
  for (let f = 0; f < files.length; f++) {
    const file = /** @type {string} */ (files[f]);
    const tokens = tokenize(read(file));
    const php = tokens.findIndex((token) => isKeyword(token, "class"));
    if (isKeyword(tokens[php + 2], "extends")) {
      let end = php + 3;
      while (tokens[end]?.type === "ident" || isPunct(tokens[end], "\\")) end++;
      const parent = resolveClass(
        tokens.slice(php + 3, end),
        imports(tokens),
        namespaceOf(tokens),
      );
      if (parent !== "ALttP\\Region") {
        parents.set(file, classFile(parent));
        if (!files.includes(classFile(parent))) files.push(classFile(parent));
      }
    }
    // `$this->locations->removeItem("Link's House")`: a subclass drops a
    // location its parent built (Inverted's South Light World)
    for (let i = 0; i + 6 < tokens.length; i++) {
      if (
        tokens[i]?.type === "var" &&
        tokens[i]?.value === "this" &&
        isPunct(tokens[i + 1], "->") &&
        tokens[i + 2]?.value === "locations" &&
        isPunct(tokens[i + 3], "->") &&
        tokens[i + 4]?.value === "removeItem" &&
        isPunct(tokens[i + 5], "(") &&
        tokens[i + 6]?.type === "string"
      ) {
        removals.push({
          file,
          line: /** @type {Token} */ (tokens[i]).line,
          name: String(tokens[i + 6]?.value),
        });
      }
    }
    for (const { fqn, line, open } of constructions(tokens)) {
      if (!fqn.startsWith("ALttP\\Location\\")) continue;
      const name = tokens[open + 1];
      if (name?.type !== "string") {
        throw new SyntaxError(
          `${file}:${line}: a location without a literal name`,
        );
      }
      locations.push({
        file,
        kind: fqn.slice("ALttP\\Location\\".length),
        line,
        name: String(name.value),
      });
    }
  }
  for (const region of regions) {
    const parent = parents.get(region.file);
    if (parent !== undefined) region.extends = parent;
  }
  // A file builds each name once; across files a name may come back, as
  // Inverted moves Ganon, Link's House and two Death Mountain spots
  const builds = new Set();
  for (const location of locations) {
    const key = `${location.file}\u0000${location.name}`;
    if (builds.has(key)) {
      throw new Error(
        `Location "${location.name}" is built twice in ${location.file}`,
      );
    }
    builds.add(key);
  }
  // Each world holds a location once: a region's are its class chain's, each
  // level dropping what it removes from its parent's, then adding its own
  for (const mode of Object.keys(WORLD_FILES)) {
    /** @type {Map<string, string>} */
    const holder = new Map();
    for (const region of regions.filter((r) => r.mode === mode)) {
      for (const name of locationsOf(
        region.file,
        parents,
        locations,
        removals,
      )) {
        const other = holder.get(name);
        if (other !== undefined) {
          throw new Error(
            `Location "${name}" is in two regions of the ${mode} world: ${other}, ${region.file}`,
          );
        }
        holder.set(name, region.file);
      }
    }
  }
  return {
    files: Object.values(WORLD_FILES),
    generated:
      "By packs/alttpr/scripts/import-upstream-tests.mjs from the upstream worlds and regions. Re-import, never edit.",
    locations,
    regions,
    removals: removals.sort(
      (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
    ),
    upstream,
  };
}

/**
 * The names of the locations a region file's class holds: its chain of
 * classes from the base up, each level dropping what it removes, then
 * adding what it builds, as PHP constructors run.
 *
 * @param {string} file the region's class file
 * @param {Map<string, string>} parents each class file's parent class file
 * @param {readonly { file: string, name: string }[]} locations every build
 * @param {readonly { file: string, name: string }[]} removals every removal
 * @returns {Set<string>}
 */
export function locationsOf(file, parents, locations, removals) {
  const chain = [file];
  for (let up = parents.get(file); up !== undefined; up = parents.get(up)) {
    chain.unshift(up);
  }
  const held = new Set();
  for (const level of chain) {
    for (const r of removals) if (r.file === level) held.delete(r.name);
    for (const l of locations) if (l.file === level) held.add(l.name);
  }
  return held;
}

export const ITEMS_FILE = "app/Item.php";
export const ENGLISH_NAMES_FILE = "resources/lang/en/item.php";

/** The item constructors of Item::all and the aliases added after them. */
const ITEM_CONSTRUCTORS = [
  { tokens: template("new Item($__str_name,") },
  { tokens: template("new Item\\$__ident_class($__str_name,") },
  { tokens: template("new Item\\$__ident_ns\\$__ident_class($__str_name,") },
  { tokens: template("new ItemAlias($__str_name, $__str_alias,") },
];

/**
 * The item table of app/Item.php: every item `Item::all` builds, in order,
 * with its class (Bottle, Sword, Upgrade\Health…), and the aliases added
 * after it (UncleSword…). Each English name from resources/lang/en/item.php
 * comes along, since `Item::get` falls back to it (tests write 'Flute').
 *
 * @param {string} itemSource app/Item.php
 * @param {string} namesSource resources/lang/en/item.php
 * @param {UpstreamHeader} upstream
 */
export function importItems(itemSource, namesSource, upstream) {
  const tokens = tokenize(itemSource);
  /** @type {{ name: string, class: string, line: number, alias?: string }[]} */
  const items = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!isKeyword(tokens[i], "new")) continue;
    for (const { tokens: pattern } of ITEM_CONSTRUCTORS) {
      const match = matchAt(pattern, tokens, i);
      if (match === undefined) continue;
      const { alias, class: kind, name, ns } = match.captures;
      items.push({
        class:
          alias !== undefined
            ? "ItemAlias"
            : [ns, kind ?? "Item"]
                .filter((part) => part !== undefined)
                .join("\\"),
        line: /** @type {Token} */ (tokens[i]).line,
        name: String(name),
        ...(alias === undefined ? {} : { alias: String(alias) }),
      });
      break;
    }
  }
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.name))
      throw new Error(`Item ${item.name} is defined twice`);
    seen.add(item.name);
  }
  if (items.length === 0) throw new Error(`No items found in ${ITEMS_FILE}`);

  const names = tokenize(namesSource);
  if (!isKeyword(names[0], "return")) {
    throw new SyntaxError(`${ENGLISH_NAMES_FILE} does not return an array`);
  }
  const table = plain(parseLiteral(names, 1).node);
  if (table === null || typeof table !== "object" || Array.isArray(table)) {
    throw new SyntaxError(
      `${ENGLISH_NAMES_FILE} does not return a keyed array`,
    );
  }
  /** @type {Record<string, string>} */
  const english = {};
  for (const item of items) {
    const label = table[item.name];
    if (typeof label === "string") english[item.name] = label;
  }
  return {
    english,
    files: [ITEMS_FILE, ENGLISH_NAMES_FILE],
    generated:
      "By packs/alttpr/scripts/import-upstream-tests.mjs from the upstream item table. Re-import, never edit.",
    items,
    upstream,
  };
}

/** @param {string[]} argv */
function main(argv) {
  const args = [...argv];
  const outAt = args.indexOf("--out");
  const here = dirname(fileURLToPath(import.meta.url));
  const out =
    outAt < 0
      ? join(here, "../test/upstream")
      : resolve(args.splice(outAt, 2)[1] ?? "");
  const checkout = args[0];
  if (checkout === undefined || args.length !== 1) {
    process.stderr.write(
      "Usage: import-upstream-tests.mjs <upstream-checkout> [--out <dir>]\n",
    );
    process.exit(2);
  }
  const { items, locations, summary, upstream } = importAll(
    resolve(checkout),
    out,
  );
  process.stdout.write(`${ITEMS_FILE}: ${items} items and aliases\n`);
  process.stdout.write(
    `${Object.values(WORLD_FILES).join(", ")}: ${locations} locations\n`,
  );
  /** @type {Record<string, number>} */
  const kinds = {};
  let unsupportedRows = 0;
  for (const { cases, file, unsupported } of summary) {
    for (const c of cases)
      kinds[String(c.kind)] = (kinds[String(c.kind)] ?? 0) + 1;
    const skipped = unsupported.reduce((n, u) => n + (u.rows?.length ?? 1), 0);
    unsupportedRows += skipped;
    process.stdout.write(
      `${file}: ${cases.length} cases${skipped ? `, ${skipped} unsupported` : ""}\n`,
    );
  }
  const total = Object.values(kinds).reduce((a, b) => a + b, 0);
  process.stdout.write(
    `\n${upstream.repo}@${upstream.commit} (LOGIC ${upstream.logic}): ${total} cases in ${summary.length} files\n`,
  );
  for (const [kind, count] of Object.entries(kinds).sort()) {
    process.stdout.write(`  ${kind}: ${count}\n`);
  }
  for (const { file, unsupported } of summary) {
    for (const u of unsupported) {
      process.stdout.write(
        `  unsupported ${file}:${u.line} ${u.method} (${u.rows?.length ?? 1}): ${u.reason}\n`,
      );
    }
  }
  process.stdout.write(`  unsupported: ${unsupportedRows}\n`);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}
