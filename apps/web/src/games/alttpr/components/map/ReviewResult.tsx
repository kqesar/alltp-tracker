import { type AlttprSpoilerLog, DUNGEONS } from "@alltp/pack-alttpr";
import { type ReactNode, useId, useMemo } from "react";
import {
  andList,
  duration,
  ReviewWaits,
} from "@/games/alttpr/components/map/ReviewWaits";
import { withCost } from "@/games/alttpr/logic/costs";
import { locationName } from "@/games/alttpr/logic/solution";
import {
  compareReview,
  type ReviewComparison,
  type ReviewedRun,
  type ReviewRow,
} from "@/games/alttpr/review/adapter";
import { labelsOfLog } from "@/games/alttpr/review/labels";
import {
  type Hidden,
  hiddenReason,
  type Sweep,
} from "@/games/alttpr/review/sweep";
import { useSweep } from "@/games/alttpr/review/useSweep";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";
import type { Loaded } from "@/review/store";
import { formatTime } from "@/utils/runTimer";

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** Why the waits are not shown, in one sentence. */
const HIDDEN: Readonly<Record<Hidden, string>> = {
  "by-hand":
    "This run was tracked by hand: its times are when you clicked, so when each item waited is not shown.",
  entrances:
    "Entrances were shuffled: the run does not time where each led, so when each place came into logic is not shown.",
  "generic-keys":
    "Small keys are generic in Retro (any key opens any door): the board counts none, so when each place came into logic is not shown.",
  keysanity:
    "Small keys were shuffled: the run does not time them, so when each place came into logic is not shown.",
  "no-playthrough":
    "This log has no playthrough (a spoiler race's): there is nothing to set the run against.",
  "no-timeline":
    "This run came without its timeline (a shared link leaves it out to stay short), so nothing on it has a time: review it on the device where it was played, or open its full link, which Share copies with the timeline.",
  "no-times":
    "Nothing the seed needed has a time on this run, so when each item waited is not shown.",
  "not-modelled":
    "This seed's logic is not one the tracker models (hidden settings, shuffled bosses, a glitched logic or a mode it does not model), so when each place came into logic is not shown.",
  "race-mode":
    "Only places outside dungeons have times in this run (autotracked in Race Mode by an earlier version of the tracker, which did not read a dungeon's chests), so most needed items are matched by the item, not by its place: when each waited is not shown.",
};

const iso = (ms: number) => `PT${Math.floor(ms / 1000)}S`;

/** A run timer reading, or why there is none. */
const RawTime = ({ row }: { row: ReviewRow }) => {
  if (row.entry.state !== "found") {
    return (
      <>
        {row.state === "untimed"
          ? "done, no time"
          : row.state === "unknown"
            ? "not tracked"
            : "never taken"}
      </>
    );
  }
  return row.ms === null ? (
    <>before the timer</>
  ) : (
    <time dateTime={iso(row.ms)}>{formatTime(row.ms)}</time>
  );
};

const PlayTime = ({ ms }: { ms: number | null }) =>
  ms === null ? (
    "–"
  ) : ms === 0 ? (
    "start"
  ) : (
    <time dateTime={iso(ms)}>{formatTime(ms)}</time>
  );

/**
 * The playthrough, step by step: with the waits once worked out, with the
 * run timer's readings otherwise.
 */
