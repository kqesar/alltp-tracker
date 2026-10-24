import { memo, useId } from "react";
import type { ApHint } from "@/games/archipelago/store";
import { useArchipelagoStore } from "@/games/archipelago/store";

/** Each AP 0.6 status in words: the badge's text, never its colour alone. */
const STATUS_WORDS: Readonly<Record<ApHint["status"], string>> = {
  avoid: "Avoid",
  found: "Found",
  "no-priority": "No priority",
  priority: "Priority",
  unspecified: "Unspecified",
};

const HintRow = memo(({ hint }: { hint: ApHint }) => (
  <li className="ap-hint" data-status={hint.status} data-testid="ap-hint">
    <span className="ap-hint__status">{STATUS_WORDS[hint.status]}</span>
    <span className="ap-hint__what">
      <span className="ap-feed__item">{hint.item}</span>
      {hint.forMe ? null : (
        <>
          {" for "}
          <span className="ap-feed__player">{hint.receiver}</span>
        </>
      )}
      {" at "}
      <span className="ap-feed__location">{hint.location}</span>
      {hint.forMe && (
        <>
          {" in "}
          <span className="ap-feed__player">{hint.finder}</span>
          {"'s world"}
        </>
      )}
      {hint.entrance !== "" && ` (via ${hint.entrance})`}
    </span>
  </li>
));

const HintList = ({
  empty,
  hints,
  title,
}: {
  empty: string;
  hints: readonly ApHint[];
  title: string;
}) => {
  const id = useId();
  return (
    <section aria-labelledby={id} className="ap-hints__group">
      <h3 className="ap-panel__subheading" id={id}>
        {title} <span className="ap-items__count">({hints.length})</span>
      </h3>
      {hints.length === 0 ? (
        <p className="ap-panel__empty">{empty}</p>
      ) : (
        <ul className="ap-hints__list">
          {hints.map((hint) => (
            <HintRow
              hint={hint}
              key={`${hint.receiver}|${hint.finder}|${hint.location}|${hint.item}`}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

/**
 * The slot's hints, as the room holds them (`_read_hints`): the items it
 * will receive and where they sit, then the items others will receive from
 * its world; most wanted first, found last, each status in words. The hint
 * points and what a hint costs. The board never asks for a hint: the
 * player's game client does.
 */
export const HintsPanel = () => {
  const hints = useArchipelagoStore((state) => state.hints);
  const points = useArchipelagoStore((state) => state.hintPoints);
  const cost = useArchipelagoStore((state) => state.hintCost);
  const forMe = hints.filter((hint) => hint.forMe);
  const forOthers = hints.filter((hint) => !hint.forMe);
  return (
    <div className="ap-hints" data-testid="ap-hints">
      {points !== null && (
        <p className="ap-hints__points" data-testid="ap-hint-points">
          {points} hint {points === 1 ? "point" : "points"}
          {cost !== null && cost > 0 && ` · a hint costs ${cost}`}
        </p>
      )}
      <HintList
        empty="No hint for you yet. Ask one from your game's client (!hint)."
        hints={forMe}
        title="Items for you"
      />
      <HintList
        empty="No hint names an item in your world yet."
        hints={forOthers}
        title="Others' items in your world"
      />
    </div>
  );
};
