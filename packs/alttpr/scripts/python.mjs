/// <reference types="node" />
// Reads the Python the entrance randomizer is written in, as data: never
// runs it. A tokenizer; the literals its tables are written in (lists,
// tuples, dicts, sets, strings, numbers); the expressions its rules are
// written in, as a tree; and a function's body, as statements in blocks.
// Anything outside that subset stops the import with the file and line.

/**
 * @typedef {{ type: "string" | "number" | "name" | "punct" | "end", value: string | number, line: number }} Token
 * @typedef {{ fail: (what: string) => never, line: () => number, next: () => Token, peek: () => Token, done: () => boolean }} Stream
 * @typedef {string | number | boolean | null | { name: string } | Literal[] | { [key: string]: Literal }} Literal
 */

/** The operators of two characters, read before those of one. */
const OPERATORS = ["==", "!=", "<=", ">=", "//", "**", "+=", "-="];
const PUNCT = "[](){},:-.=<>*+/%";

/**
 * A token stream over `source` from `start`, read as it is asked for.
 * @param {string} source
 * @param {number} start
 * @param {string} file
 * @param {number} [firstLine] - The line `source` starts on, when it is a
 *   piece of the file
 * @returns {Stream}
 */
export function tokens(source, start, file, firstLine = 1) {
  let at = start;
  let line = firstLine + source.slice(0, start).split("\n").length - 1;
  /** @param {string} what @returns {never} */
  const fail = (what) => {
    throw new Error(`${file}:${line}: ${what}`);
  };
  const skip = () => {
    for (;;) {
      const c = source[at];
      if (c === "\n") {
        line++;
        at++;
      } else if (c === " " || c === "\t" || c === "\r" || c === "\\") {
        at++;
      } else if (c === "#") {
        while (source[at] !== undefined && source[at] !== "\n") at++;
      } else return;
    }
  };
  /** @returns {Token} */
  const next = () => {
    skip();
    const c = source[at];
    // The end reads as a token, so a parser may look past the last one
    if (c === undefined) return { line, type: "end", value: "" };
    if (c === '"' || c === "'") {
      const triple = source.startsWith(c.repeat(3), at);
      const quote = triple ? c.repeat(3) : c;
      at += quote.length;
      let value = "";
      for (;;) {
        if (source.startsWith(quote, at)) {
          at += quote.length;
          return { line, type: "string", value };
        }
        const d = source[at];
        if (d === undefined || (!triple && d === "\n"))
          fail("unterminated string");
        if (d === "\\") {
          const e = source[at + 1];
          value += e === "n" ? "\n" : e === "t" ? "\t" : (e ?? "");
          at += 2;
        } else {
          if (d === "\n") line++;
          value += d;
          at++;
        }
      }
    }
    const number = /^(0x[0-9a-fA-F]+|\d+(\.\d+)?)/.exec(
      source.slice(at, at + 32),
    );
    if (number) {
      at += number[0].length;
      return { line, type: "number", value: Number(number[0]) };
    }
    const name = /^[A-Za-z_]\w*/.exec(source.slice(at, at + 64));
    if (name) {
      at += name[0].length;
      return { line, type: "name", value: name[0] };
    }
    const operator = OPERATORS.find((op) => source.startsWith(op, at));
    if (operator !== undefined) {
      at += operator.length;
      return { line, type: "punct", value: operator };
    }
    if (PUNCT.includes(c)) {
      at++;
      return { line, type: "punct", value: c };
    }
    return fail(`unexpected ${JSON.stringify(c)}`);
  };
  /** @type {Token[]} */
  const ahead = [];
  return {
    done: () => {
      if (ahead.length > 0) return ahead[0]?.type === "end";
      skip();
      return at >= source.length;
    },
    fail,
    line: () => ahead[0]?.line ?? line,
    next: () => ahead.shift() ?? next(),
    peek: () => {
      if (ahead.length === 0) ahead.push(next());
      return /** @type {Token} */ (ahead[0]);
    },
  };
}

/**
 * One literal: a list, tuple or set as an array, a dict as an object, a
 * string (adjacent ones joined, as Python does), a number, true, false,
 * null, or a bare name as `{ name }`.
 * @param {Stream} stream
 * @returns {Literal}
 */
