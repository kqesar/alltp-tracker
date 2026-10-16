import { describe, expect, it } from "vitest";
import {
  and,
  compare,
  fromRank,
  or,
  rank,
  soften,
  TRI_VALUES,
  type Tri,
} from "./tri";

const ALL: readonly Tri[] = TRI_VALUES;

describe("Kleene truth tables", () => {
  // Written out in full rather than derived from min/max, so a swapped or
  // mis-ordered implementation cannot also be the oracle.
  it.each<[Tri, Tri, Tri]>([
    ["yes", "yes", "yes"],
    ["yes", "maybe", "maybe"],
    ["yes", "no", "no"],
    ["maybe", "yes", "maybe"],
    ["maybe", "maybe", "maybe"],
    ["maybe", "no", "no"],
    ["no", "yes", "no"],
    ["no", "maybe", "no"],
    ["no", "no", "no"],
  ])("%s and %s is %s", (a, b, expected) => {
    expect(and(a, b)).toBe(expected);
  });

  it.each<[Tri, Tri, Tri]>([
    ["yes", "yes", "yes"],
    ["yes", "maybe", "yes"],
    ["yes", "no", "yes"],
    ["maybe", "yes", "yes"],
    ["maybe", "maybe", "maybe"],
    ["maybe", "no", "maybe"],
    ["no", "yes", "yes"],
    ["no", "maybe", "maybe"],
    ["no", "no", "no"],
  ])("%s or %s is %s", (a, b, expected) => {
    expect(or(a, b)).toBe(expected);
  });

  it.each<[Tri, Tri]>([
    ["yes", "yes"],
    ["maybe", "maybe"],
    ["no", "maybe"],
  ])("soften(%s) is %s", (value, expected) => {
    expect(soften(value)).toBe(expected);
  });

  it("takes any number of operands, with yes and no as identities", () => {
    expect(and()).toBe("yes");
    expect(or()).toBe("no");
    expect(and("yes", "maybe", "yes")).toBe("maybe");
    expect(and("yes", "maybe", "no")).toBe("no");
    expect(or("no", "maybe", "no")).toBe("maybe");
    expect(or("no", "maybe", "yes")).toBe("yes");
  });
});

describe("order", () => {
  it("ranks no < maybe < yes and round-trips through fromRank", () => {
    expect(ALL.map(rank)).toEqual([0, 1, 2]);
    expect([0, 1, 2].map((level) => fromRank(level as 0 | 1 | 2))).toEqual([
      "no",
      "maybe",
      "yes",
    ]);
  });

  it("compares by rank", () => {
    expect(compare("no", "maybe")).toBeLessThan(0);
    expect(compare("maybe", "yes")).toBeLessThan(0);
    expect(compare("yes", "no")).toBeGreaterThan(0);
    expect(compare("maybe", "maybe")).toBe(0);
  });
});

describe("lattice laws, checked on every combination", () => {
  const triples = ALL.flatMap((a) =>
    ALL.flatMap((b) => ALL.map((c): [Tri, Tri, Tri] => [a, b, c])),
  );

  it("and/or are commutative, associative and idempotent", () => {
    for (const [a, b, c] of triples) {
      expect(and(a, b)).toBe(and(b, a));
      expect(or(a, b)).toBe(or(b, a));
      expect(and(and(a, b), c)).toBe(and(a, and(b, c)));
      expect(or(or(a, b), c)).toBe(or(a, or(b, c)));
      expect(and(a, a)).toBe(a);
      expect(or(a, a)).toBe(a);
    }
  });

  it("and/or distribute over each other and absorb", () => {
    for (const [a, b, c] of triples) {
      expect(and(a, or(b, c))).toBe(or(and(a, b), and(a, c)));
      expect(or(a, and(b, c))).toBe(and(or(a, b), or(a, c)));
      expect(and(a, or(a, b))).toBe(a);
      expect(or(a, and(a, b))).toBe(a);
    }
  });

  it("every operator is monotone", () => {
    for (const [a, b, c] of triples) {
      if (compare(a, b) > 0) continue;
      // a <= b, so each operator applied to b is at least as high.
      expect(compare(and(a, c), and(b, c))).toBeLessThanOrEqual(0);
      expect(compare(or(a, c), or(b, c))).toBeLessThanOrEqual(0);
      expect(compare(soften(a), soften(b))).toBeLessThanOrEqual(0);
    }
  });
});
