// SMZ3 (samus.link) as a game module: what the shell loads for a device that
// tracks it (games/registry.ts). Its stylesheet comes with it.

import "@/games/board.css";
import "@/games/review.css";
import "@/games/smz3/smz3.css";
import { raceSourceOf } from "@/autotrack/raceMode";
import { raceFeed } from "@/follow/raceRun";
import type { GameModule } from "@/games/registry";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import Smz3App from "@/games/smz3/Smz3App";
import { Smz3ObsView } from "@/games/smz3/Smz3ObsView";
import { unpackLink } from "@/games/smz3/share";
import { IMPORT_ERRORS, parseSave, useSmz3Store } from "@/games/smz3/store";
import { syncAcrossTabs } from "@/games/syncAcrossTabs";

export const smz3: GameModule = {
  App: Smz3App,
  importRun: (text) => {
    const unpacked = unpackLink(text);
    if (!unpacked.ok) return unpacked;
    const parsed = parseSave(unpacked.save);
    return parsed.ok
      ? { load: () => useSmz3Store.getState().load(parsed.progress), ok: true }
      : { ok: false, reason: IMPORT_ERRORS[parsed.error] };
  },
  ObsView: Smz3ObsView,
  // In Race Mode the desktop app relays what the stream view and the
  // followed view draw: the grid (its items and the settings that lay it)
  // and the timer. Never the places checked, the pads noted or the seed.
  race: raceFeed({
    fresh: () =>
      useSmz3Store.persist
        .getOptions()
        .partialize?.(useSmz3Store.getInitialState()) ?? {},
    kept: ["items", "settings", "timer"],
    source: raceSourceOf(smz3Autotrack.useStore),
  }),
  // The run follows the other tabs and the stream view through storage
  start: () => {
    syncAcrossTabs(useSmz3Store);
  },
  store: useSmz3Store,
};
