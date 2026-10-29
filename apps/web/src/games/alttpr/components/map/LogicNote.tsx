import { useShallow } from "zustand/react/shallow";
import {
  crossedLogic,
  GLITCHES_LABELS,
  noLogicRun,
  playGlitchesOf,
  unmodelledReasons,
} from "@/games/alttpr/data/presets";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** "A", "A and B", "A, B and C". */
const listOf = (items: readonly string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * What the map's states rest on, when not the whole world: with shuffled
 * entrances, the doors noted (a check behind a door not noted stays out of
 * logic); under logic the pack does not model yet, the causes by name
 * (`unmodelledReasons`: a glitched logic, an entrance shuffle) and that
 * every check is maybe; in a No Logic run,
 * that the seed promises no route and what the map shows instead. Nothing
 * for any other run.
 */
export const LogicNote = () => {
  const reasons = useGameStore(
    useShallow((state) => unmodelledReasons(state.settings)),
  );
  const crossed = useGameStore((state) => crossedLogic(state.settings));
  const noLogic = useGameStore((state) => noLogicRun(state.settings));
  const play = useGameStore((state) => playGlitchesOf(state.settings));
  if (crossed)
    return (
      <p className="logic-note" data-testid="logic-note">
        The logic follows the entrances you noted: a check behind a door you
        have not noted stays out of logic.
      </p>
    );
  if (reasons.length === 0 && noLogic)
    return (
      <p className="logic-note" data-testid="logic-note">
        No Logic: the seed promises no route, so nothing is in logic. The map
        shows what you can reach{" "}
        {play === "none" ? "without glitches" : `with ${GLITCHES_LABELS[play]}`}{" "}
        (set under <strong>Played with</strong> in Mode). A key may sit behind
        its own door: a key door stays maybe until every spot its key may sit in
        is reached, or you mark its keys (<strong>Show key cells</strong>).
      </p>
    );
  if (reasons.length === 0) return null;
  return (
    <p className="logic-note" data-testid="logic-note">
      The tracker has no logic for {listOf(reasons)} yet: every check shows as
      maybe.
    </p>
  );
};