const Steps = ({
  comparison,
  sweep,
}: {
  comparison: ReviewComparison;
  sweep: Sweep | null;
}) => {
  const titleId = useId();
  const waits = new Map(sweep?.waits.map((wait) => [wait.location, wait]));
  const rows = comparison.rows
    .filter(({ entry }) => entry.placement.sphere !== null)
    .sort(
      (a, b) =>
        (a.entry.placement.sphere ?? 0) - (b.entry.placement.sphere ?? 0) ||
        a.entry.placement.locationName.localeCompare(
          b.entry.placement.locationName,
        ),
    );
  return (
    <section
      aria-labelledby={titleId}
      className="review-table-wrap"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a table wider than a phone scrolls sideways, and a keyboard must reach it
      tabIndex={0}
    >
      <table className="review-table">
        <caption
          className="review-table__caption"
          data-testid="review-caption"
          id={titleId}
        >
          {plural(rows.length, "needed item")}. Step 1 is what the start
          reaches; each next step, what the one before opens. It says how soon
          the logic reaches an item, not an order to follow.
        </caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Item</th>
            <th scope="col">Where</th>
            {sweep !== null && <th scope="col">In logic from</th>}
            <th scope="col">Taken</th>
            {sweep !== null && <th scope="col">Waited</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { placement } = row.entry;
            const wait = waits.get(placement.location);
            return (
              <tr
                data-testid={`review-row-${placement.location}`}
                key={placement.location}
              >
                <td>{placement.sphere}</td>
                <th scope="row">{wait?.name ?? placement.itemName}</th>
                <td>
                  {wait?.where ??
                    withCost(
                      locationName(placement.location),
                      placement.location,
                    )}
                </td>
                {sweep !== null && (
                  <td>
                    <PlayTime ms={wait?.reach ?? null} />
                  </td>
                )}
                <td>
                  {sweep === null || wait === undefined ? (
                    <RawTime row={row} />
                  ) : (
                    <PlayTime ms={wait.taken} />
                  )}
                </td>
                {sweep !== null && (
                  <td>
                    {wait?.waited === null || wait?.waited === undefined
                      ? "–"
                      : wait.waited < 0
                        ? "before"
                        : duration(wait.waited)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};

/** What a group of places held: "Big Key, 4 × Key, Compass and 2 more". */
const heldWords = (
  rows: readonly ReviewRow[],
  rank: (row: ReviewRow) => number,
  prefix = "",
): string => {
  const counts = new Map<string, { n: number; rank: number }>();
  for (const row of rows) {
    const name = row.entry.placement.itemName.replace(prefix, "");
    const was = counts.get(name);
    counts.set(name, {
      n: (was?.n ?? 0) + 1,
      rank: Math.min(was?.rank ?? 9, rank(row)),
    });
  }
  const sorted = [...counts].sort(
    (a, b) => a[1].rank - b[1].rank || b[1].n - a[1].n,
  );
  const shown = sorted
    .slice(0, 4)
    .map(([name, { n }]) => (n > 1 ? `${n} × ${name}` : name));
  return andList(
    sorted.length > 4 ? [...shown, `${sorted.length - 4} more`] : shown,
  );
};

/** What the other places held, by kind: "rupees, arrows or dungeon items". */
const kindsOf = (
  rows: readonly ReviewRow[],
  rank: (row: ReviewRow) => number,
) => {
  const kinds = new Set<string>();
  for (const row of rows) {
    const name = row.entry.placement.itemName;
    kinds.add(
      /Rupee/.test(name)
        ? "rupees"
        : /Arrow/.test(name)
          ? "arrows"
          : /Bomb/.test(name)
            ? "bombs"
            : rank(row) === 2
              ? "dungeon items"
              : "other items",
    );
  }
  return andList([...kinds], "or");
};

const HEARTS = /^(pieceOfHeart|bossHeartContainer|heartContainer)/;

/** The places that held something, never checked: needed first, then by dungeon and item. */
const NeverChecked = ({
  comparison,
  log,
}: {
  comparison: ReviewComparison;
  log: AlttprSpoilerLog;
}) => {
  const titleId = useId();
  const labels = useMemo(() => labelsOfLog(log), [log]);
  const rank = (row: ReviewRow) =>
    labels.byLocation.get(row.entry.placement.location)?.rank ?? 3;
  const missed = comparison.rows.filter(({ state }) => state === "missed");
  const needed = missed.filter(({ entry }) => entry.placement.sphere !== null);
  const rest = missed.filter(({ entry }) => entry.placement.sphere === null);

  // A dungeon left mostly unchecked is one line; the rest by item
  const dungeonOf = (row: ReviewRow) =>
    DUNGEONS.find(({ id }) =>
      row.entry.placement.location.startsWith(`${id}/`),
    );
  const byDungeon = new Map<string, ReviewRow[]>();
  const total = new Map<string, number>();
  for (const row of comparison.rows) {
    const name = dungeonOf(row)?.name;
    if (name !== undefined) total.set(name, (total.get(name) ?? 0) + 1);
  }
  for (const row of rest) {
    const name = dungeonOf(row)?.name;
    if (name !== undefined) {
      byDungeon.set(name, [...(byDungeon.get(name) ?? []), row]);
    }
  }
  const groups = [...byDungeon].filter(
    ([name, rows]) =>
      rows.length >= 3 && rows.length * 2 >= (total.get(name) ?? 0),
  );
  const grouped = new Set(groups.flatMap(([, rows]) => rows));
  const loose = rest.filter((row) => !grouped.has(row));
  // Progression and hearts by item; a dungeon's own items go with the rest
  const notable = new Map<string, ReviewRow[]>();
  for (const row of loose) {
    const { item, itemName } = row.entry.placement;
    const progression =
      rank(row) <= 1 && !/^(bigKey|key|map|compass)[A-Z]/.test(item ?? "");
    if (!progression && !HEARTS.test(item ?? "")) continue;
    notable.set(itemName, [...(notable.get(itemName) ?? []), row]);
  }
  const others = loose.filter(
    (row) => !notable.get(row.entry.placement.itemName)?.includes(row),
  );
  const empty =
    missed.length === 0 && comparison.counted.length === 0
      ? "Every place the board tracks was checked."
      : null;

  const line = (key: string, icon: string | null, body: ReactNode) => (
    <li data-testid={`review-missed-${key}`} key={key}>
      {icon === null ? (
        <span
          aria-hidden="true"
          className="review-sprite review-sprite--none"
        />
      ) : (
        <img
          alt=""
          className="review-sprite review-sprite--sm"
          height={24}
          src={getAssetPath(icon)}
          width={24}
        />
      )}
      <span className="review-list__grow">{body}</span>
    </li>
  );
  const iconOf = (rows: readonly ReviewRow[]) =>
    rows
      .map((row) => labels.byLocation.get(row.entry.placement.location))
      .sort((a, b) => (a?.rank ?? 3) - (b?.rank ?? 3))[0]?.icon ?? null;

  return (
    <section
      aria-labelledby={titleId}
      className="run-section"
      data-testid="review-missed"
    >
      <h4 className="run-section__title" id={titleId}>
        Places that mattered, never checked
      </h4>
      {empty !== null ? (
        <p className="run-section__empty">{empty}</p>
      ) : (
        <>
          <p className="run-section__empty">
            {needed.length === 0
              ? "Nothing the seed needed. What stayed behind:"
              : `${plural(needed.length, "item")} the seed needed, then what else stayed behind:`}
          </p>
          <ul className="review-list">
            {needed.map((row) =>
              line(
                row.entry.placement.location,
                labels.byLocation.get(row.entry.placement.location)?.icon ??
                  null,
                <>
                  <strong>{row.entry.placement.itemName}</strong>, at{" "}
                  {withCost(
                    row.entry.placement.locationName,
                    row.entry.placement.location,
                  )}
                  : the seed needed it.
                </>,
              ),
            )}
            {groups.map(([name, rows]) =>
              line(
                name,
                iconOf(rows),
                <>
                  <strong>{name}</strong>: {plural(rows.length, "place")} never
                  checked, holding {heldWords(rows, rank, `${name} `)}.
                </>,
              ),
            )}
            {[...notable].map(([name, rows]) =>
              line(
                name,
                iconOf(rows),
                <>
                  <strong>
                    {rows.length > 1 ? `${rows.length} × ${name}` : name}
                  </strong>
                  :{" "}
                  {andList(
                    rows.map(({ entry }) =>
                      withCost(
                        entry.placement.locationName,
                        entry.placement.location,
                      ),
                    ),
                  )}
                  .
                </>,
              ),
            )}
            {comparison.counted.map(({ left, name }) =>
              line(
                `counted-${name}`,
                null,
                <>
                  {name}: {plural(left, "item")} left. The board counts a
                  dungeon's chests, so it does not know which places those are.
                </>,
              ),
            )}
          </ul>
          {others.length > 0 && (
            <p className="run-section__empty">
              {plural(others.length, "other place")} held{" "}
              {kindsOf(others, rank)}.
            </p>
          )}
        </>
      )}
    </section>
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
 * The review of a finished ALttPR run (the Run tab's top section): when each
 * needed item came into logic against when it was taken, the dungeons, what
 * stayed behind, the playthrough step by step and the seed's facts. Where
 * the waits cannot be told (keysanity, shuffled entrances, logic not known,
 * a run tracked by hand, no times), one sentence says why and the
 * playthrough shows with the run timer's readings. A lazy chunk.
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
  const endMs = useGameStore((state) => state.timer.elapsedMs);
  const run = useMemo(
    (): ReviewedRun => ({
      checked,
      items,
      medallions,
      presetId,
      seed,
      settings,
      smallKeys,
      timeline,
    }),
    [checked, items, medallions, presetId, seed, settings, smallKeys, timeline],
  );
  const comparison = useMemo(() => compareReview(log, run), [log, run]);
  const hidden = hiddenReason(log, run, comparison);
  const sweep = useSweep(review, run, comparison, endMs, hidden !== null);
  const stepsId = useId();
  const factsId = useId();

  return (
    <div className="review-result" data-testid="review-result">
      {hidden !== null ? (
        <p className="review-hidden" data-testid="review-hidden">
          {HIDDEN[hidden]}
        </p>
      ) : sweep === null ? (
        <p
          className="run-section__empty"
          data-testid="review-working"
          role="status"
        >
          Working out when each needed item came into logic…
        </p>
      ) : (
        <ReviewWaits comparison={comparison} sweep={sweep} />
      )}

      <NeverChecked comparison={comparison} log={log} />

      {log.spheres > 0 &&
        (hidden === null ? (
          <details className="review-steps" data-testid="review-playthrough">
            <summary>
              Details by step: the seed's playthrough (
              {plural(comparison.summary.required, "needed item")})
            </summary>
            <Steps comparison={comparison} sweep={sweep} />
          </details>
        ) : (
          <section
            aria-labelledby={stepsId}
            className="run-section"
            data-testid="review-playthrough"
          >
            <h4 className="run-section__title" id={stepsId}>
              The seed's playthrough
            </h4>
            <Steps comparison={comparison} sweep={null} />
          </section>
        ))}

      <section aria-labelledby={factsId} className="run-section">
        <h4 className="run-section__title" id={factsId}>
          The seed
        </h4>
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
