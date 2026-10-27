import { type ReactNode, useId, useState } from "react";
import { locationName } from "@/games/alttpr/logic/solution";
import type { ReviewComparison } from "@/games/alttpr/review/adapter";
import {
  BREAK_MS,
  type Break,
  chainOf,
  type DungeonTimes,
  type Sweep,
  type Wait,
} from "@/games/alttpr/review/sweep";
import { getAssetPath } from "@/games/alttpr/utils";
import { formatTime } from "@/utils/runTimer";

/** How many cards show before "Show all". */
const SHOWN = 5;
/** How many dungeon items and prizes show before "Show all". */
const SHOWN_DUNGEON = 3;

/** A wait in words: "3 h 16", "26 min", "under a minute". */
export const duration = (ms: number): string => {
  const minutes = Math.round(Math.abs(ms) / 60_000);
  if (minutes < 1) return "under a minute";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0
    ? `${hours} h ${String(rest).padStart(2, "0")}`
    : `${rest} min`;
};

const iso = (ms: number) => `PT${Math.floor(Math.max(0, ms) / 1000)}S`;

/** A play time, as a `<time>`; 0 is the start. */
const At = ({ ms, start = "the start" }: { ms: number; start?: string }) =>
  ms === 0 ? start : <time dateTime={iso(ms)}>{formatTime(ms)}</time>;

/** "A", "A and B", "A, B and C". */
export const andList = (words: readonly string[], last = "and"): string =>
  words.length < 2
    ? words.join("")
    : `${words.slice(0, -1).join(", ")} ${last} ${words.at(-1)}`;

