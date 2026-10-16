import { type Expr, RESERVED_WORDS, type Threshold } from "./ast";

/**
 * A requirement that does not follow the grammar (see the README). `pos` is
 * the 0-based offset in `source` of the first character that could not be
 * accepted; the message ends with it too.
 */
export class ParseError extends Error {
  override readonly name = "ParseError";
  readonly pos: number;
  readonly source: string;

  constructor(message: string, source: string, pos: number) {
    super(message);
    this.pos = pos;
    this.source = source;
  }
}

type Punctuation = "&" | "|" | "(" | ")" | "," | "?" | "!" | ">=";

interface Token {
  readonly kind: Punctuation | "ident" | "helper" | "int" | "eof";
  /** The identifier, helper name (without "@") or digits; empty otherwise. */
  readonly text: string;
  readonly pos: number;
}

const SINGLE_CHAR: Readonly<Record<string, Punctuation>> = {
  ",": ",",
  "!": "!",
  "?": "?",
  "(": "(",
  ")": ")",
  "&": "&",
  "|": "|",
};

const COMPARISON_HINT = 'only ">=" comparisons exist';
const NEGATION_HINT =
  'only a setting can be negated, as in "!setting(name)": item rules must stay monotone';

const isLower = (c: string | undefined) =>
  c !== undefined && c >= "a" && c <= "z";
const isUpper = (c: string | undefined) =>
  c !== undefined && c >= "A" && c <= "Z";
const isDigit = (c: string | undefined) =>
  c !== undefined && c >= "0" && c <= "9";
const isIdentChar = (c: string | undefined) =>
  isLower(c) || isUpper(c) || isDigit(c) || c === "_";
const isSpace = (c: string | undefined) =>
  c === " " || c === "\t" || c === "\n" || c === "\r";

function describe(token: Token): string {
  switch (token.kind) {
    case "eof":
      return "end of input";
    case "helper":
      return `"@${token.text}"`;
    case "ident":
    case "int":
      return `"${token.text}"`;
    default:
      return `"${token.kind}"`;
  }
}

/**
 * Recursive descent over a lazily lexed token stream: tokens are read only as
 * far as the parse has got, so the first error in reading order is the one
 * reported, whether it is lexical or syntactic.
 */
class Parser {
  private readonly source: string;
  private offset = 0;
  private lookahead: Token | undefined;

  constructor(source: string) {
    this.source = source;
  }

  parseRequirement(): Expr {
    const expr = this.parseOr();
    const token = this.peek();
    if (token.kind !== "eof") {
      throw this.unexpected(token, '"&", "|" or end of input');
    }
    return expr;
  }

  private parseOr(): Expr {
    const first = this.parseAnd();
    if (this.peek().kind !== "|") return first;
    const args: Expr[] = [];
    pushFlat(args, first, "or");
    while (this.peek().kind === "|") {
      this.next();
      pushFlat(args, this.parseAnd(), "or");
    }
    return { args, type: "or" };
  }

  private parseAnd(): Expr {
    const first = this.parseUnary();
    if (this.peek().kind !== "&") return first;
    const args: Expr[] = [];
    pushFlat(args, first, "and");
    while (this.peek().kind === "&") {
      this.next();
      pushFlat(args, this.parseUnary(), "and");
    }
    return { args, type: "and" };
  }

