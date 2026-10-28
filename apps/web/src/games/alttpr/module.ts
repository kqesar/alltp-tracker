// A Link to the Past Randomizer as a game module: what the shell loads for a
// device that tracks it (games/registry.ts).

import "@/games/review.css";
import { raceSourceOf } from "@/autotrack/raceMode";
import { raceFeed } from "@/follow/raceRun";
import App from "@/games/alttpr/App";
import { withoutEscape } from "@/games/alttpr/logic/packItems";
import { ObsView } from "@/games/alttpr/ObsView";
import { unpackLink } from "@/games/alttpr/share";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { parseSave } from "@/games/alttpr/stores/persistence";
import type { GameModule } from "@/games/registry";
import { syncAcrossTabs } from "@/games/syncAcrossTabs";

export const alttpr: GameModule = {
  App,
  importRun: (text) => {
    const unpacked = unpackLink(text);
    if (!unpacked.ok) return unpacked;
    const parsed = parseSave(unpacked.save);
    return parsed.ok
      ? {
          load: () => useGameStore.getState().loadProgress(parsed.progress),
          ok: true,
        }
      : { ok: false, reason: parsed.reason };
  },
  ObsView,
  // In Race Mode the desktop app relays what the stream view and the
  // followed view draw: the grid (its items, keys, medallions and run type)
  // and the timer. Never the places checked, their times, the entrances
  // noted or the seed.
  race: raceFeed({
    // The escape autotracking read before the race: Zelda's rescue, which no
    // race is told, and which no relayed view draws
    cut: (state) =>
      typeof state.items === "object" && state.items !== null
        ? {
            ...state,
            items: withoutEscape(state.items as Record<string, unknown>),
          }
        : state,
    fresh: () =>
      useGameStore.persist
        .getOptions()
        .partialize?.(useGameStore.getInitialState()) ?? {},
    kept: [
      "bigKeysVisible",
      "items",
      "medallions",
      "presetId",
      "settings",
      "smallKeys",
      "timer",
    ],
    source: raceSourceOf(useAutotrackStore),
  }),
  start: () => {
    // The run follows the other tabs and the stream view through storage
    syncAcrossTabs(useGameStore);
    // The desktop app's global shortcuts are this game's alone: only ALttPR
    // has a keymap. Tested inline, so the site's build drops the import
    // (docs/desktop.md).
    if (import.meta.env.MODE === "desktop") {
      void import("@/games/alttpr/desktop/globalShortcuts")
        .then(({ startGlobalShortcuts }) => startGlobalShortcuts())
        .catch((error: unknown) => {
          console.warn("Global shortcuts are not available:", error);
        });
    }
  },
  store: useGameStore,
};
