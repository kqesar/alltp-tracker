// A Link to the Past Randomizer as a game module: what the shell loads for a
// device that tracks it (games/registry.ts).

import App from "@/games/alttpr/App";
import { ObsView } from "@/games/alttpr/ObsView";
import { syncAcrossTabs } from "@/games/alttpr/stores/crossTabSync";
import type { GameModule } from "@/games/registry";

export const alttpr: GameModule = {
  App,
  ObsView,
  start: () => {
    // The run follows the other tabs and the stream view through storage
    syncAcrossTabs();
    // The desktop app's global shortcuts are this game's alone: only ALttPR
    // has a keymap. Tested inline, so the site's build drops the import
    // (docs/desktop.md).
    if (import.meta.env.MODE === "desktop") {
      void import("@/games/alttpr/desktop/globalShortcuts")
        .then(({ startGlobalShortcuts }) => startGlobalShortcuts())
        .catch((error: unknown) => {
          console.warn("Global shortcuts are not available:", error);
        });
    }
  },
};
