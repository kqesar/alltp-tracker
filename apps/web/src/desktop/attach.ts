// What the desktop app's page does with the run it tracks, once its game has
// loaded: gives it to the run feed, then lets live follow pick up a relay that
// is already running (a game switch loads the page again). Imported in the
// desktop build only (main.tsx).

import { attachFollow } from "@/desktop/liveFollow";
import { setRun } from "@/desktop/runFeed";
import type { GameId, RunStore } from "@/games/registry";

export const attachRun = async (game: GameId, store: RunStore) => {
  setRun(game, store);
  await attachFollow();
};
