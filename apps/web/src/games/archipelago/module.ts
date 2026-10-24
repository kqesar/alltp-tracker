// Archipelago as a game module: what the shell loads for a device that
// tracks an Archipelago room (games/registry.ts). Its stylesheet comes with
// it; the session's code is a chunk of its own, loaded on Connect.

import "@/games/board.css";
import "@/games/archipelago/archipelago.css";
import ArchipelagoApp from "@/games/archipelago/ArchipelagoApp";
import { ArchipelagoObsView } from "@/games/archipelago/ArchipelagoObsView";
import { followOtherTabs } from "@/games/archipelago/connection";
import { useArchipelagoStore } from "@/games/archipelago/store";
import type { GameModule } from "@/games/registry";
import { syncAcrossTabs } from "@/games/syncAcrossTabs";

/** Why a save or a shared link never opens on this board. */
export const IMPORT_REFUSAL =
  "An Archipelago board is not shared or imported: connect to the room instead.";

export const archipelago: GameModule = {
  App: ArchipelagoApp,
  importRun: () => ({ ok: false, reason: IMPORT_REFUSAL }),
  ObsView: ArchipelagoObsView,
  // The run and the connection's settings follow the other tabs and the
  // stream view through storage
  start: () => {
    syncAcrossTabs(useArchipelagoStore);
    followOtherTabs();
  },
  store: useArchipelagoStore,
};
