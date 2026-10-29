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