export function literal(stream) {
  const token = stream.next();
  if (token.type === "end") return stream.fail("unexpected end of file");
  if (token.type === "string") {
    let value = String(token.value);
    while (stream.peek().type === "string") value += stream.next().value;
    return value;
  }
  if (token.type === "number") return token.value;
  if (token.type === "punct" && token.value === "-") {
    const n = stream.next();
    if (n.type !== "number") stream.fail("a number after -");
    return -Number(n.value);
  }
  if (token.type === "name") {
    if (token.value === "True") return true;
    if (token.value === "False") return false;
    if (token.value === "None") return null;
    return { name: String(token.value) };
  }
  /** @type {Record<string, string>} */
  const closing = { "(": ")", "[": "]", "{": "}" };
  const close = closing[String(token.value)];
  if (close === undefined) return stream.fail(`unexpected ${token.value}`);
  /** @type {Literal[]} */
  const items = [];
  /** @type {[string, Literal][]} */
  const entries = [];
  let dict = false;
  let comma = false;
  for (;;) {
    if (stream.peek().value === close) {
      stream.next();
      break;
    }
    /** @type {Literal} */
    const key = literal(stream);
    if (token.value === "{" && stream.peek().value === ":") {
      stream.next();
      dict = true;
      entries.push([String(key), literal(stream)]);
    } else items.push(key);
    const after = stream.next();
    if (after.value === close) break;
    if (after.value !== ",") stream.fail(`expected , or ${close}`);
    comma = true;
  }
  // (x) is x; (x,) is a tuple
  if (token.value === "(" && items.length === 1 && !comma)
    return /** @type {Literal} */ (items[0]);
  return dict ? Object.fromEntries(entries) : items;
}

/**
 * The Python literal `text` starts with.
 * @param {string} text
 */
export const pythonLiteral = (text) => literal(tokens(text, 0, "<text>"));

/**
 * The literal assigned to `name` at the start of a line, and its line.
 * @param {string} source
 * @param {string} name
 * @param {string} file
 * @param {string} indent - A pattern for the line's indent
 */
export function assigned(source, name, file, indent = "") {
  const match = new RegExp(`^${indent}${name} = `, "m").exec(source);
  if (match === null) throw new Error(`${file}: no ${name} = …`);
  const stream = tokens(source, match.index + match[0].length, file);
  const line = stream.peek().line;
  let value = literal(stream);
  // A list the module extends further down: Cave_Exits_Base += [...]
  const extended = new RegExp(`^${indent}${name} \\+= `, "gm");
  for (let m = extended.exec(source); m; m = extended.exec(source)) {
    const more = literal(tokens(source, m.index + m[0].length, file));
    if (!Array.isArray(value) || !Array.isArray(more))
      throw new Error(`${file}: ${name} += a list to a list`);
    value = [...value, ...more];
  }
  return { line, value };
}

/**
 * The arguments of each call to `callee` in `source`, with its line.
 * @param {string} source
 * @param {string} callee
 * @param {string} file
 * @param {number} from
 * @param {number} to
 */
export function calls(source, callee, file, from = 0, to = source.length) {
  /** @type {{ args: Literal[], line: number }[]} */
  const found = [];
  const pattern = new RegExp(`\\b${callee}\\(`, "g");
  pattern.lastIndex = from;
  for (
    let m = pattern.exec(source);
    m && m.index < to;
    m = pattern.exec(source)
  ) {
    const stream = tokens(source, m.index + m[0].length, file);
    const line = stream.peek().line;
    /** @type {Literal[]} */
    const args = [];
    while (stream.peek().value !== ")") {
      args.push(literal(stream));
      if (stream.peek().value === ",") stream.next();
    }
    found.push({ args, line });
  }
  return found;
}

/**
 * The body of the function `name`: from the newline before its def (-1 on
 * the first line) to the next top-level line.
 * @param {string} source
 * @param {string} name
 * @param {string} file
 */
