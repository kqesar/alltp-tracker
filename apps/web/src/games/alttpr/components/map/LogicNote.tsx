import { useShallow } from "zustand/react/shallow";
import { doorNotes } from "@/games/alttpr/data/doorRando";
import { crossedLogic, unmodelledReasons } from "@/games/alttpr/data/presets";
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
 * (`unmodelledReasons`: a glitched logic, an entrance shuffle, shuffled
 * bosses behind one, a Door Randomizer seed's door, overworld or enemy
 * shuffle) and that every check is maybe. A Door Randomizer seed whose logic
 * it does model says whose logic it borrows meanwhile (`doorNotes`).
 * Nothing for any other run.
 */
export const LogicNote = () => {
  const reasons = useGameStore(
    useShallow((state) => unmodelledReasons(state.settings)),
  );
  const crossed = useGameStore((state) => crossedLogic(state.settings));
  const door = useGameStore(
    useShallow((state) =>
      unmodelledReasons(state.settings).length === 0
        ? doorNotes(state.settings, crossedLogic(state.settings))
        : [],
    ),
  );
  const doorNote =
    door.length > 0 ? (
      <p className="logic-note" data-testid="logic-note-door">
        {door.join(" ")}
      </p>
    ) : null;
  if (crossed)
    return (
      <>
        <p className="logic-note" data-testid="logic-note">
          The logic follows the entrances you noted: a check behind a door you
          have not noted stays out of logic.
        </p>
        {doorNote}
      </>
    );
  if (reasons.length === 0) return doorNote;
  return (
    <p className="logic-note" data-testid="logic-note">
      The tracker has no logic for {listOf(reasons)} yet: every check shows as
      maybe.
    </p>
  );
};
