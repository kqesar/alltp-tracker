// The medallion each pad wants. Misery Mire's and Turtle Rock's ways in need
// it (MiseryMire.php:136-138, TurtleRock.php:88-90), and upstream reads it as
// the item placed at a location of Medallions.php. A tracker learns it in
// play, so the pack reads it as knowledge in the state, beside the items:
//
// - `mireIsEther` and the like, once the player knows what the pad wants;
// - `mireUnknown` while they do not: one medallion then maybe opens the pad,
//   all three surely do;
// - neither, as upstream's tests read a pad nothing was placed at: closed.
//
// Knowledge is not monotone (learning "Ether" turns Bombos alone from maybe
// to no), so a state recomputes these facts from what the player knows
// (packages/engine/README.md, open question 6). Within one state every rule
// stays monotone in the items.
import type { Rule } from "./helpers";

export const MEDALLIONS = ["bombos", "ether", "quake"] as const;
export type Medallion = (typeof MEDALLIONS)[number];

/** The pads, under the prefix of their facts. */
export const PADS = {
  mire: "Misery Mire Medallion",
  turtleRock: "Turtle Rock Medallion",
} as const;
export type Pad = keyof typeof PADS;

/** What the player knows of each pad; a pad left out is closed. */
export type PadKnowledge = Partial<
  Readonly<Record<Pad, Medallion | "unknown">>
>;

const capital = (word: string) =>
  `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

/** Every fact a rule may read: `mireIsBombos` … `turtleRockUnknown`. */
export const MEDALLION_FACTS: readonly string[] = Object.keys(PADS).flatMap(
  (pad) => [
    ...MEDALLIONS.map((medallion) => `${pad}Is${capital(medallion)}`),
    `${pad}Unknown`,
  ],
);

/** The facts that hold, each at 1, for what the player knows. */
export function medallionFacts(
  known: PadKnowledge,
): Readonly<Record<string, number>> {
  const facts: Record<string, number> = {};
  for (const [pad, medallion] of Object.entries(known)) {
    if (medallion === undefined) continue;
    facts[
      medallion === "unknown"
        ? `${pad}Unknown`
        : `${pad}Is${capital(medallion)}`
    ] = 1;
  }
  return facts;
}

/**
 * Upstream's placements, `['Misery Mire Medallion' => 'Ether']`, as pad
 * knowledge. Throws on a location or an item that is not a pad's medallion,
 * which a state could not carry.
 */
export function padsFromUpstream(
  placed: Readonly<Record<string, string>>,
): PadKnowledge {
  const known: Partial<Record<Pad, Medallion>> = {};
  for (const [location, item] of Object.entries(placed)) {
    const pad = (Object.keys(PADS) as Pad[]).find((p) => PADS[p] === location);
    const medallion = MEDALLIONS.find((m) => capital(m) === item);
    if (pad === undefined || medallion === undefined) {
      throw new RangeError(`Cannot place ${item} at ${location}`);
    }
    known[pad] = medallion;
  }
  return known;
}

/** Whether the player holds what the pad wants, as far as they know it. */
const padRule = (pad: Pad) =>
  [
    ...MEDALLIONS.map((m) => `${pad}Is${capital(m)} & ${m}`),
    `${pad}Unknown & (bombos & ether & quake | maybe & (bombos | ether | quake))`,
  ].join(" | ");

/**
 * `(Pad->hasItem(Bombos) && has('Bombos')) || …` for both pads. The sword
 * the pads also want (or swordless) stays in the regions' rules, as upstream
 * writes it beside this.
 */
export const MEDALLION_RULES = {
  hasMireMedallion: {
    req: padRule("mire"),
    source: "app/Region/Standard/MiseryMire.php:136",
  },
  hasTurtleRockMedallion: {
    req: padRule("turtleRock"),
    source: "app/Region/Standard/TurtleRock.php:88",
  },
} as const satisfies Readonly<Record<string, Rule>>;
