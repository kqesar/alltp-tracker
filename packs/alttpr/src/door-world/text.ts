// Rules as text, joined the way the world builder adds them (DR's add_rule
// and its 'or'): `true` and `false` dropped where they decide nothing.

/** Both rules: `(a) & (b)`. */
export const and = (...reqs: readonly string[]): string => {
  const kept = reqs.filter((r) => r !== "true");
  if (kept.includes("false")) return "false";
  return kept.length === 0 ? "true" : kept.map((r) => `(${r})`).join(" & ");
};

/** Either rule: `(a) | (b)`. */
export const or = (...reqs: readonly string[]): string => {
  const kept = reqs.filter((r) => r !== "false");
  if (kept.includes("true")) return "true";
  return kept.length === 0 ? "false" : kept.map((r) => `(${r})`).join(" | ");
};

/** The item a fact holds while its location is reached at maybe only. */
export const maybeOf = (fact: string): string => `${fact}__maybe`;

/** A fact as a rule reads it: held, or maybe while reached at maybe. */
export const readFact = (fact: string): string =>
  `(${fact} | ${maybeOf(fact)} & maybe)`;

/**
 * A rule's facts as it reads them (readFact): each fact `read` matches,
 * and a count of facts (OWR's dungeons goal, `count(beatBoss_…) >= 10`)
 * held at its number, or at maybe with those reached at maybe counted.
 */
export function readFacts(req: string, read: RegExp): string {
  const counted = req.replace(
    /count\(([^()]*)\) >= (\d+)/g,
    (whole, args: string, n: string) => {
      const names = args.split(",").map((a) => a.trim());
      if (!names.some((name) => new RegExp(`^${read.source}$`).test(name)))
        return whole;
      const sure = `count(${names.join(", ")}) >= ${n}`;
      const unsure = `count(${[...names, ...names.map(maybeOf)].join(", ")}) >= ${n}`;
      return `\u0000${or(sure, and(unsure, "maybe"))}\u0000`;
    },
  );
  return counted
    .split("\u0000")
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(read, (fact) => readFact(fact)),
    )
    .join("");
}
