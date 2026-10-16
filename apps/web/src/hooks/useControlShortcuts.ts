import { type Chord, type ControlId, isBindable } from "@/data/keymap";
import { useGameStore } from "@/stores/gameStore";
import { useKeyboardLayout } from "@/stores/keyboardLayoutStore";
import { ariaChord } from "@/utils/keyLabels";

/** A chord the browser listener acts on, or nothing. */
const usable = (chord: Chord | undefined) =>
  chord && isBindable(chord) ? chord : undefined;

/**
 * The keyboard shortcuts that step a grid control, while shortcuts are on:
 * its chords forward and back, and both in `aria-keyshortcuts` syntax. Each
 * control subscribes to its own two bindings only.
 * @param control - The control, e.g. "hookshot" or "chest3"
 */
export const useControlShortcuts = (control: ControlId) => {
  const forward = useGameStore((state) =>
    state.shortcuts.enabled
      ? usable(state.shortcuts.keymap[`advance:${control}`])
      : undefined,
  );
  const back = useGameStore((state) =>
    state.shortcuts.enabled
      ? usable(state.shortcuts.keymap[`back:${control}`])
      : undefined,
  );
  const layout = useKeyboardLayout();

  const aria = [forward, back]
    .map((chord) => (chord ? ariaChord(chord, layout) : null))
    .filter(Boolean)
    .join(" ");
  return { aria, back, forward };
};
