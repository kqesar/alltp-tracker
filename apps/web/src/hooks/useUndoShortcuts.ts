import { useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";

/** Elements whose own Ctrl+Z (text editing) must win over the tracker's. */
const EDITABLE = "input, textarea, select, [contenteditable]";

/**
 * Ctrl/Cmd+Z undoes the last change to the run; Ctrl/Cmd+Shift+Z and Ctrl+Y
 * redo it. Ignored while typing in a field and while a dialog is open, where
 * the shortcut would act on a board the player cannot see.
 */
export const useUndoShortcuts = () => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(EDITABLE) || document.querySelector("dialog[open]")) {
        return;
      }

      const key = event.key.toLowerCase();
      const { redo, undo } = useGameStore.getState();
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
  }, []);
};