export function body(source, name, file) {
  // The newline before the def: -1 for a def on the first line
  const start = source.startsWith(`def ${name}(`)
    ? -1
    : source.indexOf(`\ndef ${name}(`);
  if (start === -1 && !source.startsWith(`def ${name}(`))
    throw new Error(`${file}: no def ${name}`);
  const end = /\n\S/g;
  end.lastIndex = start + 1;
  const next = end.exec(source);
  return { end: next ? next.index : source.length, start };
}

// ---------------------------------------------------------------------------
// Expressions

/**
 * An expression, as a tree. `name` is a bare name (True, False and None are
 * `const`); `call` a call, its keyword arguments in `keywords`; `attr` an
 * attribute; `index` a subscript; `seq` a list or tuple; `op` an arithmetic
 * operator; `compare` a comparison (`in`, `not in` and `is` among them);
 * `not`, `and`, `or`; `ifelse` a conditional expression; `lambda`.
 * @typedef {{ t: "name", name: string }
 *   | { t: "const", value: string | number | boolean | null }
 *   | { t: "call", fn: Expr, args: Expr[], keywords: Record<string, Expr> }
 *   | { t: "attr", of: Expr, name: string }
 *   | { t: "index", of: Expr, at: Expr }
 *   | { t: "seq", items: Expr[] }
 *   | { t: "op", op: string, left: Expr, right: Expr }
 *   | { t: "compare", op: string, left: Expr, right: Expr }
 *   | { t: "not", of: Expr }
 *   | { t: "and" | "or", args: Expr[] }
 *   | { t: "ifelse", test: Expr, then: Expr, otherwise: Expr }
 *   | { t: "lambda", params: string[], body: Expr }} Expr
 */

const COMPARISONS = new Set(["==", "!=", "<", ">", "<=", ">="]);

/**
 * One expression from `stream`, Python's grammar for the operators the
 * randomizer's rules use, at Python's precedence.
 * @param {Stream} stream
 * @param {boolean} [primaryOnly] - Read a name and its calls, attributes
 *   and subscripts only, where what follows is another statement
 * @returns {Expr}
 */
