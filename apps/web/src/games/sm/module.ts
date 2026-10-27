// Super Metroid (Map Rando) as a game module: what the shell loads for a
// device that tracks it (games/registry.ts). Its stylesheet comes with it.

import "@/games/board.css";
import "@/games/review.css";
import "@/games/sm/sm.css";
import { raceSourceOf } from "@/autotrack/raceMode";
import { raceFeed } from "@/follow/raceRun";
import type { GameModule } from "@/games/registry";
import { useSmAutotrackStore } from "@/games/sm/autotrack/store";
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
  // In Race Mode the desktop app relays what the stream view and the
  // followed view draw: the grid and the timer. Never the locations found,
  // the seed or the objectives.
  race: raceFeed({
    fresh: () =>
      useSmStore.persist
        .getOptions()
        .partialize?.(useSmStore.getInitialState()) ?? {},
    kept: ["items", "splitSpeed", "timer", "wallJump"],
    source: raceSourceOf(useSmAutotrackStore),
  }),
  // The run follows the other tabs and the stream view through storage
  start: () => {
    syncAcrossTabs(useSmStore);
  },
  store: useSmStore,
};
