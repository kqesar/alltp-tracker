// Super Metroid's autotracking: the shared game session (autotrack/
// gameSession.ts) over the Map Rando runtime, saved under its own key.

import { createGameAutotrack } from "@/autotrack/gameSession";
import type { SmReading } from "@/games/sm/autotrack/reading";

export const smAutotrack = createGameAutotrack<SmReading>({
  load: () =>
    import("@/games/sm/autotrack/runtime").then((runtime) => ({
      createFollower: runtime.createSmFollower,
      detectEnvironment: runtime.detectEnvironment,
      start: runtime.startSmRuntime,
    })),
  storageKey: "alltp-tracker-sm-autotrack",
});

export const {
  connect: connectSmAutotrack,
  disconnect: disconnectSmAutotrack,
  retry: retrySmAutotrack,
  setOptions: setSmAutotrackOptions,
  stop: stopSmAutotrack,
  useStore: useSmAutotrackStore,
} = smAutotrack;
