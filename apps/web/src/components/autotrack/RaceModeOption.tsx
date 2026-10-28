import { useId } from "react";
import type { RaceChoice } from "@/autotrack/raceChoice";

const CHOICES: readonly (readonly [RaceChoice, string])[] = [
  ["auto", "Auto (the ROM's race flag)"],
  ["on", "Always on"],
];

/**
 * For a game whose ROMs carry no race flag (Map Rando): On, the default, or
 * Off.
 */
const FLAGLESS_CHOICES: readonly (readonly [RaceChoice, string])[] = [
  ["on", "On"],
  ["off", "Off"],
];

/**
 * Race Mode, as the player sets it: the ROM's race flag decides, or it is
 * always on, for a race on a seed generated without the flag; for a game
 * without a race flag, on or off. Two radios in a fieldset: the arrow keys
 * move between them, and a screen reader hears the group's name and what the
 * choice does. It applies at once, to a session running or the next one.
 * @param value - The choice saved
 * @param onChange - Called with the choice the player made
 * @param flag - Whether the game's ROMs carry a race flag
 * @param remembered - Race Mode is on only because the seed was read as a
 * race's (`isRaceHeldByMemory`): the option says so, and offers to end it
 * @param onEnd - The player says the race is over
 */
export const RaceModeOption = ({
  flag = true,
  onChange,
  onEnd,
  remembered = false,
  value,
}: {
  flag?: boolean;
  onChange: (choice: RaceChoice) => void;
  onEnd?: () => void;
  remembered?: boolean;
  value: RaceChoice;
}) => {
  const id = useId();
  const choices = flag ? CHOICES : FLAGLESS_CHOICES;
  return (
    <fieldset
      aria-describedby={`${id}-hint`}
      className="race-option"
      data-testid="race-option"
    >
      <legend className="race-option__legend">Race Mode</legend>
      <div className="race-option__choices">
        {choices.map(([choice, words]) => (
          <div className="check-option" key={choice}>
            <input
              checked={value === choice}
              className="check-option__input"
              data-testid={`race-option-${choice}`}
              id={`${id}-${choice}`}
              name={id}
              onChange={() => onChange(choice)}
              type="radio"
              value={choice}
            />
            <label htmlFor={`${id}-${choice}`}>{words}</label>
          </div>
        ))}
      </div>
      <p className="race-option__hint" id={`${id}-hint`}>
        {flag
          ? "In Race Mode the tracker reads only what races permit. Set it always on to race a seed generated without the race flag."
          : "In Race Mode the tracker reads only what races permit. This game's ROMs carry no race flag, so it stays on until you turn it off, outside a race."}
      </p>
      {remembered && (
        <div className="race-option__memory" data-testid="race-remembered">
          <p id={`${id}-memory`}>
            This run's seed was read as a race's, so Race Mode stays on after
            you disconnect. Once the race is over, end it to export, share or
            review the run; a new game or an import ends it too.
          </p>
          <button
            aria-describedby={`${id}-memory`}
            className="modal-btn modal-btn--ghost"
            data-testid="race-end"
            onClick={onEnd}
            type="button"
          >
            The race is over
          </button>
        </div>
      )}
    </fieldset>
  );
};
