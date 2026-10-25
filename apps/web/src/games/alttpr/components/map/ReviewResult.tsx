import type { AlttprSpoilerLog } from "@alltp/pack-alttpr";
import { useId, useMemo } from "react";
import { locationName } from "@/games/alttpr/logic/solution";
import {
  compareReview,
  type ReviewComparison,
  type ReviewRow,
  type RowState,
} from "@/games/alttpr/review/adapter";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import type { Loaded } from "@/review/store";
import { formatTime } from "@/utils/runTimer";

/** What each row's note says; the lateness and the matching add to it. */
const NOTES: Readonly<Record<RowState, string>> = {
  "in-order": "In order",
  late: "Late",
  missed: "Missed",
  unknown: "The board cannot tell",
  untimed: "Done, no time recorded",
};

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** One row's note: "Late: after 2 items of later spheres (by item order)". */
const noteOf = ({ entry, state }: ReviewRow): string => {
  const parts = [NOTES[state]];
  if (state === "late") {
    parts[0] = `Late: after ${plural(entry.behind, "item")} of later spheres`;
  }
  if (entry.inferred && entry.state === "found") parts.push("(by item order)");
  return parts.join(" ");
};

/** The caption: how the playthrough's required items went. */
export const captionOf = (summary: ReviewComparison["summary"]): string => {
  const parts = [
    `${summary.inOrder} in order`,
    `${summary.late} late`,
    `${summary.missed} missed`,
  ];
  if (summary.untimed > 0) parts.push(`${summary.untimed} done, not timed`);
  if (summary.unknown > 0) parts.push(`${summary.unknown} not known`);
  return `${plural(summary.required, "required item")}: ${parts.join(", ")}.`;
};

const Found = ({ row }: { row: ReviewRow }) => {
  if (row.entry.state !== "found") {
    return <span>{row.state === "untimed" ? "done" : "not found"}</span>;
  }
  return row.ms === null ? (
    <span title="Before the timer started">before the timer</span>
  ) : (
    <time dateTime={`PT${Math.floor(row.ms / 1000)}S`}>
      {formatTime(row.ms)}
    </time>
  );
};

