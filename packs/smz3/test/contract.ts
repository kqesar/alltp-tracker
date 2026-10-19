// The contract the pack is held to: upstream's logic tests, as LogicTests.cs
// runs them (Randomizer.SMZ3.Tests/Logic/LogicTests.cs:107-137). A case's
// arrangement reaches its region or location; each skip of it does not.
// Upstream's `true` is the pack's `yes`; its `false` is anything but `yes`,
// since a tracker may say maybe where the randomizer knows.
import type { Tri } from "@alltp/engine";
import type { FixtureHeader, UpstreamCase } from "./fixtures";

/** One inventory and its placements, and whether upstream reaches with it. */
export interface Arrangement {
  readonly items: Readonly<Record<string, number>>;
  readonly placed: Readonly<Record<string, string>>;
  readonly expected: boolean;
  /** What was skipped, for a failure's message. */
  readonly skipped: string;
}

/** What a case asks: the whole of it, then each skip. */
export function arrangements(
  c: UpstreamCase,
  always: readonly string[] = [],
): Arrangement[] {
  const withAlways = (items: Readonly<Record<string, number>>) => {
    const all: Record<string, number> = { ...items };
    for (const type of always) all[type] = 1;
    return all;
  };
  const placed = c.placed ?? {};
  return [
    { expected: true, items: withAlways(c.items), placed, skipped: "nothing" },
    ...c.without.map((skip) => {
      if (skip.unplace !== undefined) {
        const rest = { ...placed };
        delete rest[skip.unplace];
        return {
          expected: false,
          items: withAlways(c.items),
          placed: rest,
          skipped: `the item at ${skip.unplace}`,
        };
      }
      return {
        expected: false,
        items: withAlways({ ...c.items, ...skip.items }),
        placed,
        skipped: JSON.stringify(skip.items),
      };
    }),
  ];
}

/** What the subject under contract says of a region or a location. */
export type Subject = (
  header: FixtureHeader,
  kind: "region" | "location",
  name: string,
  arrangement: Arrangement,
) => Tri;

export const contractHolds = (expected: boolean, got: Tri) =>
  expected ? got === "yes" : got !== "yes";

/** A case the subject breaks, in words. */
export interface Breach {
  readonly kind: "region" | "location";
  readonly name: string;
  /** The arrangement's items, upstream item type to count. */
  readonly items: Readonly<Record<string, number>>;
  readonly skipped: string;
  readonly expected: boolean;
  readonly got: Tri;
}

/** Every breach of a fixture's cases by the subject. */
export function breaches(
  header: FixtureHeader,
  cases: readonly UpstreamCase[],
  subject: Subject,
): Breach[] {
  const found: Breach[] = [];
  for (const c of cases) {
    const kind = c.region === undefined ? "location" : "region";
    const name = c.region ?? c.location ?? "";
    for (const arrangement of arrangements(c, header.always)) {
      const got = subject(header, kind, name, arrangement);
      if (!contractHolds(arrangement.expected, got)) {
        found.push({
          expected: arrangement.expected,
          got,
          items: arrangement.items,
          kind,
          name,
          skipped: arrangement.skipped,
        });
      }
    }
  }
  return found;
}
