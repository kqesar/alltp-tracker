// A Link to the Past Randomizer as a game module: what the shell loads for a
// device that tracks it (games/registry.ts).

import App from "@/games/alttpr/App";
import { ObsView } from "@/games/alttpr/ObsView";
import { syncAcrossTabs } from "@/games/alttpr/stores/crossTabSync";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { parseSave } from "@/games/alttpr/stores/persistence";
import type { GameModule } from "@/games/registry";

export const alttpr: GameModule = {
  App,
  importRun: (save) => {
    const parsed = parseSave(save);
    return parsed.ok
      ? {
          load: () => useGameStore.getState().loadProgress(parsed.progress),
          ok: true,
        }
      : { ok: false, reason: parsed.reason };
  },
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