/** Places by the region before their " - ": "Swamp Palace (11), Hobo". */
const regionsOf = (locations: readonly string[], max = 3): string => {
  const counts = new Map<string, number>();
  for (const id of locations) {
    const region = locationName(id).split(" - ")[0] ?? id;
    counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const shown = sorted
    .slice(0, max)
    .map(([region, n]) => (n > 1 ? `${region} (${n})` : region));
  const more = sorted.slice(max).reduce((sum, [, n]) => sum + n, 0);
  return andList(
    more > 0
      ? [...shown, `${more} more ${more === 1 ? "place" : "places"}`]
      : shown,
  );
};

const Sprite = ({ icon, small }: { icon: string | null; small?: boolean }) =>
  icon === null ? (
    <span aria-hidden="true" className="review-sprite review-sprite--none" />
  ) : (
    <img
      alt=""
      className={`review-sprite${small ? " review-sprite--sm" : ""}`}
      height={small ? 24 : 32}
      src={getAssetPath(`${icon}.png`)}
      width={small ? 24 : 32}
    />
  );

const pct = (ms: number, end: number) =>
  `${Math.min(100, Math.max(0, (ms / Math.max(end, 1)) * 100)).toFixed(2)}%`;

/** A wait drawn on the run's play time: breaks dotted, waiting hatched, taken a dot. */
const Track = ({ wait, sweep }: { wait: Wait; sweep: Sweep }) => {
  const { end } = sweep;
  const reach = wait.reach ?? 0;
  const taken = wait.taken ?? 0;
  return (
    <div aria-hidden="true" className="review-track">
      {sweep.breaks
        .filter(({ at }) => at > 0 && at < end)
        .map(({ at }) => (
          <span
            className="review-track__break"
            key={at}
            style={{ left: pct(at, end) }}
          />
        ))}
      {taken >= reach ? (
        <>
          <span
            className="review-track__wait"
            style={{ left: pct(reach, end), width: pct(taken - reach, end) }}
          />
          <span
            className="review-track__taken"
            style={{ left: pct(taken, end) }}
          />
        </>
      ) : (
        <>
          <span
            className="review-track__reach"
            style={{ left: pct(reach, end) }}
          />
          <span
            className="review-track__ahead"
            style={{ left: pct(taken, end) }}
          />
        </>
      )}
    </div>
  );
};

/**
 * The dungeon an item waited in, when only part of it was in logic then:
 * the places in logic at the item's own "in logic from", its place among them.
 */
export const dungeonContext = (wait: Wait, sweep: Sweep): string | null => {
  const { place, reach } = wait;
  const dungeon = sweep.dungeons.find(
    ({ reaches }) => place !== null && place in reaches,
  );
  if (
    dungeon === undefined ||
    place === null ||
    reach === null ||
    dungeon.full === null ||
    dungeon.full <= reach
  ) {
    return null;
  }
  const then = Object.entries(dungeon.reaches)
    .filter(([, at]) => at !== null && at <= reach)
    .map(([id]) => id);
  if (!then.includes(place)) return null;
  const short = (id: string) =>
    locationName(id).replace(`${dungeon.name} - `, "");
  const entered =
    dungeon.entered === null
      ? ""
      : ` You entered it at ${formatTime(dungeon.entered)}.`;
  return (
    `${dungeon.name}: ${then.length} of ${dungeon.total} places were in logic then ` +
    `(${andList(then.map(short))}); one held the ${wait.name}. ` +
    `The whole dungeon was in logic from ${formatTime(dungeon.full)}` +
    `${dungeon.fullAfter === null ? "" : `, with ${dungeon.fullAfter.name}`}.${entered}`
  );
};

/** What holding it earlier could have opened, or what taking it opened. */
const openedWords = (wait: Wait): ReactNode => {
  const { tradeOff } = wait;
  if (tradeOff !== null && wait.taken !== null && tradeOff.at < wait.taken) {
    const when =
      tradeOff.at === 0
        ? "from the start"
        : `from ${formatTime(tradeOff.at)}${tradeOff.after === null ? "" : `, once you had ${tradeOff.after.name}`}`;
    return (
      <>
        <strong>Trade-off.</strong> Held earlier, it could have opened{" "}
        {regionsOf(tradeOff.opened)} {when}.
      </>
    );
  }
  return wait.opened.length > 0
    ? `When you took it, it opened ${regionsOf(wait.opened)}.`
    : null;
};

/** One item that waited: when it was in logic, when it was taken, and why it mattered. */
const WaitCard = ({
  rank,
  sweep,
  wait,
}: {
  rank: number;
  sweep: Sweep;
  wait: Wait;
}) => {
  const context = dungeonContext(wait, sweep);
  const opened = openedWords(wait);
  return (
    <li className="wait-card" data-testid={`wait-${wait.location}`}>
      <span aria-hidden="true" className="wait-card__rank">
        {rank}
      </span>
      <Sprite icon={wait.icon} />
      <div className="wait-card__body">
        <h5 className="wait-card__title">
          {wait.name}
          {wait.where !== null && (
            <span className="wait-card__where"> · {wait.where}</span>
          )}
        </h5>
        <dl className="wait-card__facts">
          <div>
            <dt>In logic from</dt>
            <dd>
              <At ms={wait.reach ?? 0} />
              {wait.after !== null && (
                <span className="wait-card__muted">
                  {" "}
                  (after {wait.after.name})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Taken</dt>
            <dd>
              <At ms={wait.taken ?? 0} />
            </dd>
          </div>
          <div>
            <dt>Waited</dt>
            <dd className="wait-card__waited">{duration(wait.waited ?? 0)}</dd>
          </div>
        </dl>
        <Track sweep={sweep} wait={wait} />
        {context !== null && <p className="wait-card__context">{context}</p>}
        {opened !== null && <p className="wait-card__opened">{opened}</p>}
        {(wait.copies > 1 || wait.inferred) && (
          <p className="wait-card__note">
            {wait.copies > 1
              ? `One of ${wait.copies} copies on the map: copies are paired in the order they came into logic and were taken.`
              : "Matched by the item, not by its place."}
          </p>
        )}
      </div>
    </li>
  );
};

const Legend = () => (
  <ul aria-hidden="true" className="review-legend">
    <li>
      <span className="review-legend__wait" />
      waiting: in logic, not taken yet
    </li>
    <li>
      <span className="review-legend__taken" />
      taken
    </li>
    <li>
      <span className="review-legend__break" />
      break ({BREAK_MS / 60_000} min or more with nothing found)
    </li>
  </ul>
);

/** The chain behind the run: each item in logic once the one before was held. */
const Chain = ({ chain }: { chain: readonly Wait[] }) => {
  const titleId = useId();
  const [head] = chain;
  if (head === undefined || chain.length < 3) return null;
  return (
    <div className="review-chain" data-testid="review-chain">
      <p className="review-chain__title" id={titleId}>
        <strong>The chain behind the run.</strong> Each item came into logic
        once you had the one before it; the {head.name} was in logic from{" "}
        <At ms={head.reach ?? 0} />.
      </p>
      <ol aria-labelledby={titleId} className="review-chain__list">
        {chain.map((wait) => (
          <li key={wait.location}>
            <Sprite icon={wait.icon} small />
            <span>
              {wait.name}
              <br />
              <span className="wait-card__muted">
                <At ms={wait.taken ?? 0} start="0:00" />
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};

/** A short row: sprite, name and where, and a value at the end. */
const ItemRow = ({
  end,
  testId,
  wait,
}: {
  end: ReactNode;
  testId: string;
  wait: Wait;
}) => (
  <li data-testid={testId}>
    <Sprite icon={wait.icon} small />
    <span className="review-list__grow">
      <strong>{wait.name}</strong>
      {wait.where !== null && (
        <span className="wait-card__muted"> · {wait.where}</span>
      )}
    </span>
    {end}
  </li>
);

/** The summary tiles: play time, needed items found, longest wait. */
const Tiles = ({
  comparison,
  sweep,
  top,
}: {
  comparison: ReviewComparison;
  sweep: Sweep;
  top: Wait | undefined;
}) => {
  const { summary } = comparison;
  const found = summary.inOrder + summary.late;
  const breaks = sweep.breaks.reduce((sum, { length }) => sum + length, 0);
  return (
    <dl className="run-summary review-tiles" data-testid="review-tiles">
      <div className="run-summary__item">
        <dt>Play time</dt>
        <dd>
          <time dateTime={iso(sweep.end)}>{formatTime(sweep.end)}</time>
        </dd>
        <dd className="review-tiles__note">
          {sweep.breaks.length === 0
            ? "As the timer read"
            : `Timer read ${formatTime(sweep.timerEnd)}; ${breakWords(sweep.breaks)} (${duration(breaks)}) left out`}
        </dd>
      </div>
      <div className="run-summary__item">
        <dt>Needed items</dt>
        <dd>
          {found}
          <span className="run-summary__of"> of {summary.required}</span>
        </dd>
        <dd className="review-tiles__note">
          {summary.missed === 0
            ? "Nothing the seed needed was left behind"
            : `${summary.missed} never taken`}
        </dd>
      </div>
      <div className="run-summary__item">
        <dt>Longest wait</dt>
        <dd>{top === undefined ? "None" : duration(top.waited ?? 0)}</dd>
        <dd className="review-tiles__note">
          {top === undefined
            ? "Each needed item was taken once in logic"
            : `${top.name}, in logic from ${top.reach === 0 || top.reach === null ? "the start" : formatTime(top.reach)}`}
        </dd>
      </div>
    </dl>
  );
};

const breakWords = (breaks: readonly Break[]) =>
  `${breaks.length} ${breaks.length === 1 ? "break" : "breaks"}`;

/** What waited longest: the cards, the chain and the dungeon items. */
const Waits = ({
  sweep,
  waited,
}: {
  sweep: Sweep;
  waited: readonly Wait[];
}) => {
  const titleId = useId();
  const [all, setAll] = useState(false);
  const majors = waited.filter(({ kind }) => kind === "major");
  const others = waited.filter(({ kind }) => kind !== "major");
  const cards = all ? majors : majors.slice(0, SHOWN);
  const rows = all ? others : others.slice(0, SHOWN_DUNGEON);
  const more =
    majors.length -
    Math.min(majors.length, SHOWN) +
    (others.length - Math.min(others.length, SHOWN_DUNGEON));
  const chain = chainOf(sweep.waits);
  return (
    <section
      aria-labelledby={titleId}
      className="run-section review-waits"
      data-testid="review-waits"
    >
      <h4 className="run-section__title" id={titleId}>
        What waited for you the longest
      </h4>
      {majors.length === 0 ? (
        <p className="run-section__empty">
          Each needed item was taken as soon as it was in logic.
        </p>
      ) : (
        <>
          <p className="run-section__empty">
            For each item: when the items you held first put it in logic, and
            when you took it. Play time; breaks left out.
          </p>
          <Legend />
          <ol className="wait-cards">
            {cards.map((wait, index) => (
              <WaitCard
                key={wait.location}
                rank={index + 1}
                sweep={sweep}
                wait={wait}
              />
            ))}
          </ol>
        </>
      )}
      <Chain chain={chain} />
      {rows.length > 0 && (
        <>
          <h5 className="review-subtitle">
            Dungeon items and prizes that waited
          </h5>
          <ul className="review-list">
            {rows.map((wait) => (
              <ItemRow
                end={
                  <span className="wait-card__waited">
                    {duration(wait.waited ?? 0)}
                  </span>
                }
                key={wait.location}
                testId={`wait-${wait.location}`}
                wait={wait}
              />
            ))}
          </ul>
        </>
      )}
      {more > 0 || all ? (
        <button
          aria-expanded={all}
          className="modal-btn modal-btn--ghost review-more"
          data-testid="review-waits-all"
          onClick={() => setAll(!all)}
          type="button"
        >
          {all
            ? "Show the longest only"
            : `Show all ${waited.length} items that waited`}
        </button>
      ) : null}
    </section>
  );
};

const Mark = ({ className }: { className: string }) => (
  <span className={className} />
);

/** A dungeon's times drawn on the run: part in logic, all in logic, entered, beaten. */
const DungeonTrack = ({
  dungeon,
  end,
}: {
  dungeon: DungeonTimes;
  end: number;
}) => {
  const part = dungeon.partial ?? end;
  const full = dungeon.full ?? end;
  return (
    <div aria-hidden="true" className="review-dungeon-track">
      {dungeon.partial !== null && full > part && (
        <span
          className="review-dungeon-track__part"
          style={{ left: pct(part, end), width: pct(full - part, end) }}
        />
      )}
      {dungeon.full !== null && (
        <span
          className="review-dungeon-track__full"
          style={{ left: pct(full, end), width: pct(end - full, end) }}
        />
      )}
      {dungeon.entered !== null && (
        <span
          className="review-dungeon-track__entered"
          style={{ left: pct(dungeon.entered, end) }}
        />
      )}
      {dungeon.finished !== null && (
        <span
          className="review-dungeon-track__done"
          style={{ left: pct(dungeon.finished, end) }}
        />
      )}
    </div>
  );
};

const Cell = ({ ms }: { ms: number | null }) =>
  ms === null ? (
    <span className="wait-card__muted">never</span>
  ) : (
    <At ms={ms} start="start" />
  );

/** The dungeons: when part and all of each was in logic, when you went. */
const Dungeons = ({ sweep }: { sweep: Sweep }) => {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="run-section"
      data-testid="review-dungeons"
    >
      <h4 className="run-section__title" id={titleId}>
        Dungeons: when they were in logic, when you went
      </h4>
      <p className="run-section__empty">
        Part in logic: some of its places. All in logic: every place, the boss
        included. Play time.
      </p>
      <ul aria-hidden="true" className="review-legend review-legend--dungeons">
        <li>
          <Mark className="review-legend__part" />
          part in logic
        </li>
        <li>
          <Mark className="review-legend__full" />
          all in logic
        </li>
        <li>
          <Mark className="review-legend__entered" />
          entered
        </li>
        <li>
          <Mark className="review-legend__done" />
          boss beaten
        </li>
      </ul>
      <section
        aria-labelledby={titleId}
        className="review-table-wrap"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a table wider than a phone scrolls sideways, and a keyboard must reach it
        tabIndex={0}
      >
        <table className="review-table review-dungeons">
          <thead>
            <tr>
              <th scope="col">Dungeon</th>
              <th scope="col">Part in logic</th>
              <th scope="col">All in logic</th>
              <th scope="col">Entered</th>
              <th scope="col">Boss</th>
              <th className="review-dungeons__track" scope="col">
                <span className="sr-only">On the run's play time</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sweep.dungeons.map((dungeon) => (
              <tr data-testid={`review-dungeon-${dungeon.id}`} key={dungeon.id}>
                <th scope="row">{dungeon.name}</th>
                <td>
                  <Cell ms={dungeon.partial} />
                  {dungeon.partial !== null && (
                    <span className="wait-card__muted">
                      {" "}
                      {dungeon.atPartial.length}
                      <span aria-hidden="true">/</span>
                      <span className="sr-only"> of </span>
                      {dungeon.total}
                    </span>
                  )}
                </td>
                <td>
                  <Cell ms={dungeon.full} />
                  {dungeon.fullAfter !== null &&
                    dungeon.full !== dungeon.partial && (
                      <span className="wait-card__muted">
                        {" "}
                        {dungeon.fullAfter.name.replace(/^the /, "")}
                      </span>
                    )}
                </td>
                <td>
                  {dungeon.entered === null &&
                  (!sweep.dungeonChecks || dungeon.finished !== null) ? (
                    <span className="wait-card__muted">not timed</span>
                  ) : (
                    <Cell ms={dungeon.entered} />
                  )}
                </td>
                <td>
                  {dungeon.finished === null ? (
                    <span className="wait-card__muted">no</span>
                  ) : (
                    <At ms={dungeon.finished} start="start" />
                  )}
                </td>
                <td className="review-dungeons__track">
                  <DungeonTrack dungeon={dungeon} end={sweep.end} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
};

/** Items taken before the items held put them in logic: said, never judged. */
const Ahead = ({ ahead }: { ahead: readonly Wait[] }) => {
  const titleId = useId();
  if (ahead.length === 0) return null;
  return (
    <section
      aria-labelledby={titleId}
      className="run-section"
      data-testid="review-ahead"
    >
      <h4 className="run-section__title" id={titleId}>
        Before the logic expected{" "}
        <span className="run-section__count">{ahead.length}</span>
      </h4>
      <p className="run-section__empty">
        Taken before the items you held put them in logic. Not counted as
        waiting.
      </p>
      <ul className="review-list">
        {ahead.map((wait) => (
          <ItemRow
            end={
              <span className="review-list__when">
                Taken <At ms={wait.taken ?? 0} />;{" "}
                {wait.reach === null ? (
                  "not in logic by the run's end"
                ) : (
                  <>
                    in logic from <At ms={wait.reach} />
                    {wait.after === null ? "" : `, after ${wait.after.name}`}
                  </>
                )}
              </span>
            }
            key={wait.location}
            testId={`ahead-${wait.location}`}
            wait={wait}
          />
        ))}
      </ul>
    </section>
  );
};

/** How the times are worked out, and what is an estimate. */
const HowWorkedOut = () => (
  <details className="review-others" data-testid="review-how">
    <summary>How these times are worked out</summary>
    <ul className="review-how">
      <li>
        In logic from: the first moment the items you held, and the dungeon keys
        from the places the log put them once you checked those, put the place
        in logic by the randomizer's rules (a dark room without the Lantern is
        not yet).
      </li>
      <li>
        Where a dungeon key's place was never checked, a needed place counts as
        in logic once you held every needed item of the steps before its own, as
        the seed's playthrough has it: an estimate.
      </li>
      <li>
        Play time leaves out each stretch of {BREAK_MS / 60_000} minutes or more
        with nothing found: an estimate of the breaks.
      </li>
      <li>
        Copies of one item (the swords, the gloves) are paired in the order they
        came into logic and were taken: an estimate.
      </li>
      <li>
        An item found with no place is matched by the item, the first copy
        first: an estimate.
      </li>
      <li>
        A dungeon's prize, the one the log names, counts from its boss beaten.
      </li>
    </ul>
  </details>
);

/**
 * The waits of a reviewed run: the tiles, what waited longest, the chain,
 * the dungeons and what was taken before the logic expected.
 */
export const ReviewWaits = ({
  comparison,
  sweep,
}: {
  comparison: ReviewComparison;
  sweep: Sweep;
}) => {
  const waited = sweep.waits.filter(({ waited }) => (waited ?? 0) > 0);
  // Taken before its place was in logic, or with its place never in logic
  const ahead = sweep.waits
    .filter(
      ({ reach, taken, waited }) =>
        (waited !== null && waited < 0) || (reach === null && taken !== null),
    )
    .sort((a, b) => (a.taken ?? 0) - (b.taken ?? 0));
  const top = waited.find(({ kind }) => kind === "major");
  return (
    <>
      <Tiles comparison={comparison} sweep={sweep} top={top} />
      <Waits sweep={sweep} waited={waited} />
      <Dungeons sweep={sweep} />
      <Ahead ahead={ahead} />
      <HowWorkedOut />
    </>
  );
};
