// The branch of the Hookshot Cave that upstream's tests cannot reach: they
// set no item placement, so its boots way is always open there. The
// contract covers the rest (test/contract.spec.ts).
import { solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../../../pack";
import { OPEN, settingsFromUpstream } from "../../../../settings";

const BOTTOM_RIGHT = "hookshot-cave/bottom-right";
/**
 * The Dark World's East Death Mountain without the hookshot: the mirror to
 * Tower of Hera, the hammer to the east, the titan's mitt to the Dark World.
 */
const DARK = {
  flute: 1,
  glove: 2,
  hammer: 1,
  magicMirror: 1,
  moonPearl: 1,
  rescueZelda: 1,
};

describe("Hookshot Cave", () => {
  it("lets the boots cross to its bottom right chest, but for the basic placement", () => {
    const basic = settingsFromUpstream("open", { itemPlacement: "basic" });
    const boots = { ...DARK, pegasusBoots: 1 };
    expect(solve(compile(OPEN), boots).location(BOTTOM_RIGHT)).toBe("yes");
    expect(solve(compile(basic), boots).location(BOTTOM_RIGHT)).toBe("no");
    expect(
      solve(compile(basic), { ...boots, hookshot: 1 }).location(BOTTOM_RIGHT),
    ).toBe("yes");
    // The other chests want the hookshot whatever the placement
    expect(solve(compile(OPEN), boots).location("hookshot-cave/top-left")).toBe(
      "no",
    );
  });
});
