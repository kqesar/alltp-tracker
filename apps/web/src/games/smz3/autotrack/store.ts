// SMZ3's autotracking: the shared game session (autotrack/gameSession.ts)
// over the SMZ3 runtime, saved under its own key.

import { createGameAutotrack } from "@/autotrack/gameSession";
import type { Smz3Reading } from "@/games/smz3/autotrack/reading";

export const smz3Autotrack = createGameAutotrack<Smz3Reading>({
  game: "smz3",
  load: () =>
    import("@/games/smz3/autotrack/runtime").then((runtime) => ({
      createFollower: runtime.createSmz3Follower,
      detectEnvironment: runtime.detectEnvironment,
      start: runtime.startSmz3Runtime,
    })),
  seed: "an SMZ3 seed",
  storageKey: "alltp-tracker-smz3-autotrack",
});
