import { lazy, Suspense, useRef } from "react";
import { Header } from "@/components/ui/Header";
import { SharedRunPrompt } from "@/components/ui/SharedRunPrompt";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import { useSmAutotrack } from "@/games/sm/components/SmAutotrack";
import { SmControls } from "@/games/sm/components/SmControls";
import { SmGrid } from "@/games/sm/components/SmGrid";
import { SmObjectives } from "@/games/sm/components/SmObjectives";
import { useSmStore } from "@/games/sm/store";
import { useUndoShortcuts } from "@/games/useUndoShortcuts";
import { useToolbarFit } from "@/hooks/useToolbarFit";

// The desktop app's notice, a chunk of its own: the test is inline so the
// site's build drops the import and its chunk (docs/desktop.md)
const AppMenuPrompt =
  import.meta.env.MODE === "desktop"
    ? lazy(() => import("@/desktop/AppMenuPrompt"))
    : null;

/**
 * The Super Metroid tracker: Map Rando's items and the seed's objectives. No
 * map and no logic: Map Rando reconnects the game's rooms, and players follow
 * the game's own map (packs/sm README).
 */
const SmApp = () => {
  useUndoShortcuts(useSmStore);
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
        <SharedRunPrompt game="sm" />
        {AppMenuPrompt && (
          <Suspense fallback={null}>
            <AppMenuPrompt />
          </Suspense>
        )}
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
