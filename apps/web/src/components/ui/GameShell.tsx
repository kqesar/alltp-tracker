import { lazy, type ReactNode, Suspense, useRef } from "react";
import { Header } from "@/components/ui/Header";
import { SharedRunPrompt } from "@/components/ui/SharedRunPrompt";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import type { GameId } from "@/games/registry";
import { useToolbarFit } from "@/hooks/useToolbarFit";

// The desktop app's notice, a chunk of its own: the test is inline so the
// site's build drops the import and its chunk (docs/desktop.md)
const AppMenuPrompt =
  import.meta.env.MODE === "desktop"
    ? lazy(() => import("@/desktop/AppMenuPrompt"))
    : null;

/**
 * The page around a game's board, the same for every game: the skip links,
 * the notices (an update, a shared run, and in the desktop app the
 * application menu entry), the header, the toolbar (fitted to its row by
 * measurement, `useToolbarFit`) and the `main` landmark.
 * @param game - The game tracked, for the header and the shared-run notice
 * @param toolbar - The game's toolbar
 * @param skipLinks - The game's own skip links, after "Skip to main content"
 * @param notices - The game's own notices, after the shared-run notice
 * @param children - The board, in `main`
 */
export const GameShell = ({
  children,
  game,
  notices,
  skipLinks,
  toolbar,
}: {
  children: ReactNode;
  game: GameId;
  notices?: ReactNode;
  skipLinks?: ReactNode;
  toolbar: ReactNode;
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  useToolbarFit(toolbarRef);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {skipLinks}
      <div className="notices">
        <UpdatePrompt />
        <SharedRunPrompt game={game} />
        {notices}
        {AppMenuPrompt && (
          <Suspense fallback={null}>
            <AppMenuPrompt />
          </Suspense>
        )}
      </div>
      <Header game={game} />
      <div className="toolbar" data-testid="toolbar" ref={toolbarRef}>
        {toolbar}
      </div>
      <main className="main-content" id="main-content">
        {children}
      </main>
    </>
  );
};
