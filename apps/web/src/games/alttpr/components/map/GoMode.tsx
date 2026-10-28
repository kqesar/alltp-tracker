import type { Tri } from "@alltp/engine";
import { useId } from "react";
import { isHidden } from "@/games/alttpr/data/presets";
import {
  useGoModeLeft,
  useLastGoModeLeft,
} from "@/games/alttpr/hooks/useRunAnalysis";
import {
  type GoModeLeft,
  goModeMarginOf,
  goModeStatusOf,
} from "@/games/alttpr/logic/missing";
import type { Need } from "@/games/alttpr/logic/needs";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";
import { placeUnder } from "@/utils/popover";

/**
 * What the button shows: the go mode's tri, or `margin` for one not yet in
 * logic that basic placement's safety margin alone holds back.
 */
type Shown = Tri | "margin";

/** Each state's glyph and words, after "Go mode". */
const STATES: Record<Shown, { glyph: string; words: string }> = {
  margin: { glyph: "★♥", words: "outside Basic's margin" },
  maybe: { glyph: "★?", words: "possible" },
  no: { glyph: "☆", words: "not yet" },
  yes: { glyph: "★", words: "in logic" },
};

/** The ways shown at once; the others behind "N more ways". */
const SHOWN_WAYS = 3;

/**
 * What the button says of a go mode not yet in logic: the fewest items any
 * way asks ("2 items left"), or that only crystals are; undefined when
 * neither can be said in a word.
 */
const goModeSummary = (left: GoModeLeft | undefined): string | undefined => {
  if (left?.kind === "crystals") return "crystals left";
  if (left?.kind !== "items") return undefined;
  const fewest = left.ways.sets[0]?.length;
  if (fewest === undefined) return undefined;
  return fewest === 1 ? "1 item left" : `${fewest} items left`;
};

/**
 * One way to go mode: its items, each with the icon the grid shows; on a
 * line joined by "+", or `alone` (the only way), one item a line.
 */
const Way = ({ alone, set }: { alone?: boolean; set: readonly Need[] }) => (
  <ul
    className={
      alone ? "go-left__needs go-left__needs--alone" : "go-left__needs"
    }
  >
    {set.map((need) => (
      <li className="go-left__need" key={need.key}>
        {need.icon && (
          <img alt="" className="need__icon" src={getAssetPath(need.icon)} />
        )}
        {need.label}
      </li>
    ))}
  </ul>
);

/** A list of ways, one row each. */
const WayRows = ({ sets }: { sets: readonly (readonly Need[])[] }) => (
  <ul className="go-left__ways">
    {sets.map((set) => (
      <li
        className="go-left__way"
        data-testid="go-mode-way"
        key={set.map((need) => need.key).join()}
      >
        <Way set={set} />
      </li>
    ))}
  </ul>
);

/** A sentence in the panel: what is left when no list can say it. */
const Line = ({ children }: { children: string }) => (
  <p className="missing" data-testid="go-mode-left">
    {children}
  </p>
);

/**
 * What the go mode is missing, crystals aside: the items of its one way,
 * or the ways to it, fewest items first, the first three in sight and the
 * others behind a disclosure; a sentence when no list can say it.
 */
const GoModeDetail = ({ tri }: { tri: Shown }) => {
  const left = useGoModeLeft();
  if (tri === "yes") {
    return <p className="missing">Every step to the goal is in logic.</p>;
  }
  return (
    <>
      {tri === "margin" && (
        <p className="missing" data-testid="go-mode-margin">
          <span className="missing__lead">
            Doable now, outside Basic's safety margin:
          </span>{" "}
          every step is open, but Basic placement waits for what is left below
          before the seed relies on it.
        </p>
      )}
      <GoModeLeftDetail left={left} tri={tri} />
    </>
  );
};

