// The worlds the board draws with art, each skin a chunk of its own fetched
// for its world only: a device tracking an ALttP slot never downloads the
// SMZ3 skin. Every other world, and a world whose skin failed to load, gets
// the generic list.

import { useEffect, useReducer } from "react";
import type { Skin } from "@/games/archipelago/worlds/skin";

const LOADERS: Readonly<Record<string, () => Promise<Skin>>> = {
  "A Link to the Past": () =>
    import("@/games/archipelago/worlds/alttp").then((m) => m.ALTTP_SKIN),
  SMZ3: () =>
    import("@/games/archipelago/worlds/smz3").then((m) => m.SMZ3_SKIN),
  "Super Metroid": () =>
    import("@/games/archipelago/worlds/sm").then((m) => m.SM_SKIN),
};

/** Skins loaded so far, by world; null for one that failed to load. */
const loaded = new Map<string, Skin | null>();
const pending = new Map<string, Promise<Skin | null>>();

/** Whether a world has a skin. */
export const hasSkin = (game: string | undefined): game is string =>
  game !== undefined && Object.hasOwn(LOADERS, game);

/**
 * A world's skin, fetched once; null for a world without one, or when its
 * chunk cannot be fetched (the list then stands in).
 */
export const loadSkin = (game: string | undefined): Promise<Skin | null> => {
  if (!hasSkin(game)) return Promise.resolve(null);
  const done = loaded.get(game);
  if (done !== undefined) return Promise.resolve(done);
  let wait = pending.get(game);
  if (wait === undefined) {
    wait = LOADERS[game]()
      .catch(() => null)
      .then((skin) => {
        loaded.set(game, skin);
        pending.delete(game);
        return skin;
      });
    pending.set(game, wait);
  }
  return wait;
};

/**
 * A world's skin if this page has it already: null for none, undefined while
 * it is still to be fetched (`loadSkin`).
 */
export const skinNow = (game: string | undefined): Skin | null | undefined =>
  hasSkin(game) ? loaded.get(game) : null;

/**
 * A world's skin for a component: null for a world without one, undefined
 * until its chunk arrives, which renders the component again.
 */
export const useSkin = (game: string | undefined): Skin | null | undefined => {
  const [, arrived] = useReducer((n: number) => n + 1, 0);
  const skin = skinNow(game);
  useEffect(() => {
    if (skin !== undefined) return;
    let live = true;
    void loadSkin(game).then(() => {
      if (live) arrived();
    });
    return () => {
      live = false;
    };
  }, [game, skin]);
  return skin;
};
