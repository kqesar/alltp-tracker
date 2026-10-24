import { useId } from "react";
import type { RaceChoice } from "@/autotrack/raceChoice";

const CHOICES: readonly (readonly [RaceChoice, string])[] = [
  ["auto", "Auto (the ROM's race flag)"],
  ["on", "Always on"],
];

/**
 * Race Mode, as the player sets it: the ROM's race flag decides, or it is
 * always on, for a race on a seed generated without the flag. Two radios in
 * a fieldset: the arrow keys move between them, and a screen reader hears
 * the group's name and what the choice does. It applies at once, to a
 * session running or the next one.
 * @param value - The choice saved
 * @param onChange - Called with the choice the player made
 */
export const RaceModeOption = ({
  onChange,
  value,
}: {
  onChange: (choice: RaceChoice) => void;
  value: RaceChoice;
}) => {
  const id = useId();
  return (
    <fieldset
      aria-describedby={`${id}-hint`}
      className="race-option"
      data-testid="race-option"
    >
      <legend className="race-option__legend">Race Mode</legend>
      <div className="race-option__choices">
        {CHOICES.map(([choice, words]) => (
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
        In Race Mode the tracker reads only what races permit. Set it always on
        to race a seed generated without the race flag.
      </p>
    </fieldset>
  );
};
