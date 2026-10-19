import { useEffect, useRef } from "react";
import { Header } from "@/components/ui/Header";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import { useSmAutotrack } from "@/games/sm/components/SmAutotrack";
import { SmControls } from "@/games/sm/components/SmControls";
import { SmGrid } from "@/games/sm/components/SmGrid";
import { SmObjectives } from "@/games/sm/components/SmObjectives";
import { useSmStore } from "@/games/sm/store";
import { useToolbarFit } from "@/hooks/useToolbarFit";
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
  useSmAutotrack();
  // Its actions show as icons once their labels no longer fit on one row:
  // it has no More menu, so the label fold is the one it takes
  const toolbarRef = useRef<HTMLDivElement>(null);
  useToolbarFit(toolbarRef);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="notices">
        <UpdatePrompt />
      </div>
      <Header game="sm" />
      <div className="toolbar" data-testid="toolbar" ref={toolbarRef}>
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
