// Counts a tracker may not know: Link's health (the heart containers and
// pieces found, which upstream's hasHealth sums, ItemCollection.php:546-553)
// and the escape's ten bombs (canKillEscapeThings, ItemCollection.php:562), and
// whether the flute was activated (canFly, ItemCollection.php:415-428), which
// Race Mode never reads.
// A player sees them on the HUD but may leave them unrecorded, and a rule
// that asks for them must not then read "none found": that would put every
// dungeon of the basic placement out of logic for good.
//
// As for the medallion pads (medallions.ts), the state carries the knowledge
// as a fact: `healthUnknown` while the health is not known, `bombsUnknown`
// while the bombs are not. Every rule reading such an item reads it through
// `unknownCountRequirement`: `heartContainer >= 7` becomes
// `heartContainer >= 7 | healthUnknown & maybe`. With the count known (the
// fact at 0) the rule reads as upstream wrote it, so upstream's tests hold
// unchanged; with it unknown, the most it can be is maybe, never a hard no,
// and the counts recorded still bring it in logic. Each atom keeps its own
// fact beside it, so a later rule reading these items is covered as soon as
// it is loaded (`compile`, the tricks world, the entrance randomizer's).

import { type Expr, parse, print } from "@alltp/engine";

/**
 * What a tracker may leave unknown, and the fact that says it is. `heldOnly`:
 * only the item's higher level may be unknown, so the fact holds only while
 * the item is held at all (the flute found, its activation not known: an
 * autotracker in a race reads the flute, never whether the bird woke).
 */
export const UNKNOWN_COUNTS = {
  bombs: { fact: "bombsUnknown", items: ["tenBombs"] },
  flute: { fact: "fluteActivationUnknown", heldOnly: true, items: ["flute"] },
  health: { fact: "healthUnknown", items: ["heartContainer", "pieceOfHeart"] },
} as const;

export type UnknownCount = keyof typeof UNKNOWN_COUNTS;

/** Every fact a rule may read for a count not known. */
export const UNKNOWN_COUNT_FACTS: readonly string[] = Object.values(
  UNKNOWN_COUNTS,
).map(({ fact }) => fact);

/** The fact of each item a tracker may not know, by item id. */
export const UNKNOWN_FACT_OF: ReadonlyMap<string, string> = new Map(
  Object.values(UNKNOWN_COUNTS).flatMap(({ fact, items }) =>
    items.map((item) => [item, fact] as const),
  ),
);

const PATTERN = new RegExp(`\\b(${[...UNKNOWN_FACT_OF.keys()].join("|")})\\b`);

/** `atom | fact & maybe`: the atom, or maybe while its count is not known. */
const orUnknown = (atom: Expr, fact: string): Expr => ({
  args: [
    atom,
    {
      args: [
        { min: 1, name: fact, type: "item" },
        { type: "const", value: "maybe" },
      ],
      type: "and",
    },
  ],
  type: "or",
});

function rewrite(e: Expr): Expr {
  switch (e.type) {
    case "item": {
      const fact = UNKNOWN_FACT_OF.get(e.name);
      return fact === undefined ? e : orUnknown(e, fact);
    }
    case "count": {
      const fact = e.names
        .map((name) => UNKNOWN_FACT_OF.get(name))
        .find((found) => found !== undefined);
      return fact === undefined ? e : orUnknown(e, fact);
    }
    case "maybe":
      return { expr: rewrite(e.expr), type: "maybe" };
    case "and":
    case "or":
      // A node of the same kind as its parent joins its arguments
      return {
        args: e.args
          .map(rewrite)
          .flatMap((a) => (a.type === e.type ? a.args : [a])),
        type: e.type,
      };
    default:
      return e;
  }
}

/**
 * A requirement with every item a tracker may not know read as itself or,
 * while its fact holds, maybe. The same text when it reads none of them.
 */
export function unknownCountRequirement(req: string): string {
  if (!PATTERN.test(req)) return req;
  return print(rewrite(parse(req)));
}

/** What a tracker does not know, by count; one left out is known. */
export type CountKnowledge = Readonly<Partial<Record<UnknownCount, boolean>>>;

/**
 * The facts that hold, each at 1, for the counts not known; a `heldOnly`
 * one only while its item is held in `items`.
 */
export function unknownCountFacts(
  unknown: CountKnowledge,
  items: Readonly<Record<string, number>> = {},
): Readonly<Record<string, number>> {
  const facts: Record<string, number> = {};
  for (const [count, entry] of Object.entries(UNKNOWN_COUNTS)) {
    if (unknown[count as UnknownCount] !== true) continue;
    if ("heldOnly" in entry && !entry.items.some((item) => items[item] > 0)) {
      continue;
    }
    facts[entry.fact] = 1;
  }
  return facts;
}
