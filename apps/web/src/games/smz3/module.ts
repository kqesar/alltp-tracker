// SMZ3 (samus.link) as a game module: what the shell loads for a device that
// tracks it (games/registry.ts). Its stylesheet comes with it.

import "@/games/board.css";
import "@/games/smz3/smz3.css";
import type { GameModule } from "@/games/registry";
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
  // The run follows the other tabs and the stream view through storage
  start: () => {
    syncAcrossTabs(useSmz3Store);
  },
};
