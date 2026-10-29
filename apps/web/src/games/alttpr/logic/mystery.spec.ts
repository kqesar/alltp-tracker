// A Mystery run whose glitches or entrance shuffle are not known yet: the
// map is sound, saying yes or no to nothing the seed it turns out to be
// would not (the pack's own Mystery soundness, src/mystery.spec.ts, for the
// settings the pack leaves unknown).
import type { Tri } from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  items as freshItems,
  type ItemState,
  itemsMax,
} from "@/games/alttpr/data/items";
import {
  getPreset,
  HIDEABLE,
  type RunSettings,
} from "@/games/alttpr/data/presets";
import { goModeStatusOf } from "@/games/alttpr/logic/missing";
import { glitchBounds } from "@/games/alttpr/logic/settings";
import {
  type Inputs,
  meetTri,
  solutionOf,
} from "@/games/alttpr/logic/solution";
import END_GAME from "../../../../e2e/fixtures/end-game.json";

/** Every value a hidden glitches setting may turn out to have. */
const COMPLETIONS: readonly Partial<RunSettings>[] = [
  {},
  { glitches: "overworld_glitches" },
  { glitches: "hybrid_major_glitches" },
  { glitches: "major_glitches" },
  { glitches: "no_logic" },
  { glitches: "no_logic", playGlitches: "overworld_glitches" },
  { glitches: "no_logic", playGlitches: "hybrid_major_glitches" },
  { glitches: "no_logic", playGlitches: "major_glitches" },
];

/** The cells a run's items are drawn from, each at any of its levels. */
const CELLS = Object.keys(freshItems).filter((id) => !id.startsWith("chest"));

/** A cell's value: held or not, or any of its levels. */
const levelOf = (id: string): fc.Arbitrary<number | boolean> =>
  typeof freshItems[id] === "boolean"
    ? fc.boolean()
    : fc.integer({ max: itemsMax[id], min: 0 });

/** Some of what a player holds: from nothing to the end of a run. */
const holding: fc.Arbitrary<ItemState> = fc.subarray(CELLS).chain((ids) =>
  fc.tuple(...ids.map(levelOf)).map(
    (levels) =>
      ({
        ...freshItems,
        ...Object.fromEntries(ids.map((id, at) => [id, levels[at]])),
      }) as ItemState,
  ),
);

/** The run with these items, under these settings. */
const inputs = (items: ItemState, settings: RunSettings): Inputs => ({
  items,
  medallions: [],
  settings,
  smallKeys: [],
});

/** Whether `guess` says no more than `truth`: `maybe`, or the same. */
const below = (guess: Tri, truth: Tri) => guess === "maybe" || guess === truth;

describe("meetTri", () => {
  it("is yes with the least permissive's yes, no with the most's no, else maybe", () => {
    expect(meetTri("yes", "yes")).toBe("yes");
    expect(meetTri("maybe", "yes")).toBe("maybe");
    expect(meetTri("no", "yes")).toBe("maybe");
    expect(meetTri("no", "maybe")).toBe("maybe");
    expect(meetTri("no", "no")).toBe("no");
  });
});

describe("a Mystery run whose glitches are not known", () => {
  it.each(["open", "standard", "inverted"] as const)(
    "in %s, is no surer of any check or of the go mode than the run it turns out to be",
    (mode) => {
      const hidden: RunSettings = {
        ...getPreset("open").settings,
        hidden: ["glitches"],
        mode,
      };
      fc.assert(
        fc.property(holding, (items) => {
          const guess = solutionOf(inputs(items, hidden));
          const guessGo = goModeStatusOf(inputs(items, hidden))?.tri;
          for (const completion of COMPLETIONS) {
            const settings = { ...hidden, ...completion };
            delete settings.hidden;
            const truth = solutionOf(inputs(items, settings));
            for (const [id, tri] of Object.entries(guess.tris)) {
              const real = truth.tris[id] ?? "no";
              if (!below(tri, real))
                expect([completion, id, tri]).toEqual([completion, id, real]);
            }
            const truthGo = goModeStatusOf(inputs(items, settings))?.tri;
            if (guessGo !== undefined && truthGo !== undefined) {
              expect([completion, below(guessGo, truthGo)]).toEqual([
                completion,
                true,
              ]);
            }
          }
        }),
        { numRuns: 25 },
      );
    },
  );

  it("lies between the two logics: at least NoGlitches' sure, at most Major Glitches' reach", () => {
    const { state } = END_GAME;
    const hidden: RunSettings = {
      ...(state.settings as RunSettings),
      hidden: ["glitches"],
    };
    const run = inputs(
      { ...state.items, moonPearl: 0, pearl: 0 } as unknown as ItemState,
      hidden,
    );
    const guess = solutionOf(run);
    expect(guess.upper).toBeDefined();
    expect(glitchBounds(hidden)?.upper.canOneFrameClipUW).toBe(true);
    expect(glitchBounds(hidden)?.lower.noLogic).toBe(true);
    expect(glitchBounds(hidden)?.lower.bootsAtStart).toBe(false);
    // Some check is maybe by the glitches alone
    expect(Object.values(guess.tris)).toContain("maybe");
  });

  it("keeps every hidden setting's soundness with the rest hidden too", () => {
    const hidden: RunSettings = {
      ...getPreset("mystery").settings,
      hidden: HIDEABLE.filter((setting) => setting !== "entranceShuffle"),
    };
    fc.assert(
      fc.property(holding, (items) => {
        const guess = solutionOf(inputs(items, hidden));
        for (const completion of COMPLETIONS) {
          const settings: RunSettings = {
            ...hidden,
            ...completion,
            hidden: HIDEABLE.filter(
              (setting) =>
                setting !== "entranceShuffle" && setting !== "glitches",
            ),
          };
          const truth = solutionOf(inputs(items, settings));
          for (const [id, tri] of Object.entries(guess.tris)) {
            const real = truth.tris[id] ?? "no";
            if (!below(tri, real))
              expect([completion, id, tri]).toEqual([completion, id, real]);
          }
        }
      }),
      { numRuns: 10 },
    );
  });
});

describe("a Mystery run whose entrance shuffle is not known", () => {
  it("shows every check maybe until it is set", () => {
    const hidden: RunSettings = {
      ...getPreset("open").settings,
      hidden: ["entranceShuffle"],
    };
    const { state } = END_GAME;
    const guess = solutionOf(inputs(state.items as ItemState, hidden));
    expect(guess.modelled).toBe(false);
    expect(new Set(Object.values(guess.tris))).toEqual(new Set(["maybe"]));
    const set = solutionOf(
      inputs(state.items as ItemState, { ...hidden, hidden: [] }),
    );
    expect(set.modelled).toBe(true);
  });
});
