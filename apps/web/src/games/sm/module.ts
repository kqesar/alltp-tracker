// Super Metroid (Map Rando) as a game module: what the shell loads for a
// device that tracks it (games/registry.ts). Its stylesheet comes with it.

import "@/games/board.css";
import "@/games/sm/sm.css";
import type { GameModule } from "@/games/registry";
import SmApp from "@/games/sm/SmApp";
import { SmObsView } from "@/games/sm/SmObsView";
import { IMPORT_ERRORS, parseSave, useSmStore } from "@/games/sm/store";
import { syncAcrossTabs } from "@/games/syncAcrossTabs";

export const sm: GameModule = {
  App: SmApp,
  importRun: (save) => {
    const parsed = parseSave(save);
    return parsed.ok
      ? { load: () => useSmStore.getState().load(parsed.progress), ok: true }
      : { ok: false, reason: IMPORT_ERRORS[parsed.error] };
  },
  ObsView: SmObsView,
  // The run follows the other tabs and the stream view through storage
  start: () => {
    syncAcrossTabs(useSmStore);
  },
  store: useSmStore,
};
