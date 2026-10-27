import { type CSSProperties, useMemo } from "react";
import { BOSS_TOKENS, REWARD_CELLS } from "@/games/smz3/data";
import { compareReview } from "@/games/smz3/review/adapter";
import {
  type Held,
  type Icon,
  labelsOf,
  type Smz3SpoilerLog,
} from "@/games/smz3/review/labels";
import { useSmz3Store } from "@/games/smz3/store";
import type { Loaded } from "@/review/store";

/** An ALttPR asset's address. */
const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** An item's small picture, as the board draws it; a blank of the same size for one it has no art for, so names line up. */
const Sprite = ({ icon }: { icon: Icon | null }) => (
  <span
    aria-hidden="true"
    className="smz3-sprite"
    data-blank={icon === null ? "" : undefined}
    data-sheet={icon?.kind === "sheet" ? "" : undefined}
    style={
      icon === null
        ? undefined
        : icon.kind === "sheet"
          ? ({ "--frame": icon.frame } as CSSProperties)
          : ({ "--sprite": `url(${asset(icon.file)})` } as CSSProperties)
    }
  />
);

/** The seed's rewards by their name, for the prizes line. */
const REWARD_NAMES: ReadonlyMap<string, string> = new Map([
  ...REWARD_CELLS.map((cell): [string, string] => [cell.id, cell.name]),
  ...BOSS_TOKENS.map((token): [string, string] => [
    token.id,
    `${token.name}'s token`,
  ]),
]);

const capital = (word: string) =>
  `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

/** The seed's own facts: medallions and the reward of each area. */
const Facts = ({ log }: { log: Smz3SpoilerLog }) => {
  const { medallions, prizes } = log.extra;
  const rows: [string, string][] = [
    [
      "Medallions",
      `Misery Mire: ${capital(medallions.mire)}, Turtle Rock: ${capital(medallions.turtleRock)}`,
    ],
    [
      "Rewards",
      Object.entries(prizes)
        .map(([area, id]) => `${area}: ${REWARD_NAMES.get(id) ?? id}`)
        .join(", "),
    ],
  ];
  return (
    <dl className="review-facts" data-testid="review-facts">
      {rows
        .filter(([, value]) => value !== "")
        .map(([name, value]) => (
          <div className="review-facts__row" key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
};

/** What a place held, with its picture. */
const Item = ({ held }: { held: Held }) => (
  <span className="smz3-held">
    <Sprite icon={held.icon} />
    {held.name}
  </span>
);

/**
 * The review of a finished SMZ3 run (the Review tab of the maps): which of
 * the seed's locations the run checked, the playthrough's by sphere, the
 * places left unchecked with what they held, and the seed's facts. The board
 * keeps no timeline for this game, so it says what was checked and not when.
 * A lazy chunk: it loads once a review is open.
 */
const Smz3ReviewPanel = ({ review }: { review: Loaded }) => {
  const log = review.log as Smz3SpoilerLog;
  const checked = useSmz3Store((state) => state.checked);
  const labels = labelsOf(review);
  const comparison = useMemo(
    () => (labels === null ? null : compareReview(labels, { checked })),
    [labels, checked],
  );
  if (comparison === null) return null;
  const { missed, required, requiredChecked, spheres, total } = comparison;
  return (
    <div className="review-result" data-testid="review-result">
      <p className="review-note" data-testid="review-note">
        SMZ3's board keeps no times, so this shows which places you checked, not
        when. A sphere is how soon the seed's logic reaches a place: sphere 1
        needs nothing. The Hyrule and Zebes tabs show what each place held, and
        the grid says where the seed put each item.
      </p>
      <p data-testid="review-summary">
        You checked {comparison.checked} of {plural(total, "place")} the seed
        filled. Of the {plural(required, "place")} the playthrough needs,{" "}
        {requiredChecked} checked and {required - requiredChecked} not.
      </p>

      <section aria-labelledby="smz3-review-playthrough">
        <h3 className="run-section__title" id="smz3-review-playthrough">
          Playthrough
        </h3>
        <section
          aria-labelledby="smz3-review-playthrough"
          className="review-table-wrap"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a table wider than a phone scrolls sideways, and a keyboard must reach it
          tabIndex={0}
        >
          <table className="review-table" data-testid="review-playthrough">
            <caption
              className="review-table__caption"
              data-testid="review-caption"
            >
              {plural(spheres.length, "sphere")}, {plural(required, "place")} in
              all: {requiredChecked} checked, {required - requiredChecked} not
              checked.
            </caption>
            <thead>
              <tr>
                <th scope="col">Sphere</th>
                <th scope="col">Place</th>
                <th scope="col">Held</th>
                <th scope="col">Your run</th>
              </tr>
            </thead>
            <tbody>
              {spheres.flatMap(({ rows, sphere }) =>
                rows.map(({ checked: done, held }) => (
                  <tr
                    data-state={done ? "checked" : "missed"}
                    key={held.location}
                  >
                    <td>{sphere}</td>
                    <th scope="row">{held.where}</th>
                    <td>
                      <Item held={held} />
                    </td>
                    <td>{done ? "Checked" : "Not checked"}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </section>
      </section>

      <section aria-labelledby="smz3-review-missed">
        <h3 className="run-section__title" id="smz3-review-missed">
          Not checked
        </h3>
        {missed.length === 0 ? (
          <p data-testid="review-missed-none">
            You checked every place the seed filled.
          </p>
        ) : (
          <div className="review-others" data-testid="review-missed">
            {missed.map(({ area, places }) => {
              const needed = places.filter((p) => p.sphere !== null).length;
              return (
                <details key={area}>
                  <summary>
                    {area}: {places.length} not checked
                    {needed > 0 ? `, ${needed} in the playthrough` : ""}
                  </summary>
                  <ul className="review-missed">
                    {places.map((held) => (
                      <li key={held.location}>
                        {held.where}: <Item held={held} />
                        {held.sphere === null
                          ? ""
                          : ` (needed, sphere ${held.sphere})`}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="smz3-review-facts">
        <h3 className="run-section__title" id="smz3-review-facts">
          The seed
        </h3>
        <Facts log={log} />
      </section>
    </div>
  );
};

export default Smz3ReviewPanel;