/** What the go mode is missing, from the run's analysis. */
const GoModeLeftDetail = ({
  left,
  tri,
}: {
  left: GoModeLeft | undefined;
  tri: Shown;
}) => {
  if (left === undefined) {
    return <p className="missing missing--pending">Working it out…</p>;
  }
  switch (left.kind) {
    case "crystals":
      return <Line>Only crystals left.</Line>;
    case "nothing":
      return (
        <Line>
          Nothing left to get but dungeon keys, which may sit where you cannot
          reach yet.
        </Line>
      );
    case "unknown":
      return (
        <Line>
          No item puts it in logic yet: it hangs on a setting not known yet or
          on where an item sits.
        </Line>
      );
    case "door":
      return <Line>Behind a door you have not noted.</Line>;
  }
  const { sets, truncated } = left.ways;
  if (sets.length === 0) {
    return <Line>More than three items away, crystals aside.</Line>;
  }
  const lead = tri === "no" ? "Missing" : "In logic with";
  const [first] = sets;
  if (sets.length === 1 && first !== undefined) {
    return (
      <div className="go-left" data-testid="go-mode-left">
        <p className="missing__lead go-left__lead">{lead}, crystals aside:</p>
        <Way alone set={first} />
      </div>
    );
  }
  const more = sets.slice(SHOWN_WAYS);
  return (
    <div className="go-left" data-testid="go-mode-left">
      <p className="missing__lead go-left__lead">
        {lead}, crystals aside, one of these:
      </p>
      <WayRows sets={sets.slice(0, SHOWN_WAYS)} />
      {more.length > 0 && (
        <details className="go-left__more" data-testid="go-mode-more">
          <summary>
            {more.length === 1 ? "1 more way" : `${more.length} more ways`}
          </summary>
          <WayRows sets={more} />
        </details>
      )}
      {truncated && (
        <p className="go-left__note">Others, with more items, not listed.</p>
      )}
    </div>
  );
};

/**
 * The run's go mode: whether every step to the run's goal is in logic
 * (★), possible (★?), reached but for basic placement's safety margin (★♥,
 * `goModeMarginOf`) or not yet (☆), in words beside the glyph; not yet,
 * how far it is when one word can say it ("2 items left", "crystals left").
 * A screen reader hears a change of state as it comes. A click shows what
 * is missing, crystals aside. Nothing for a goal without a go mode (all
 * dungeons, triforce hunt); a Mystery run's goal not known yet says so,
 * until the player sets it.
 */
export const GoMode = () => {
  const status = useGameStore((state) => goModeStatusOf(state)?.tri);
  // Not yet in logic, but reached without basic placement's margin
  const margin = useGameStore(goModeMarginOf);
  const tri: Shown | undefined = margin ? "margin" : status;
  const goalHidden = useGameStore((state) => isHidden(state.settings, "goal"));
  const summary = goModeSummary(useLastGoModeLeft());
  const panelId = useId();
  if (goalHidden) {
    return (
      <span className="go-mode go-mode--unknown" data-testid="go-mode">
        <span aria-hidden="true" className="go-mode__glyph">
          ?
        </span>
        Go mode: goal unknown
      </span>
    );
  }
  if (tri === undefined) return null;
  const { glyph, words } = STATES[tri];

  return (
    <>
      <button
        className={`go-mode go-mode--${tri}`}
        data-testid="go-mode"
        onClick={(event) => placeUnder(event, panelId)}
        popoverTarget={panelId}
        title="What go mode is missing"
        type="button"
      >
        <span aria-hidden="true" className="go-mode__glyph">
          {glyph}
        </span>
        <span className="go-mode__words">
          Go mode: {tri === "no" ? (summary ?? words) : words}
        </span>
      </button>
      <div
        className="go-mode-panel"
        data-testid="go-mode-panel"
        id={panelId}
        popover="auto"
      >
        <GoModeDetail tri={tri} />
      </div>
      <span className="sr-only" data-testid="go-mode-status" role="status">
        Go mode: {words}
      </span>
    </>
  );
};
