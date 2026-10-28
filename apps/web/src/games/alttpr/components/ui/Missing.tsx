import type { TrickId } from "@alltp/pack-alttpr";
import { Fragment } from "react";
import { OutLink } from "@/components/ui/OutLink";
import { TRICK_WORDS } from "@/games/alttpr/data/tricks";
import {
  type Doubt,
  isThere,
  type Margin,
  type Missing,
  type MissingGroup,
  type Spot,
} from "@/games/alttpr/logic/missing";
import type { Ways } from "@/games/alttpr/logic/needs";
import { getAssetPath } from "@/games/alttpr/utils";

/** "a, b or c" */
const listed = (words: readonly string[]): string =>
  words.length < 2
    ? (words[0] ?? "")
    : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;

/** Why a location is only possible, in a sentence. */
export const doubtText = (doubt: Doubt): string => {
  switch (doubt.kind) {
    case "keys":
      return `${doubt.dungeon}'s ${doubt.key} may be behind ${listed(doubt.spots)}`;
    case "medallion":
      return `${doubt.dungeon}'s medallion is not noted yet`;
    case "placement":
      return "it depends on where an item was placed";
    case "hearts":
      return doubt.hearts > 0
        ? `it takes ${doubt.hearts} hearts${doubt.basic ? " (Basic placement)" : ""}, and your hearts are not set`
        : "it takes hearts, and your hearts are not set";
    case "bombs":
      return "it takes the Ten Bombs, which no cell records: autotracking reads them from the game";
    case "flute":
      return "it takes the flute activated, which Race Mode does not read";
  }
};

/**
 * The ways to get somewhere, each thing with its icon: "Hammer, or Moon
 * Pearl + Power Glove". None within three things says so, and one behind
 * a door not noted that; a list the engine cut short ends with "and more".
 */
export const WaysList = ({ ways }: { ways: Ways }) => {
  if (ways.door) {
    return <span className="ways__far">a door you have not noted</span>;
  }
  if (ways.sets.length === 0) {
    return <span className="ways__far">more than three items away</span>;
  }
  return (
    <>
      {ways.sets.map((set, index) => (
        <Fragment key={set.map((need) => need.key).join()}>
          {index > 0 && ", or "}
          <span className="ways__set">
            {set.map((need, at) => (
              <Fragment key={need.key}>
                {at > 0 && " + "}
                <span className="need">
                  {need.icon && (
                    <img
                      alt=""
                      className="need__icon"
                      src={getAssetPath(need.icon)}
                    />
                  )}
                  {need.label}
                </span>
              </Fragment>
            ))}
          </span>
        </Fragment>
      ))}
      {ways.truncated && ", and more"}
    </>
  );
};

/**
 * The tricks that open a check, by name: "Fake flipper, or Water walk +
 * Fake flipper". With `guides`, each name links to the page or video that
 * teaches it.
 */
export const TrickWays = ({
  guides = false,
  ways,
}: {
  guides?: boolean;
  ways: readonly (readonly TrickId[])[];
}) => (
  <>
    {ways.map((set) => (
      <Fragment key={set.join()}>
        {set !== ways[0] && ", or "}
        <span className="ways__set">
          {set.map((id, at) => {
            const { guides: pages, name } = TRICK_WORDS[id];
            const page = pages[0];
            return (
              <Fragment key={id}>
                {at > 0 && " + "}
                {guides && page !== undefined ? (
                  <OutLink label={name} url={page.url} />
                ) : (
                  name
                )}
              </Fragment>
            );
          })}
        </span>
      </Fragment>
    ))}
  </>
);

/** What a check outside basic placement's safety margin leads with. */
const MARGIN_LEAD = "Doable now, outside Basic's safety margin";

/** Why such a check is out of logic, in the player's words. */
const MARGIN_WHY =
  "Basic placement counts on it only once Link can take more hits (hearts, sword, bottles or mail).";

/** The hearts Link has, after a margin's ways that ask for hearts. */
const HeartsHeld = ({ margin }: { margin: Margin }) =>
  margin.hearts === undefined ? null : <> (you have {margin.hearts} hearts)</>;

/**
 * What a location is missing, line by line: out of logic, what puts it in
 * logic ("Missing") and, when less does, what makes it possible; only
 * possible, what puts it in logic and why it is only possible ("Maybe").
 * @param missing - The analysis of the location: null when it is in logic,
 * undefined while the analysis is pending
 * @param pending - What to say while it is pending; nothing by default
 * @param guides - Link the tricks it names to their guides
 */