export function expression(stream, primaryOnly = false) {
  /** @param {string} value */
  const at = (value) => stream.peek().value === value;
  /** @param {string} value */
  const expect = (value) => {
    const token = stream.next();
    if (token.value !== value)
      stream.fail(`expected ${value}, not ${token.value}`);
  };

  /** @returns {Expr} */
  const top = () => {
    if (at("lambda")) {
      stream.next();
      /** @type {string[]} */
      const params = [];
      while (!at(":")) {
        params.push(String(stream.next().value));
        if (at(",")) stream.next();
      }
      expect(":");
      return { body: top(), params, t: "lambda" };
    }
    const then = disjunction();
    if (!at("if")) return then;
    stream.next();
    const test = disjunction();
    expect("else");
    return { otherwise: top(), t: "ifelse", test, then };
  };

  /** @returns {Expr} */
  const disjunction = () => {
    const args = [conjunction()];
    while (at("or")) {
      stream.next();
      args.push(conjunction());
    }
    return args.length === 1
      ? /** @type {Expr} */ (args[0])
      : { args, t: "or" };
  };

  /** @returns {Expr} */
  const conjunction = () => {
    const args = [negation()];
    while (at("and")) {
      stream.next();
      args.push(negation());
    }
    return args.length === 1
      ? /** @type {Expr} */ (args[0])
      : { args, t: "and" };
  };

  /** @returns {Expr} */
  const negation = () => {
    if (!at("not")) return comparison();
    stream.next();
    return { of: negation(), t: "not" };
  };

  /** @returns {Expr} */
  const comparison = () => {
    let left = sum();
    for (;;) {
      const token = stream.peek();
      let op = String(token.value);
      if (token.type === "punct" && COMPARISONS.has(op)) stream.next();
      else if (op === "in" || op === "is") {
        stream.next();
        if (op === "is" && at("not")) {
          stream.next();
          op = "is not";
        }
      } else if (op === "not") {
        stream.next();
        expect("in");
        op = "not in";
      } else return left;
      left = { left, op, right: sum(), t: "compare" };
    }
  };

  /** @returns {Expr} */
  const sum = () => {
    let left = product();
    while (at("+") || at("-")) {
      const op = String(stream.next().value);
      left = { left, op, right: product(), t: "op" };
    }
    return left;
  };

  /** @returns {Expr} */
  const product = () => {
    let left = unary();
    while (at("*") || at("/") || at("//") || at("%")) {
      const op = String(stream.next().value);
      left = { left, op, right: unary(), t: "op" };
    }
    return left;
  };

  /** @returns {Expr} */
  const unary = () => {
    if (!at("-")) return primary();
    stream.next();
    return { left: { t: "const", value: 0 }, op: "-", right: unary(), t: "op" };
  };

  /** @returns {Expr} */
  const primary = () => {
    let node = atom();
    for (;;) {
      if (at("(")) {
        stream.next();
        /** @type {Expr[]} */
        const args = [];
        /** @type {Record<string, Expr>} */
        const keywords = {};
        while (!at(")")) {
          const token = stream.peek();
          const arg = top();
          if (at("=") && token.type === "name") {
            stream.next();
            keywords[String(token.value)] = top();
          } else args.push(arg);
          if (at(",")) stream.next();
          else if (!at(")")) stream.fail("expected , or )");
        }
        stream.next();
        node = { args, fn: node, keywords, t: "call" };
      } else if (at("[")) {
        stream.next();
        const index = top();
        expect("]");
        node = { at: index, of: node, t: "index" };
      } else if (at(".")) {
        stream.next();
        const name = stream.next();
        if (name.type !== "name") stream.fail("expected a name after .");
        node = { name: String(name.value), of: node, t: "attr" };
      } else return node;
    }
  };

  /** @returns {Expr} */
  const atom = () => {
    const token = stream.next();
    if (token.type === "end") return stream.fail("unexpected end of file");
    if (token.type === "string") {
      let value = String(token.value);
      while (stream.peek().type === "string") value += stream.next().value;
      return { t: "const", value };
    }
    if (token.type === "number") return { t: "const", value: token.value };
    if (token.type === "name") {
      const name = String(token.value);
      if (name === "True") return { t: "const", value: true };
      if (name === "False") return { t: "const", value: false };
      if (name === "None") return { t: "const", value: null };
      return { name, t: "name" };
    }
    // A set display is a sequence too: {'a', 'b'} (KeyDoorShuffle.py's
    // validators); a dict display still stops the import at its ':'
    if (token.value === "(" || token.value === "[" || token.value === "{") {
      const close = token.value === "(" ? ")" : token.value === "[" ? "]" : "}";
      /** @type {Expr[]} */
      const items = [];
      let comma = false;
      while (!at(close)) {
        items.push(top());
        if (at(",")) {
          stream.next();
          comma = true;
        } else if (!at(close)) stream.fail(`expected , or ${close}`);
      }
      stream.next();
      // (x) is x; (x,) is a tuple
      if (close === ")" && items.length === 1 && !comma)
        return /** @type {Expr} */ (items[0]);
      return { items, t: "seq" };
    }
    return stream.fail(`unexpected ${token.value}`);
  };

  return primaryOnly ? primary() : top();
}

/**
 * Each call to `callee` in `source` between `from` and `to` (its `def`
 * aside), as an expression, with its line: for calls whose arguments are
 * no literals.
 * @param {string} source
 * @param {string} callee
 * @param {string} file
 * @param {number} from
 * @param {number} to
 */
export function callExpressions(source, callee, file, from, to) {
  /** @type {{ call: Extract<Expr, { t: "call" }>, line: number }[]} */
  const found = [];
  const pattern = new RegExp(`\\b${callee}\\(`, "g");
  pattern.lastIndex = from;
  for (
    let m = pattern.exec(source);
    m && m.index < to;
    m = pattern.exec(source)
  ) {
    // Its definition is no call
    if (source.slice(0, m.index).endsWith("def ")) continue;
    const stream = tokens(source, m.index, file);
    const line = stream.peek().line;
    const call = expression(stream, true);
    if (call.t !== "call") stream.fail(`a call of ${callee}`);
    found.push({
      call: /** @type {Extract<Expr, { t: "call" }>} */ (call),
      line,
    });
  }
  return found;
}

