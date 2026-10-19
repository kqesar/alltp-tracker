import { Fragment } from "react";
import type { Doubt, Missing } from "@/games/alttpr/logic/missing";
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

/** Whether a list of ways is the one empty set: nothing to get. */
const isThere = (ways: Ways) =>
  ways.sets.length === 1 && ways.sets[0]?.length === 0;

/**
 * What a location is missing, line by line: out of logic, what puts it in
 * logic ("Missing") and, when less does, what makes it possible; only
 * possible, what puts it in logic and why it is only possible ("Maybe").
 * @param missing - The analysis of the location: null when it is in logic,
 * undefined while the analysis is pending
 * @param pending - What to say while it is pending; nothing by default
 */
export const MissingLines = ({
  missing,
  pending,
}: {
  missing: Missing | null | undefined;
  pending?: string;
}) => {
  if (missing === undefined) {
    return pending ? (
      <p className="missing missing--pending">{pending}</p>
    ) : null;
  }
  if (missing === null) return null;
  const { doubts, inLogic, possible, tri } = missing;
  return (
    <>
      {tri === "no" && (
        <p className="missing" data-testid="missing-in-logic">
          <span className="missing__lead">Missing:</span>{" "}
          <WaysList ways={inLogic} />
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
