// The medallion each pad wants: Misery Mire's and Turtle Rock's CanEnter
// read it (`Medallion switch { Bombos => items.Bombos, ... }`,
// MiseryMire.cs:40, TurtleRock.cs:54), from the world's state. A tracker
// learns it in play, so the pack reads it as knowledge in the state, as the
// ALttPR pack does (packs/alttpr/src/medallions.ts):
//
// - `mireIsEther` and the like, once the player knows what the pad wants;
// - `mireUnknown` while they do not: one medallion then maybe opens the pad,
//   all three surely do;
// - neither: closed.
//
// Knowledge is not monotone, so a state recomputes these facts from what the
// player knows; within one state every rule stays monotone in the items.

export const MEDALLIONS = ["bombos", "ether", "quake"] as const;
export type Medallion = (typeof MEDALLIONS)[number];

export const PADS = ["mire", "turtleRock"] as const;
export type Pad = (typeof PADS)[number];

/** What the player knows of each pad; a pad left out is closed. */
export type PadKnowledge = Partial<
  Readonly<Record<Pad, Medallion | "unknown">>
>;

const capital = (word: string) =>
  `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

/** Every fact a rule may read: `mireIsBombos` ... `turtleRockUnknown`. */
export const MEDALLION_FACTS: readonly string[] = PADS.flatMap((pad) => [
  ...MEDALLIONS.map((medallion) => `${pad}Is${capital(medallion)}`),
  `${pad}Unknown`,
]);

/** The facts that hold, each at 1, for what the player knows. */
export function medallionFacts(
  known: PadKnowledge,
): Readonly<Record<string, number>> {
  const facts: Record<string, number> = {};
  for (const pad of PADS) {
    const medallion = known[pad];
    if (medallion === undefined) continue;
    facts[
      medallion === "unknown"
        ? `${pad}Unknown`
        : `${pad}Is${capital(medallion)}`
    ] = 1;
  }
  return facts;
}

/** Whether the player holds what the pad wants, as far as they know it. */
const padRule = (pad: Pad) =>
  [
    ...MEDALLIONS.map((m) => `${pad}Is${capital(m)} & ${m}`),
    `${pad}Unknown & (bombos & ether & quake | maybe & (bombos | ether | quake))`,
  ].join(" | ");

export const MEDALLION_HELPERS = {
  hasMireMedallion: padRule("mire"),
  hasTurtleRockMedallion: padRule("turtleRock"),
} as const;
