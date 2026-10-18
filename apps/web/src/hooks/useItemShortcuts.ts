import { useEffect } from "react";
import {
  actionFor,
  type ControlId,
  chordOf,
  isBindable,
  isKeyControl,
  isMapCompassControl,
  parseAction,
} from "@/data/keymap";
import { wildItems } from "@/data/presets";
import { type Direction, useGameStore } from "@/stores/gameStore";
import { isAwayFromBoard } from "@/utils/keyboard";

/** A grid control to step, and which way. */
type Step = { control: ControlId; direction: Direction };

/**
 * The step a key press asks for, or null when the press is not a tracker
 * shortcut: shortcuts are off, the key is unbound, the player is typing in a
 * field or composing with an IME, or a dialog covers the board.
 * @param event - The keydown event
 */
export const shortcutStepFor = (event: KeyboardEvent): Step | null => {
  // keyCode 229: the key an IME is composing with, in older engines
  if (event.isComposing || event.keyCode === 229) return null;
  const { bigKeysVisible, settings, shortcuts } = useGameStore.getState();
  if (!shortcuts.enabled || isAwayFromBoard(event)) return null;

  const chord = chordOf(event);
  // A chord the browser or the system owns is never taken, whatever the
  // keymap holds (one written by the desktop app, say)
  if (!chord || !isBindable(chord)) return null;
  const action = actionFor(shortcuts.keymap, chord);
  if (!action) return null;

  const { control, direction } = parseAction(action);
  // A key cell can only be clicked while it is shown; so it is with its keys,
  // and its map and compass, shown only when they lie outside their dungeons
  if (isKeyControl(control) && !bigKeysVisible) return null;
  if (isMapCompassControl(control) && !wildItems(settings).mapsAndCompasses) {
    return null;
  }
  return { control, direction: direction === "back" ? -1 : 1 };
};

/**
 * Step a control exactly as its click (forward) or right-click (back) does.
 * @param control - The control, e.g. "hookshot", "chest3" or "smallkey3"
 * @param direction - 1 forward, -1 back
 */
export const stepControl = (control: ControlId, direction: Direction) => {
  const state = useGameStore.getState();
  const [, kind, index] = /^(smallkey|medallion)(\d+)$/.exec(control) ?? [];
  if (kind === "smallkey") state.handleSmallKeyClick(Number(index), direction);
  else if (kind === "medallion") state.stepMedallion(Number(index), direction);
  else state.handleItemClick(control, direction);
};

/**
 * The item shortcuts: a key bound in the keymap steps its grid control, one
 * undoable step per press, as a click would. A key held down claims its
 * repeats without stepping again. The listener leaves alone a key press
 * another handler already took (the focused cell's "-", the undo shortcuts)
 * and every chord it cannot bind, so Tab, Ctrl/Cmd+R and the like keep their
 * job.
 */
export const useItemShortcuts = () => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const step = shortcutStepFor(event);
      if (!step) return;

      event.preventDefault();
      if (event.repeat) return;
      stepControl(step.control, step.direction);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
