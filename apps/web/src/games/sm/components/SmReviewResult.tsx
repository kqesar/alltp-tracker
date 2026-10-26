import { type MapRandoLog, smItem } from "@alltp/pack-sm";
import { useId, useMemo } from "react";
import {
  byArea,
  type CountedRow,
  compareItems,
  seedFacts,
  whereWords,
} from "@/games/sm/review/adapter";
import { useSmStore } from "@/games/sm/store";
import type { Stamp } from "@/games/stamp";
import type { Loaded } from "@/review/store";
import { formatTime } from "@/utils/runTimer";

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** "Missiles", "Energy Tanks": a counted item's name in the plural. */
const pluralName = (id: string): string => `${smItem(id).name}s`;

/** When a place was found: the run timer's reading then, or none before it started. */
const FoundAt = ({ stamp }: { stamp: Stamp }) =>
  stamp.ms === null ? (
    <span title="Before the timer started">Found</span>
  ) : (
    <>
      Found at{" "}
      <time dateTime={`PT${Math.floor(stamp.ms / 1000)}S`}>
        {formatTime(stamp.ms)}
      </time>
    </>
  );

/** How many of a pack or tank type the board holds, against those the seed placed. */
const countWords = (
  { held, placed }: CountedRow,
  mode: "locations" | "counts",
): string => {
  if (mode === "locations") {
    return held === placed
      ? `All ${placed} found`
      : `${held} of ${placed} found, ${placed - held} never found`;
  }
  if (held >= placed) {
    return held === placed
      ? `All ${placed} held`
      : `${held} held, ${placed} placed (the rest are starting items)`;
  }
  return `${held} of ${placed} held, ${placed - held} never found`;
};

/** The seed's own facts: start, objectives, what a pack gives. */
const Facts = ({ log }: { log: MapRandoLog }) => (
  <dl className="review-facts" data-testid="review-facts">
    {seedFacts(log).map(([name, value]) => (
      <div className="review-facts__row" key={name}>
        <dt>{name}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);

/**
 * The review of a finished Super Metroid run: what the Map Rando spoiler log
 * says, set against the run. When autotracking read the game's collected
 * bits, place by place: found, and when, or not. For a run tracked by hand,
 * against the items the board holds, which cannot tell the place: where each
 * item was, in which step of the seed's playthrough, and which items the run
 * never got. A lazy chunk: it loads once a review is open.
 */
const SmReviewResult = ({ review }: { review: Loaded }) => {
  const log = review.log as MapRandoLog;
  const items = useSmStore((state) => state.items);
  const found = useSmStore((state) => state.found);
  const comparison = useMemo(
    () => compareItems(log, items, found),
    [log, items, found],
  );
  const { counted, majors, mode, partial, stamps, summary } = comparison;
  const byPlace = mode === "locations";
  const titleId = useId();
  const majorsId = useId();
  const packsId = useId();
  const factsId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="review-result sm-review"
      data-testid="review-result"
    >
      <h2 className="board-panel__heading" id={titleId}>
        Review
      </h2>

      <section
        aria-labelledby={majorsId}
        className="run-section"
        data-testid="review-majors"
      >
        <h3 className="run-section__title" id={majorsId}>
          Items the seed placed once
        </h3>
        <p className="run-section__empty" data-testid="review-mode">
          A step is a round of the seed's playthrough: the item sits where it
          first becomes reachable.{" "}
          {byPlace
            ? "Autotracking saw which places you took, and the run timer's time then. A place seen when it connected, mid-run, is dated by that moment."
            : `${partial ? "Autotracking did not see every find (Race Mode was on for part of the run, or an item was marked by hand), so the places are not trusted. " : ""}The board knows which items you hold, not which location you took them from, so it can tell an item never found, not a location left unchecked.`}
        </p>
        <section
          aria-labelledby={majorsId}
          className="review-table-wrap"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a table wider than a phone scrolls sideways, and a keyboard must reach it
          tabIndex={0}
        >
          <table aria-labelledby={majorsId} className="review-table">
            <caption
              className="review-table__caption"
              data-testid="review-caption"
            >
              {plural(summary.majors, "item")}:{" "}
              {summary.majors - summary.neverFound} {byPlace ? "found" : "held"}
              , {summary.neverFound} {byPlace ? "not found" : "never found"}.
            </caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Where</th>
                <th scope="col">Step</th>
                <th scope="col">Your run</th>
              </tr>
            </thead>
            <tbody>
              {majors.map(({ held, id, placement, stamp }) => (
                <tr
                  data-state={held ? "found" : "missed"}
                  data-testid={`review-row-${placement.location}`}
                  key={placement.location}
                >
                  <th scope="row">{smItem(id).name}</th>
                  <td>{whereWords(placement)}</td>
                  <td>{placement.sphere ?? "none"}</td>
                  <td>
                    {byPlace ? (
                      stamp === null ? (
                        "Not found"
                      ) : (
                        <FoundAt stamp={stamp} />
                      )
                    ) : held ? (
                      "Held"
                    ) : (
                      "Never found"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>

      <section
        aria-labelledby={packsId}
        className="run-section"
        data-testid="review-packs"
      >
        <h3 className="run-section__title" id={packsId}>
          Tanks and packs{" "}
          <span className="run-section__count">
            {summary.packsLeft} never found
          </span>
        </h3>
        <ul className="review-missed">
          {counted.map((row) => (
            <li data-testid={`review-pack-${row.id}`} key={row.id}>
              <strong>{pluralName(row.id)}</strong>: {countWords(row, mode)}
            </li>
          ))}
        </ul>
        <details className="review-others" data-testid="review-places">
          <summary>Where every tank and pack was, by area</summary>
          {byArea(counted.flatMap((row) => row.places)).map(
            ([area, places]) => (
              <section key={area}>
                <h4 className="sm-review__area">
                  {area} ({places.length})
                </h4>
                <ul className="review-missed">
                  {places.map((placement) => {
                    const stamp = byPlace
                      ? (stamps as Readonly<Record<string, Stamp | undefined>>)[
                          placement.location
                        ]
                      : undefined;
                    return (
                      <li
                        data-state={
                          byPlace ? (stamp ? "found" : "missed") : undefined
                        }
                        data-testid={`review-place-${placement.location}`}
                        key={placement.location}
                      >
                        <strong>{smItem(placement.item ?? "").name}</strong>:{" "}
                        {placement.locationName}
                        {placement.sphere === null
                          ? ""
                          : ` (step ${placement.sphere})`}
                        {byPlace ? (
                          <>
                            {" — "}
                            {stamp ? <FoundAt stamp={stamp} /> : "Not found"}
                          </>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )}
        </details>
      </section>

      <section aria-labelledby={factsId} className="run-section">
        <h3 className="run-section__title" id={factsId}>
          The seed
        </h3>
        <Facts log={log} />
      </section>
    </section>
  );
};

export default SmReviewResult;
