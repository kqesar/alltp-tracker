// What the desktop app's page does with the run it tracks, once its game has
// loaded: gives it to the run feed, then lets live follow and the stream view
// pick up the servers that are already running (a game switch loads the page
// again). Imported in the desktop build only (main.tsx).

import { attachFollow } from "@/desktop/liveFollow";
import { setOverlayGame } from "@/desktop/overlayFeed";
import { setRun } from "@/desktop/runFeed";
import { attachStream } from "@/desktop/streamTools";
import type { GameId, RunStore } from "@/games/registry";

export const attachRun = async (game: GameId, store: RunStore) => {
  setRun(game, store);
  setOverlayGame(game);
  await Promise.all([attachFollow(), attachStream()]);
};
