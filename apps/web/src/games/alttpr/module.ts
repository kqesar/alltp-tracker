// A Link to the Past Randomizer as a game module: what the shell loads for a
// device that tracks it (games/registry.ts).

import App from "@/games/alttpr/App";
import { ObsView } from "@/games/alttpr/ObsView";
import { syncAcrossTabs } from "@/games/alttpr/stores/crossTabSync";
import type { GameModule } from "@/games/registry";

export const alttpr: GameModule = {
  App,
  ObsView,
  // The run follows the other tabs and the stream view through storage
  start: syncAcrossTabs,
};
