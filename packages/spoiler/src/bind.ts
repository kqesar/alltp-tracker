import { type Refusal, refuse } from "./result";

export type FactValue = string | number | boolean;

/** One thing both the run and the file can state, compared as written. */
export interface Fact {
  /** What it is, for the sentence: "logic", "crystals to open Ganon's Tower". */
  readonly name: string;
  /** The run's value, or null when the run does not say. */
  readonly run: FactValue | null;
  /** The file's value, or null when the file does not say. */
  readonly file: FactValue | null;
}

/** What a game's adapter gathers before it asks whether a log belongs to a run. */
export interface Evidence {
  /** The seed ids each side holds: an ALttPR hash, an SMZ3 guid; null where unknown. */
  readonly seed: {
    readonly run: string | null;
    readonly file: string | null;
  };
  /** Settings and board facts both sides state (medallions, prizes, objectives). */
  readonly facts: readonly Fact[];
}

export type Binding =
  /** The seeds are the same: this log is the run's. */
  | { readonly verdict: "verified"; readonly facts: number }
  /** Nothing proves it and nothing contradicts it; `facts` agreed. */
  | { readonly verdict: "not-verified"; readonly facts: number }
  | { readonly verdict: "refused"; readonly refusal: Refusal };

/**
 * Whether a log is the run's, by the rule every game follows: refuse on any
 * contradiction, open with a "not verified" note when nothing proves or
 * contradicts, verified when the seed ids are equal.
 *
 * - Two seed ids that differ refuse as `seed-differs`, `detail` "<run's> / <file's>".
 * - A fact stated by both sides with two values refuses as `settings-differ`,
 *   the first such fact naming itself in `detail`.
 * - A side that does not state a seed or a fact contradicts nothing.
 */
export function bindSeed(evidence: Evidence): Binding {
  const { run, file } = evidence.seed;
  if (run !== null && file !== null && run !== file) {
    return {
      refusal: refuse("seed-differs", `${run} / ${file}`),
      verdict: "refused",
    };
  }
  let agreed = 0;
  for (const fact of evidence.facts) {
    if (fact.run === null || fact.file === null) continue;
    if (fact.run !== fact.file) {
      return {
        refusal: refuse(
          "settings-differ",
          `${fact.name}: ${String(fact.run)} / ${String(fact.file)}`,
        ),
        verdict: "refused",
      };
    }
    agreed++;
  }
  const verdict = run !== null && file !== null ? "verified" : "not-verified";
  return { facts: agreed, verdict };
}
