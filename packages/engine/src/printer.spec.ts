import { describe, expect, it } from "vitest";
import type { Expr } from "./ast";
import { parse } from "./parser";
import { print } from "./printer";

describe("print", () => {
  it.each<[string, string]>([
    ["a|b&c", "a | b & c"],
    ["(a|b)&c", "(a | b) & c"],
    ["a&(b|c)&d", "a & (b | c) & d"],
    ["((a))", "a"],
    ["sword>=2", "sword >= 2"],
    ["glove >= 1", "glove"],
    ["count(a,b)>=3", "count(a, b) >= 3"],
    ["maybe(lantern)", "?lantern"],
    ["maybe(a & b)", "?(a & b)"],
    ["?sword >= 2", "?(sword >= 2)"],
    ["?count(a) >= 1", "?(count(a) >= 1)"],
    ["??@h", "??@h"],
    ["maybe | false & true", "maybe | false & true"],
    ["setting( open )", "setting(open)"],
    ["! setting(open)&a", "!setting(open) & a"],
    ["maybe(!setting(open))", "?!setting(open)"],
    ["sword>=setting(minSword)", "sword >= setting(minSword)"],
    ["?sword >= setting(minSword)", "?(sword >= setting(minSword))"],
    ["count(c1,c2)>=setting(n)", "count(c1, c2) >= setting(n)"],
    [
      "moonpearl&(hammer|glove>=1&flippers)",
      "moonpearl & (hammer | glove & flippers)",
    ],
  ])("prints %j as %j", (source, expected) => {
    expect(print(parse(source))).toBe(expected);
  });

  it("prints trees the parser never builds as equivalent text", () => {
    const a: Expr = { min: 1, name: "a", type: "item" };
    const b: Expr = { min: 1, name: "b", type: "item" };
    // A nested same-operator node keeps its parentheses...
    expect(
      print({ args: [{ args: [a, b], type: "and" }, a], type: "and" }),
    ).toBe("(a & b) & a");
    expect(print({ args: [{ args: [a, b], type: "or" }, a], type: "or" })).toBe(
      "(a | b) | a",
    );
    // ...and the empty operators print as their identities.
    expect(print({ args: [], type: "and" })).toBe("true");
    expect(print({ args: [], type: "or" })).toBe("false");
  });
});
