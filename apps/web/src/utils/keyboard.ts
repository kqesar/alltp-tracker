/** Elements whose own keys (typing, text editing) must win over the tracker's. */
const EDITABLE =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Whether a key press is meant for something other than the board: a field
 * being typed in, or an open dialog, which covers the board the player would
 * be changing without seeing it.
 * @param event - The keydown event
 */
export const isAwayFromBoard = (event: KeyboardEvent): boolean => {
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(
    target?.closest(EDITABLE) || document.querySelector("dialog[open]"),
  );
};