  private parseUnary(): Expr {
    if (this.peek().kind === "?") {
      this.next();
      return { expr: this.parseUnary(), type: "maybe" };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const token = this.next();
    switch (token.kind) {
      case "(":
        return this.parseGroup();
      case "helper":
        return { name: token.text, type: "helper" };
      case "ident":
        return this.parseWord(token);
      case "!":
        return this.parseNegation(token);
      default:
        throw this.unexpected(token, 'an item, a "@helper", "?" or "("');
    }
  }

  /** After "!": only `setting(name)` may follow. */
  private parseNegation(bang: Token): Expr {
    const word = this.peek();
    if (word.kind !== "ident" || word.text !== "setting") {
      throw this.error(bang.pos, 'Unexpected "!"', NEGATION_HINT);
    }
    this.next();
    return {
      name: this.parseParenthesizedName("setting", "a setting name"),
      negated: true,
      type: "setting",
    };
  }

  /** After "(": a whole requirement, then ")". */
  private parseGroup(): Expr {
    const expr = this.parseOr();
    const token = this.next();
    if (token.kind !== ")") throw this.unexpected(token, '"&", "|" or ")"');
    return expr;
  }

  private parseWord(token: Token): Expr {
    switch (token.text) {
      case "true":
        return { type: "const", value: "yes" };
      case "false":
        return { type: "const", value: "no" };
      case "maybe":
        if (this.peek().kind !== "(") return { type: "const", value: "maybe" };
        this.next();
        return { expr: this.parseGroup(), type: "maybe" };
      case "count":
        return this.parseCount();
      case "setting":
        return {
          name: this.parseParenthesizedName("setting", "a setting name"),
          negated: false,
          type: "setting",
        };
      case "reach":
        return {
          region: this.parseParenthesizedName("reach", "a region name"),
          type: "reach",
        };
      default: {
        if (this.peek().kind !== ">=") {
          return { min: 1, name: token.text, type: "item" };
        }
        this.next();
        return { min: this.parseThreshold(), name: token.text, type: "item" };
      }
    }
  }

  /** After a keyword such as "setting": `( name )`. */
  private parseParenthesizedName(keyword: string, what: string): string {
    const open = this.next();
    if (open.kind !== "(") {
      throw this.unexpected(open, `"(" after "${keyword}"`);
    }
    const name = this.next();
    if (name.kind !== "ident" || RESERVED_WORDS.has(name.text)) {
      throw this.unexpected(name, what);
    }
    const close = this.next();
    if (close.kind !== ")") throw this.unexpected(close, '")"');
    return name.text;
  }

  /** After "count": `( name { , name } ) >= threshold`. */
  private parseCount(): Expr {
    const open = this.next();
    if (open.kind !== "(") throw this.unexpected(open, '"(" after "count"');
    const names: string[] = [];
    for (;;) {
      const name = this.next();
      if (name.kind !== "ident" || RESERVED_WORDS.has(name.text)) {
        throw this.unexpected(name, "an item or group name");
      }
      names.push(name.text);
      const separator = this.next();
      if (separator.kind === ")") break;
      if (separator.kind !== ",")
        throw this.unexpected(separator, '"," or ")"');
    }
    const comparison = this.next();
    if (comparison.kind !== ">=") {
      throw this.unexpected(comparison, '">=" after "count(...)"');
    }
    return { min: this.parseThreshold(), names, type: "count" };
  }

  /** After ">=": an integer or `setting(name)`. */
  private parseThreshold(): Threshold {
    const token = this.next();
    if (token.kind === "ident" && token.text === "setting") {
      return {
        setting: this.parseParenthesizedName("setting", "a setting name"),
      };
    }
    if (token.kind !== "int") {
      throw this.unexpected(token, 'an integer or "setting(name)" after ">="');
    }
    const value = Number(token.text);
    if (!Number.isSafeInteger(value)) {
      throw this.error(token.pos, `Integer ${token.text} is too large`);
    }
    return value;
  }

  private peek(): Token {
    this.lookahead ??= this.lex();
    return this.lookahead;
  }

  private next(): Token {
    const token = this.peek();
    this.lookahead = undefined;
    return token;
  }

  private lex(): Token {
    const source = this.source;
    let i = this.offset;
    while (isSpace(source[i])) i++;
    const pos = i;
    const c = source[i];
    if (c === undefined) {
      this.offset = i;
      return { kind: "eof", pos, text: "" };
    }

    const single = SINGLE_CHAR[c];
    if (single !== undefined) {
      this.offset = i + 1;
      return { kind: single, pos, text: "" };
    }
    if (c === ">" && source[i + 1] === "=") {
      this.offset = i + 2;
      return { kind: ">=", pos, text: "" };
    }
    if (c === "@") {
      if (!isLower(source[i + 1])) {
        throw this.error(i + 1, 'Expected a helper name after "@"');
      }
      i += 2;
      while (isIdentChar(source[i])) i++;
      this.offset = i;
      return { kind: "helper", pos, text: source.slice(pos + 1, i) };
    }
    if (isDigit(c)) {
      while (isDigit(source[i])) i++;
      this.offset = i;
      return { kind: "int", pos, text: source.slice(pos, i) };
    }
    if (isLower(c)) {
      while (isIdentChar(source[i])) i++;
      this.offset = i;
      return { kind: "ident", pos, text: source.slice(pos, i) };
    }

    const shown = JSON.stringify(c);
    if (c === ">" || c === "<" || c === "=") {
      throw this.error(pos, `Unexpected ${shown}`, COMPARISON_HINT);
    }
    if (c === "~") {
      throw this.error(pos, `Unexpected ${shown}`, NEGATION_HINT);
    }
    if (isUpper(c)) {
      throw this.error(
        pos,
        `Unexpected ${shown}`,
        "names start with a lowercase letter",
      );
    }
    throw this.error(pos, `Unexpected character ${shown}`);
  }

  private unexpected(token: Token, expected: string): ParseError {
    return this.error(
      token.pos,
      `Expected ${expected} but found ${describe(token)}`,
    );
  }

  private error(pos: number, message: string, hint?: string): ParseError {
    const suffix = hint === undefined ? "" : ` (${hint})`;
    return new ParseError(
      `${message} at position ${pos}${suffix}`,
      this.source,
      pos,
    );
  }
}

/** Appends `expr`, splicing in its arguments when it is the same operator. */
function pushFlat(args: Expr[], expr: Expr, type: "and" | "or"): void {
  if ((expr.type === "and" || expr.type === "or") && expr.type === type) {
    args.push(...expr.args);
  } else {
    args.push(expr);
  }
}

/** Parses a requirement; throws a `ParseError` naming the position. */
export function parse(source: string): Expr {
  return new Parser(source).parseRequirement();
}
