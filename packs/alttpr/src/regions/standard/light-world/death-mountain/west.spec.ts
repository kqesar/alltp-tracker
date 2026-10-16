// The branches of West Death Mountain that upstream's tests cannot reach:
// they run with the lamp rule on and swords, and say nothing of what the
// player sees. The contract covers the rest (test/contract.spec.ts).
import { type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../../../pack";
import {
  type AlttprSettings,
  OPEN,
  STANDARD,
  settingsFromUpstream,
} from "../../../../settings";

const ETHER = "ether-tablet";
const ROCK = "spectacle-rock";
const NO_LAMP = settingsFromUpstream("open", { "item.require.Lamp": 0 });
/** On the tablet's ledge, by the flute and the mirror, with the Book. */
const LEDGE = { bookOfMudora: 1, flute: 1, magicMirror: 1, rescueZelda: 1 };

const solved = (settings: AlttprSettings, state: State) =>
  solve(compile(settings), state);

describe("West Death Mountain", () => {
  it("is climbed by the flute, or by a glove and the lamp the customizer may drop", () => {
    const glove = { glove: 1, rescueZelda: 1 };
    const region = (settings: AlttprSettings, state: State) =>
      solved(settings, state).region("westDeathMountain");
    expect(region(OPEN, glove)).toBe("no");
    expect(region(OPEN, { ...glove, lamp: 1 })).toBe("yes");
    expect(region(NO_LAMP, glove)).toBe("yes");
    expect(region(OPEN, { flute: 1, rescueZelda: 1 })).toBe("yes");
    // Not before Zelda is rescued
    expect(region(STANDARD, { flute: 1 })).toBe("no");
  });

  it("lights the Old Man's way with the lamp, unless the customizer drops the rule", () => {
    const up = { flute: 1, rescueZelda: 1 };
    expect(solved(OPEN, up).location("old-man")).toBe("no");
    expect(solved(OPEN, { ...up, lamp: 1 }).location("old-man")).toBe("yes");
    expect(solved(NO_LAMP, up).location("old-man")).toBe("yes");
  });

  it("gives the Ether tablet to the hammer, swordless", () => {
    const swordless = settingsFromUpstream("open", {
      "mode.weapons": "swordless",
    });
    const hammer = { ...LEDGE, hammer: 1 };
    expect(solved(swordless, hammer).location(ETHER)).toBe("yes");
    expect(solved(swordless, LEDGE).location(ETHER)).toBe("no");
    expect(solved(OPEN, hammer).location(ETHER)).toBe("no");
    expect(solved(OPEN, { ...LEDGE, sword: 2 }).location(ETHER)).toBe("yes");
  });

  it("shows the Ether tablet to the Book on its ledge, and Spectacle Rock from below", () => {
    expect(solved(OPEN, LEDGE).location(ETHER)).toBe("no");
    expect(solved(OPEN, LEDGE).visible(ETHER)).toBe("yes");
    // Without the Book, or below the ledge, the tablet says nothing
    expect(solved(OPEN, { ...LEDGE, bookOfMudora: 0 }).visible(ETHER)).toBe(
      "no",
    );
    expect(solved(OPEN, { ...LEDGE, magicMirror: 0 }).visible(ETHER)).toBe(
      "no",
    );
    const below = { flute: 1, rescueZelda: 1 };
    expect(solved(OPEN, below).location(ROCK)).toBe("no");
    expect(solved(OPEN, below).visible(ROCK)).toBe("yes");
    expect(solved(OPEN, { rescueZelda: 1 }).visible(ROCK)).toBe("no");
  });
});
