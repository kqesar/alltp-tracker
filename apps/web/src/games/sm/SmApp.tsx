import { useEffect } from "react";
import { Header } from "@/components/ui/Header";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import { SmControls } from "@/games/sm/components/SmControls";
import { SmGrid } from "@/games/sm/components/SmGrid";
import { SmObjectives } from "@/games/sm/components/SmObjectives";
import { useSmStore } from "@/games/sm/store";
import { isAwayFromBoard } from "@/utils/keyboard";

/**
 * Undo and redo from the keyboard, as ALttPR's board takes them: Ctrl or ⌘+Z,
 * with Shift (or Ctrl+Y) to redo, never while typing in a field or with a
 * dialog open.
 */
const useSmUndoShortcuts = () => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isAwayFromBoard(event)) return;
      const key = event.key.toLowerCase();
      const { redo, undo } = useSmStore.getState();
      if (key === "z" && !event.shiftKey) undo();
      else if ((key === "z" && event.shiftKey) || key === "y") redo();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};

/**
 * The Super Metroid tracker: Map Rando's items and the seed's objectives. No
 * map and no logic: Map Rando reconnects the game's rooms, and players follow
 * the game's own map (packs/sm README).
 */
const SmApp = () => {
  useSmUndoShortcuts();
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="notices">
        <UpdatePrompt />
      </div>
      <Header game="sm" />
      <div className="toolbar" data-testid="toolbar">
        <SmControls />
      </div>
      <main className="main-content" id="main-content">
        <div className="sm-layout" data-testid="layout">
          <SmGrid />
          <SmObjectives />
        </div>
      </main>
    </>
  );
};

export default SmApp;
