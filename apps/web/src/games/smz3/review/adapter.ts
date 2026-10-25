// SMZ3's side of reviewing a finished run: what the run says that a spoiler
// log can contradict (binding), and the run's checks set against the log's
// placements and playthrough (the comparison). Pure: the Review tab draws it.
// The game-agnostic rule (`bindSeed`) is @alltp/spoiler's; this module only
// turns the tracker's run into its terms.
//
// SMZ3's board keeps no timeline, so the comparison says WHAT was checked, not
// WHEN: there is no "found at" and no "late". The playthrough's spheres are
// the seed's own order of reach, shown for reference.

import { type Binding, bindSeed, type Fact } from "@alltp/spoiler";
import {
  byNotable,
  type Held,
  type Labels,
  type Smz3SpoilerLog,
} from "@/games/smz3/review/labels";
import type { Smz3Progress } from "@/games/smz3/store";

/** The run, as far as a review reads it. */
export type ReviewedRun = Pick<
  Smz3Progress,
  "checked" | "pads" | "seed" | "settings"
>;

/** A pad's medallion in the run, or null while the board does not know it. */
const padOf = (pad: string): string | null => (pad === "unknown" ? null : pad);

/**
 * Whether a log is the run's: the guids (the log's, against the one the ROM
 * stated), then every setting and medallion both sides state. A contradiction
 * refuses; a run that knows no guid (tracked by hand) is "not verified".
 */
export const bindRun = (log: Smz3SpoilerLog, run: ReviewedRun): Binding => {
  const { settings, medallions } = log.extra;
  const facts: Fact[] = [
    { file: settings.smLogic, name: "smLogic", run: run.settings.smLogic },
    {
      file: settings.keysanity ? "on" : "off",
      name: "keysanity",
      run: run.settings.keysanity ? "on" : "off",
    },
    {
      file: settings.towerCrystals,
      name: "towerCrystals",
      run: run.settings.towerCrystals,
    },
    {
      file: settings.ganonCrystals,
      name: "ganonCrystals",
      run: run.settings.ganonCrystals,
    },
    {
      file: settings.tourianBosses,
      name: "tourianBosses",
      run: run.settings.tourianBosses,
    },
    {
      file: medallions.mire,
      name: "medallion:mire",
      run: padOf(run.pads.mire),
    },
    {
      file: medallions.turtleRock,
      name: "medallion:turtle-rock",
      run: padOf(run.pads.turtleRock),
    },
  ];
  return bindSeed({ facts, seed: { file: log.seed.id, run: run.seed } });
};

/** One required location of the playthrough, and whether the run checked it. */
export interface SphereRow {
  readonly held: Held;
  readonly checked: boolean;
}

export interface ReviewComparison {
  /** The playthrough's locations by sphere, from 1, in the pack's order within one. */
  readonly spheres: readonly {
    readonly sphere: number;
    readonly rows: readonly SphereRow[];
  }[];
  /** The places the seed placed an item at. */
  readonly total: number;
  /** Those the run checked. */
  readonly checked: number;
  /** The playthrough's locations (those the win needs). */
  readonly required: number;
  /** Those the run checked. */
  readonly requiredChecked: number;
  /** The places not checked, by region, required ones first, then the notable. */
  readonly missed: readonly {
    readonly area: string;
    readonly places: readonly Held[];
  }[];
}

/**
 * The run's checks set against the log, location by location.
 * @param labels - What every location held (`labelsOf` the review)
 * @param run - The run as it stands
 */
export const compareReview = (
  { byLocation }: Labels,
  run: Pick<ReviewedRun, "checked">,
): ReviewComparison => {
  const done = new Set(run.checked);
  const bySphere = new Map<number, SphereRow[]>();
  const open = new Map<string, Held[]>();
  let checked = 0;
  let required = 0;
  let requiredChecked = 0;
  for (const held of byLocation.values()) {
    const isDone = done.has(held.location);
    if (isDone) checked++;
    if (held.sphere !== null) {
      required++;
      if (isDone) requiredChecked++;
      bySphere.set(held.sphere, [
        ...(bySphere.get(held.sphere) ?? []),
        { checked: isDone, held },
      ]);
    }
    if (!isDone) {
      const area = held.area ?? "Elsewhere";
      open.set(area, [...(open.get(area) ?? []), held]);
    }
  }
  return {
    checked,
    missed: [...open]
      .map(([area, places]) => ({ area, places: places.sort(byNotable) }))
      .sort(
        (a, b) =>
          (a.places[0]?.rank ?? 3) - (b.places[0]?.rank ?? 3) ||
          a.area.localeCompare(b.area),
      ),
    required,
    requiredChecked,
    spheres: [...bySphere]
      .sort(([a], [b]) => a - b)
      .map(([sphere, rows]) => ({ rows, sphere })),
    total: byLocation.size,
  };
};