export const MissingLines = ({
  guides,
  missing,
  pending,
}: {
  guides?: boolean;
  missing: Missing | null | undefined;
  pending?: string;
}) => {
  if (missing === undefined) {
    return pending ? (
      <p className="missing missing--pending">{pending}</p>
    ) : null;
  }
  if (missing === null) return null;
  const { doubts, inLogic, margin, possible, tri, tricks } = missing;
  return (
    <>
      {tri === "no" && margin && (
        <p className="missing" data-testid="missing-margin">
          <span className="missing__lead">{MARGIN_LEAD}:</span> {MARGIN_WHY}
        </p>
      )}
      {tri === "no" && tricks && (
        <p className="missing" data-testid="missing-tricks">
          <span className="missing__lead">Doable now with:</span>{" "}
          <TrickWays guides={guides} ways={tricks} />
        </p>
      )}
      {tri === "no" && (
        <p className="missing" data-testid="missing-in-logic">
          <span className="missing__lead">
            {margin ? "In logic with:" : "Missing:"}
          </span>{" "}
          <WaysList ways={inLogic} />
          {margin && <HeartsHeld margin={margin} />}
        </p>
      )}
      {tri === "maybe" && !isThere(inLogic) && (
        <p className="missing" data-testid="missing-in-logic">
          <span className="missing__lead">In logic with:</span>{" "}
          <WaysList ways={inLogic} />
        </p>
      )}
      {possible && (
        <p className="missing" data-testid="missing-possible">
          <span className="missing__lead">Possible with:</span>{" "}
          <WaysList ways={possible} />
        </p>
      )}
      {doubts.map((doubt) => (
        <p
          className="missing"
          data-testid="missing-doubt"
          key={doubtText(doubt)}
        >
          <span className="missing__lead">Maybe:</span> {doubtText(doubt)}
        </p>
      ))}
    </>
  );
};

/**
 * Why a group of checks is only possible, in a few words: what their
 * doubts have in common, not the spots a key may be behind (they differ by
 * check, and the Checks list's "Why?" says them).
 */
export const shortDoubts = (doubts: readonly Doubt[]): string[] => {
  const keys = [
    ...new Set(
      doubts.flatMap((doubt) => (doubt.kind === "keys" ? [doubt.key] : [])),
    ),
  ].sort();
  return [
    ...(keys.length > 0
      ? [`${keys.join(" and ")} may be behind other checks`]
      : []),
    ...(doubts.some(({ kind }) => kind === "medallion")
      ? ["medallion not noted yet"]
      : []),
    ...(doubts.some(({ kind }) => kind === "placement")
      ? ["depends on where an item was placed"]
      : []),
  ];
};

/** A spot's name; a room shared by several checks says how many. */
const SpotName = ({ spot }: { spot: Spot }) => (
  <>
    {spot.name}
    {spot.count > 1 && (
      <>
        <span aria-hidden="true" className="missing__count">
          {` ×${spot.count}`}
        </span>
        <span className="sr-only"> ({spot.count} checks)</span>
      </>
    )}
  </>
);

/**
 * Checks that miss the same thing, one line each: what they miss, then
 * which ("Lantern: Dark Maze ×2, Big Chest, Boss"). The ways are a single
 * check's (WaysList); a check only maybe says what puts it in logic and why
 * it is not yet ("Maybe, small key may be behind other checks: Compass
 * Chest"). A check a trick known opens leads with it: "Doable now with Fake
 * flipper; or Zora's Flippers: King Zora"; one out of logic by basic
 * placement's safety margin alone says so: "Doable now, outside Basic's
 * safety margin; in logic with 15 hearts (you have 11 hearts): Big Chest".
 */
export const MissingGroups = ({
  groups,
  guides,
}: {
  groups: readonly MissingGroup[];
  guides?: boolean;
}) => (
  <>
    {groups.map(({ key, missing, spots }) => {
      const { inLogic, margin, possible, tri, tricks } = missing;
      const doubted = shortDoubts(missing.doubts);
      return (
        <p
          className="missing missing--group"
          data-testid="missing-group"
          key={key}
        >
          {tri === "no" && margin && (
            <>
              <span className="missing__lead">
                {MARGIN_LEAD}; in logic with
              </span>{" "}
            </>
          )}
          {tri === "no" && !margin && tricks && (
            <>
              <span className="missing__lead">Doable now with</span>{" "}
              <TrickWays guides={guides} ways={tricks} />
              <span className="missing__lead">; or</span>{" "}
            </>
          )}
          {tri === "no" && <WaysList ways={inLogic} />}
          {tri === "no" && margin && <HeartsHeld margin={margin} />}
          {tri === "no" && possible && (
            <>
              {" "}
              <span className="missing__lead">(possible with</span>{" "}
              <WaysList ways={possible} />
              <span className="missing__lead">)</span>
            </>
          )}
          {tri === "maybe" && !isThere(inLogic) && (
            <>
              <span className="missing__lead">In logic with</span>{" "}
              <WaysList ways={inLogic} />
              {doubted.length > 0 && "; "}
            </>
          )}
          {tri === "maybe" && doubted.length > 0 && (
            <>
              <span className="missing__lead">Maybe,</span> {doubted.join("; ")}
            </>
          )}
          <span className="missing__lead">:</span>{" "}
          {spots.map((spot, index) => (
            <Fragment key={spot.name}>
              {index > 0 && ", "}
              <SpotName spot={spot} />
            </Fragment>
          ))}
        </p>
      );
    })}
  </>
);
