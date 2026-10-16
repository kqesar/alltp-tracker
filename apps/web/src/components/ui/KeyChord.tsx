import { Fragment } from "react";
import type { Chord } from "@/data/keymap";
import { useKeyboardLayout } from "@/stores/keyboardLayoutStore";
import { chordKeys } from "@/utils/keyLabels";

/**
 * A chord drawn as the keys to press, labelled for the player's keyboard
 * layout: `<kbd><kbd>Shift</kbd>+<kbd>W</kbd></kbd>`, HTML's markup for a key
 * combination.
 * @param chord - The chord, e.g. "Shift+KeyW"
 */
export const KeyChord = ({ chord }: { chord: Chord }) => {
  const keys = chordKeys(chord, useKeyboardLayout());
  return (
    <kbd className="key-chord">
      {keys.map((key, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the keys of one chord, never reordered
        <Fragment key={index}>
          {index > 0 && <span className="key-chord__plus">+</span>}
          <kbd className="key-chord__key">{key}</kbd>
        </Fragment>
      ))}
    </kbd>
  );
};
