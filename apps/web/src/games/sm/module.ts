// Super Metroid (Map Rando) as a game module: what the shell loads for a
// device that tracks it (games/registry.ts). Its stylesheet comes with it.

import "@/games/sm/sm.css";
import type { GameModule } from "@/games/registry";
import SmApp from "@/games/sm/SmApp";
import { SmObsView } from "@/games/sm/SmObsView";
import { SM_STORAGE_KEY, useSmStore } from "@/games/sm/store";

export const sm: GameModule = {
  App: SmApp,
  ObsView: SmObsView,
  // The run follows the other tabs and the stream view through storage
  start: () => {
    window.addEventListener("storage", (event) => {
      if (event.key === SM_STORAGE_KEY) void useSmStore.persist.rehydrate();
    });
  },
};
