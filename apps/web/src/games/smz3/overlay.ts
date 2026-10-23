// What SMZ3's run tells the overlay API (docs/overlay-api.md): the items of
// both games the board's grid shows, and the four boss tokens Tourian asks
// for. Never the rewards (pendants and crystals), the keycards, the keys,
// what is checked or the settings; no timer or go mode (the tracker has none
// for this game). A whitelist, as ALttPR's (games/alttpr/overlay.ts). The
// Zelda items go by ALttPR's overlay ids where the two share them.

import { ITEMS } from "@alltp/pack-smz3";
import { BOSS_TOKENS, SM_CELLS, ZELDA_CELLS } from "@/games/smz3/data";
import { type Smz3Progress, useSmz3Store } from "@/games/smz3/store";
import type { OverlayReading, OverlaySource } from "@/overlay/protocol";

const MAX = new Map(ITEMS.map(({ id, max }) => [id, max]));

/** The run as the API tells it: Hyrule's items, then Zebes's, then the tokens. */
export const overlayReadingOf = (run: Smz3Progress): OverlayReading => {
  const items = [...ZELDA_CELLS, ...SM_CELLS].map(({ id, name }) => ({
    id,
    level: run.items[id] ?? 0,
    max: MAX.get(id) ?? 1,
    name,
  }));
  const objectives = BOSS_TOKENS.map(({ id, name }) => ({
    done: (run.items[id] ?? 0) > 0,
    id,
    ms: null,
    name,
  }));
  return {
    fresh:
      items.every(({ level }) => level === 0) &&
      objectives.every(({ done }) => !done),
    state: { game: "smz3", goMode: null, items, objectives, timer: null },
  };
};

export const overlaySource: OverlaySource = {
  read: () => overlayReadingOf(useSmz3Store.getState()),
  subscribe: (listener) => useSmz3Store.subscribe(listener),
};