/** The seed's own facts: medallions, prizes, starting items, shuffled bosses. */
const Facts = ({ log }: { log: AlttprSpoilerLog }) => {
  const { bosses, medallions, prizes } = log.extra;
  const prizeNames = Object.entries(prizes).map(([dungeon, item]) => {
    const held = log.placements.find((p) => p.location === `${dungeon}/prize`);
    return [dungeon, held?.itemName ?? item] as const;
  });
  const rows: [string, string][] = [];
  if (medallions.mire !== null || medallions.turtleRock !== null) {
    rows.push([
      "Medallions",
      `Misery Mire: ${medallions.mire ?? "?"}, Turtle Rock: ${medallions.turtleRock ?? "?"}`,
    ]);
  }
  if (prizeNames.length > 0) {
    rows.push([
      "Prizes",
      prizeNames
        .map(
          ([dungeon, name]) =>
            `${locationName(`${dungeon}/prize`).replace(/ - Prize$/, "")}: ${name}`,
        )
        .join(", "),
    ]);
  }
  if (log.start.length > 0) rows.push(["Starting items", log.start.join(", ")]);
  if (bosses !== null) {
    rows.push([
      "Bosses",
      Object.entries(bosses)
        .map(([dungeon, boss]) => `${dungeon}: ${boss}`)
        .join(", "),
    ]);
  }
  return (
    <dl className="review-facts" data-testid="review-facts">
      {rows.map(([name, value]) => (
        <div className="review-facts__row" key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
};

/**
 * The review of a finished ALttPR run (the Run tab's top section): its
 * timeline set against the spoiler log's playthrough, what was missed, and
 * the seed's facts. A lazy chunk: it loads once a review is open.
 */
const ReviewResult = ({ review }: { review: Loaded }) => {
  const log = review.log as AlttprSpoilerLog;
  const items = useGameStore((state) => state.items);
  const checked = useGameStore((state) => state.checked);
  const medallions = useGameStore((state) => state.medallions);
  const presetId = useGameStore((state) => state.presetId);
  const seed = useGameStore((state) => state.seed);
  const settings = useGameStore((state) => state.settings);
  const smallKeys = useGameStore((state) => state.smallKeys);
  const timeline = useGameStore((state) => state.timeline);
  const comparison = useMemo(
    () =>
      compareReview(log, {
        checked,
        items,
        medallions,
        presetId,
        seed,
        settings,
        smallKeys,
        timeline,
      }),
    [
      log,
      checked,
      items,
      medallions,
      presetId,
      seed,
      settings,
      smallKeys,
      timeline,
    ],
  );
  const titleId = useId();
  const missedId = useId();
  const factsId = useId();

  const required = comparison.rows
    .filter(({ entry }) => entry.placement.sphere !== null)
    .sort(
      (a, b) =>
        (a.entry.placement.sphere ?? 0) - (b.entry.placement.sphere ?? 0) ||
        locationName(a.entry.placement.location).localeCompare(
          locationName(b.entry.placement.location),
        ),
    );
  const missed = comparison.rows
    .filter(({ state }) => state === "missed")
    .sort(
      (a, b) =>
        Number(b.entry.placement.sphere !== null) -
        Number(a.entry.placement.sphere !== null),
    );

  const others = missed.filter(({ entry }) => entry.placement.sphere === null);

  return (
    <div className="review-result" data-testid="review-result">
      <section
        aria-labelledby={titleId}
        className="run-section"
        data-testid="review-playthrough"
      >
        <h3 className="run-section__title" id={titleId}>
          Your run against the playthrough
        </h3>
        {log.spheres === 0 ? (
          <p className="run-section__empty">
            This log has no playthrough (a spoiler race's): there is no order to
            compare the run with.
          </p>
        ) : (
          <section
            aria-labelledby={titleId}
            className="review-table-wrap"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a table wider than a phone scrolls sideways, and a keyboard must reach it
            tabIndex={0}
          >
            <table aria-labelledby={titleId} className="review-table">
              <caption
                className="review-table__caption"
                data-testid="review-caption"
              >
                {captionOf(comparison.summary)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Sphere</th>
                  <th scope="col">Item</th>
                  <th scope="col">Where</th>
                  <th scope="col">Found</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {required.map((row) => (
                  <tr
                    data-state={row.state}
                    data-testid={`review-row-${row.entry.placement.location}`}
                    key={row.entry.placement.location}
                  >
                    <td>{row.entry.placement.sphere}</td>
                    <th scope="row">{row.entry.placement.itemName}</th>
                    <td>{locationName(row.entry.placement.location)}</td>
                    <td>
                      <Found row={row} />
                    </td>
                    <td>{noteOf(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>

      <section
        aria-labelledby={missedId}
        className="run-section"
        data-testid="review-missed"
      >
        <h3 className="run-section__title" id={missedId}>
          Missed <span className="run-section__count">{missed.length}</span>
        </h3>
        {missed.length === 0 && comparison.counted.length === 0 ? (
          <p className="run-section__empty">
            Every location the board tracks was found.
          </p>
        ) : (
          <>
            <ul className="review-missed">
              {missed
                .filter(({ entry }) => entry.placement.sphere !== null)
                .map(({ entry }) => (
                  <li
                    data-testid={`review-missed-${entry.placement.location}`}
                    key={entry.placement.location}
                  >
                    {locationName(entry.placement.location)}:{" "}
                    <strong>{entry.placement.itemName}</strong> (required)
                  </li>
                ))}
              {comparison.counted.map(({ left, name }) => (
                <li key={name}>
                  {name}: {plural(left, "item")} left. The board counts a
                  dungeon's chests, so it does not know which locations those
                  are.
                </li>
              ))}
            </ul>
            {others.length > 0 && (
              <details className="review-others" data-testid="review-others">
                <summary>
                  Other locations never checked ({others.length})
                </summary>
                <ul className="review-missed">
                  {others.map(({ entry }) => (
                    <li
                      data-testid={`review-missed-${entry.placement.location}`}
                      key={entry.placement.location}
                    >
                      {locationName(entry.placement.location)}:{" "}
                      <strong>{entry.placement.itemName}</strong>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      <section aria-labelledby={factsId} className="run-section">
        <h3 className="run-section__title" id={factsId}>
          The seed
        </h3>
        <Facts log={log} />
        {log.format === "er" && (
          <p className="run-section__empty">
            An entrance randomizer log: placements and playthrough are compared;
            where each entrance really led is not shown yet.
          </p>
        )}
        {log.skipped.length > 0 && (
          <p className="run-section__empty">
            Left out as events, not items: {log.skipped.join(", ")}.
          </p>
        )}
      </section>
    </div>
  );
};

export default ReviewResult;
