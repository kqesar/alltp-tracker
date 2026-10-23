import { useEffect } from "react";
import { isAwayFromBoard } from "@/utils/keyboard";

/** What a game's store gives the shortcuts: its history, stepped back or forward. */
interface UndoableStore {
  getState: () => { redo: () => void; undo: () => void };
}

/**
 * Ctrl/Cmd+Z undoes the last change to the run; Ctrl/Cmd+Shift+Z and Ctrl+Y
 * redo it. Ignored while typing in a field and while a dialog is open, where
 * the shortcut would act on a board the player cannot see. One hook for every
 * game's board, each passing its own store.
 */
export const useUndoShortcuts = (store: UndoableStore) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (isAwayFromBoard(event)) return;

      const key = event.key.toLowerCase();
      const { redo, undo } = store.getState();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === "y" && !event.shiftKey) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);
};