/**
 * The expression `text` holds, all of it.
 * @param {string} text
 */
export function pythonExpression(text) {
  const stream = tokens(text, 0, "<text>");
  const found = expression(stream);
  if (!stream.done()) stream.fail(`unexpected ${stream.peek().value}`);
  return found;
}

// ---------------------------------------------------------------------------
// Statements

/**
 * A logical line of a function's body, with the lines indented under it
 * when it opens a block (`if …:`, `for …:`, `def …:`). `text` is the line
 * without its indent and comment, the closing colon dropped.
 * @typedef {{ text: string, line: number, indent: number, block: boolean, body: Statement[] }} Statement
 */

/**
 * The logical lines of `text` (a piece of a file starting at `firstLine`):
 * a line goes on while a bracket is open or it ends in a backslash.
 * Comments and blank lines are dropped.
 * @param {string} text
 * @param {number} firstLine
 */
function logicalLines(text, firstLine) {
  /** @type {{ text: string, line: number, indent: number }[]} */
  const lines = [];
  let depth = 0;
  let current = "";
  let start = firstLine;
  let line = firstLine;
  /** @type {string | null} */
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = /** @type {string} */ (text[i]);
    if (quote !== null) {
      current += c;
      if (c === "\\") {
        current += text[i + 1] ?? "";
        i++;
      } else if (text.startsWith(quote, i)) {
        current += quote.slice(1);
        i += quote.length - 1;
        quote = null;
      } else if (c === "\n") line++;
      continue;
    }
    if (c === "#") {
      while (i + 1 < text.length && text[i + 1] !== "\n") i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = text.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
      current += quote;
      i += quote.length - 1;
      continue;
    }
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth--;
    if (c === "\n") {
      line++;
      const continued = current.trimEnd().endsWith("\\");
      if (depth > 0 || continued) {
        current = `${continued ? current.trimEnd().slice(0, -1) : current} `;
        continue;
      }
      if (current.trim() !== "") {
        const indent = current.length - current.trimStart().length;
        lines.push({ indent, line: start, text: current.trim() });
      }
      current = "";
      start = line;
      continue;
    }
    current += c;
  }
  if (current.trim() !== "") {
    const indent = current.length - current.trimStart().length;
    lines.push({ indent, line: start, text: current.trim() });
  }
  return lines;
}

/**
 * The statements of the function `name`'s body, in blocks by indent.
 * @param {string} source
 * @param {string} name
 * @param {string} file
 * @returns {{ line: number, params: string[], body: Statement[] }}
 */
export function functionBody(source, name, file) {
  const { end, start } = body(source, name, file);
  const firstLine = source.slice(0, start + 1).split("\n").length;
  const [head, ...rest] = logicalLines(source.slice(start + 1, end), firstLine);
  if (head === undefined) throw new Error(`${file}: no def ${name}`);
  const params = /^def \w+\((.*)\):$/.exec(head.text)?.[1];
  if (params === undefined) throw new Error(`${file}:${head.line}: a def`);
  return {
    body: blocks(rest),
    line: head.line,
    params: params.split(",").map((p) => p.trim().split("=")[0] ?? ""),
  };
}

/**
 * The statements of a whole file, in blocks by indent: a class holds its
 * methods, a method its body.
 * @param {string} source
 */
export const statementsOf = (source) => blocks(logicalLines(source, 1));

/**
 * Nests logical lines into statements by their indent.
 * @param {{ text: string, line: number, indent: number }[]} lines
 * @returns {Statement[]}
 */
function blocks(lines) {
  /** @type {Statement[]} */
  const top = [];
  /** @type {Statement[]} */
  const open = [];
  for (const { indent, line, text } of lines) {
    while (open.length > 0 && (open.at(-1)?.indent ?? 0) >= indent) open.pop();
    const block = text.endsWith(":");
    /** @type {Statement} */
    const statement = {
      block,
      body: [],
      indent,
      line,
      text: block ? text.slice(0, -1).trimEnd() : text,
    };
    (open.at(-1)?.body ?? top).push(statement);
    if (block) open.push(statement);
  }
  return top;
}
