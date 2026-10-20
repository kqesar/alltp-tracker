import { lazy, Suspense, useEffect, useRef } from "react";
import { Header } from "@/components/ui/Header";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import { useSmz3Autotrack } from "@/games/smz3/components/Smz3Autotrack";
import { Smz3Controls } from "@/games/smz3/components/Smz3Controls";
import { Smz3Grid } from "@/games/smz3/components/Smz3Grid";
import { Smz3Keycards } from "@/games/smz3/components/Smz3Keycards";
import { Smz3Maps } from "@/games/smz3/components/Smz3Maps";
import { Smz3Tokens } from "@/games/smz3/components/Smz3Tokens";
import { useSmz3Store } from "@/games/smz3/store";
import { useToolbarFit } from "@/hooks/useToolbarFit";
import { isAwayFromBoard } from "@/utils/keyboard";

// The desktop app's notice, a chunk of its own: the test is inline so the
// site's build drops the import and its chunk (docs/desktop.md)
const AppMenuPrompt =
  import.meta.env.MODE === "desktop"
    ? lazy(() => import("@/desktop/AppMenuPrompt"))
    : null;

/**
 * Undo and redo from the keyboard, as the other boards take them: Ctrl or
 * ⌘+Z, with Shift (or Ctrl+Y) to redo, never while typing in a field or with
 * a dialog open.
 */
const useSmz3UndoShortcuts = () => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isAwayFromBoard(event)) return;
      const key = event.key.toLowerCase();
      const { redo, undo } = useSmz3Store.getState();
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
 * The SMZ3 tracker: both games' items and the rewards found (and under
 * keysanity, the keys and keycards), beside the maps of Hyrule and Zebes,
 * the pack's logic colouring every location.
 */
const Smz3App = () => {
  useSmz3UndoShortcuts();
  useSmz3Autotrack();
  // Its actions show as icons once their labels no longer fit on one row:
  // it has no More menu, so the label fold is the one it takes
  const toolbarRef = useRef<HTMLDivElement>(null);
  useToolbarFit(toolbarRef);
  const keysanity = useSmz3Store((state) => state.settings.keysanity);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="notices">
        <UpdatePrompt />
        {AppMenuPrompt && (
          <Suspense fallback={null}>
            <AppMenuPrompt />
          </Suspense>
        )}
      </div>
      <Header game="smz3" />
      <div className="toolbar" data-testid="toolbar" ref={toolbarRef}>
        <Smz3Controls />
      </div>
      <main className="main-content" id="main-content">
        <div
          className="smz3-layout"
          data-keys={keysanity || undefined}
          data-testid="layout"
        >
          <div className="smz3-board">
            <Smz3Grid />
            <Smz3Tokens />
            {keysanity && <Smz3Keycards />}
          </div>
          <Smz3Maps />
        </div>
      </main>
    </>
  );
};

export default Smz3App;
