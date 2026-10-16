import { describe, expect, it } from "vitest";
import type { Expr } from "./ast";
import { ParseError, parse } from "./parser";

const item = (name: string, min = 1): Expr => ({ min, name, type: "item" });
const helper = (name: string): Expr => ({ name, type: "helper" });
const and = (...args: Expr[]): Expr => ({ args, type: "and" });
const or = (...args: Expr[]): Expr => ({ args, type: "or" });
const maybe = (expr: Expr): Expr => ({ expr, type: "maybe" });

describe("parse: valid requirements", () => {
  it.each<[string, Expr]>([
    ["hammer", item("hammer")],
    ["sword >= 2", item("sword", 2)],
    ["glove>=0", item("glove", 0)],
    ["moonPearl_2", item("moonPearl_2")],
    ["true", { type: "const", value: "yes" }],
    ["false", { type: "const", value: "no" }],
    ["maybe", { type: "const", value: "maybe" }],
    ["@canLightTorches", helper("canLightTorches")],
    ["count(crystal) >= 7", { min: 7, names: ["crystal"], type: "count" }],
    ["count( a ,b,c )>=2", { min: 2, names: ["a", "b", "c"], type: "count" }],
    ["?lantern", maybe(item("lantern"))],
    ["maybe(lantern)", maybe(item("lantern"))],
    ["maybe (a | b)", maybe(or(item("a"), item("b")))],
    ["??a", maybe(maybe(item("a")))],
    ["?sword >= 2", maybe(item("sword", 2))],
    ["(a)", item("a")],
    [" \t\n a \r\n", item("a")],
  ])("%j", (source, expected) => {
    expect(parse(source)).toEqual(expected);
  });

  it("binds & tighter than |", () => {
    expect(parse("a | b & c")).toEqual(
      or(item("a"), and(item("b"), item("c"))),
    );
    expect(parse("a & b | c")).toEqual(
      or(and(item("a"), item("b")), item("c")),
    );
    expect(parse("(a | b) & c")).toEqual(
      and(or(item("a"), item("b")), item("c")),
    );
  });

  it("binds ? to the operand right after it", () => {
    expect(parse("?a & b")).toEqual(and(maybe(item("a")), item("b")));
    expect(parse("?(a & b)")).toEqual(maybe(and(item("a"), item("b"))));
    expect(parse("a | ?@h")).toEqual(or(item("a"), maybe(helper("h"))));
  });

  it("keeps and/or flat, through parentheses too", () => {
    expect(parse("a & b & c")).toEqual(and(item("a"), item("b"), item("c")));
    expect(parse("a & (b & c)")).toEqual(and(item("a"), item("b"), item("c")));
    expect(parse("(a | b) | (c | d)")).toEqual(
      or(item("a"), item("b"), item("c"), item("d")),
    );
  });

  it("parses the reference example", () => {
    expect(parse("moonpearl & (hammer | glove >= 1 & flippers)")).toEqual(
      and(
        item("moonpearl"),
        or(item("hammer"), and(item("glove", 1), item("flippers"))),
      ),
    );
  });

  it("reads reserved words only where the grammar expects them", () => {
    // "maybe" is a constant unless a "(" follows; "true1" is a plain name.
    expect(parse("maybe & true1")).toEqual(
      and({ type: "const", value: "maybe" }, item("true1")),
    );
  });
});

describe("parse: invalid requirements name the position", () => {
  it.each<[string, number, string]>([
    ["", 0, 'Expected an item, a "@helper", "?" or "(" but found end of input'],
    ["a &", 3, "found end of input"],
    ["a & & b", 4, 'found "&"'],
    ["a && b", 3, 'found "&"'],
    ["a | b)", 5, 'Expected "&", "|" or end of input but found ")"'],
    ["a b", 2, 'but found "b"'],
    ["(a | b", 6, 'Expected "&", "|" or ")" but found end of input'],
    ["maybe(a", 7, 'Expected "&", "|" or ")"'],
    ["!a", 0, "there is no negation"],
    ["a & ~b", 4, "there is no negation"],
    ["a < 2", 2, 'only ">=" comparisons exist'],
    ["a == 2", 2, 'only ">=" comparisons exist'],
    ["a > 2", 2, 'only ">=" comparisons exist'],
    ["a >= x", 5, 'Expected an integer after ">=" but found "x"'],
    ["a >=", 4, "found end of input"],
    ["a >= 99999999999999999999", 5, "too large"],
    ["Sword", 0, "names start with a lowercase letter"],
    ["a | @", 5, 'Expected a helper name after "@"'],
    ["@ h", 1, 'Expected a helper name after "@"'],
    ["@Canx", 1, 'Expected a helper name after "@"'],
    ["a $ b", 2, 'Unexpected character "$"'],
    ["count & a", 6, 'Expected "(" after "count"'],
    ["count() >= 1", 6, 'Expected an item or group name but found ")"'],
    ["count(a,) >= 1", 8, "Expected an item or group name"],
    ["count(true) >= 1", 6, 'Expected an item or group name but found "true"'],
    ["count(a b) >= 1", 8, 'Expected "," or ")" but found "b"'],
    ["count(a)", 8, 'Expected ">=" after "count(...)" but found end of input'],
    ["true >= 2", 5, 'but found ">="'],
    ["2", 0, 'but found "2"'],
  ])("%j fails at %i", (source, pos, message) => {
    let caught: unknown;
    try {
      parse(source);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ParseError);
    const error = caught as ParseError;
    expect(error.pos).toBe(pos);
    expect(error.source).toBe(source);
    expect(error.name).toBe("ParseError");
    expect(error.message).toContain(message);
    expect(error.message).toContain(`at position ${pos}`);
  });

  it("reports the first error in reading order, lexical or not", () => {
    // The "&" at 4 is a syntax error; the "!" at 6 a lexical one. A lexer
    // run ahead of the parser would report the later one.
    expect(() => parse("a & & !b")).toThrow("at position 4");
  });
});
