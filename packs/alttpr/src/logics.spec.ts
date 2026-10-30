// The glitched logics' laws: each logic's flags hold the one before's
// (config/logic.php), so a logic further along never reads a location or a
// region lower. Hybrid Major Glitches has no upstream test of its own: this
// order, and the cases it shares with Overworld Glitches through it, hold it.
import { rank, type State, solve } from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { derivedFacts } from "./derived";
import { ITEMS } from "./items";
import { MEDALLION_FACTS } from "./medallions";
import { compile } from "./pack";
import {
  LOGIC_FLAGS,
  LOGICS,
  type Logic,
  settingsFromUpstream,
} from "./settings";

/** The logics a seed may be generated for whose flags are listed, in order. */
const PORTED: readonly Logic[] = LOGICS.filter(
  (logic) => logic === "NoGlitches" || LOGIC_FLAGS[logic].length > 0,
);

/** Each item and fact at a random level, most of them not held. */
const anyState: fc.Arbitrary<State> = fc.record(
  Object.fromEntries([
    ...ITEMS.map(({ id, max }) => [
      id,
      fc.nat({ max: 2 * max }).map((n) => Math.max(0, n - max)),
    ]),
    ...MEDALLION_FACTS.map((f) => [f, fc.integer({ max: 1, min: 0 })]),
  ]),
);

describe("the glitched logics", () => {
  it("each turn on the flags of the one before (config/logic.php)", () => {
    expect(PORTED.length).toBeGreaterThan(2);
    for (let i = 1; i < LOGICS.length; i++) {
      const before = LOGIC_FLAGS[LOGICS[i - 1] as Logic];
      const after = LOGIC_FLAGS[LOGICS[i] as Logic];
      if (after.length === 0) continue;
      expect(after, LOGICS[i]).toEqual(expect.arrayContaining([...before]));
    }
  });

  for (const mode of ["open", "standard", "inverted"] as const) {
    const worlds = PORTED.map((logic) => {
      const settings = settingsFromUpstream(mode, { logic });
      return { compiled: compile(settings), logic, settings };
    });

    it(`never read a location or region lower further along (${mode})`, () => {
      fc.assert(
        fc.property(anyState, (items) => {
          const solved = worlds.map(({ compiled, settings }) => {
            const state = { ...items, ...derivedFacts(items, settings) };
            return solve(compiled, state);
          });
          for (let i = 1; i < solved.length; i++) {
            const [before, after] = [solved[i - 1], solved[i]];
            if (before === undefined || after === undefined) continue;
            for (const [id, tri] of Object.entries(before.locations())) {
              if (rank(after.location(id)) < rank(tri)) return false;
            }
            for (const [id, tri] of Object.entries(before.regions())) {
              if (rank(after.region(id)) < rank(tri)) return false;
            }
          }
          return true;
        }),
        { numRuns: 60, seed: 5 },
      );
    });
  }
});
