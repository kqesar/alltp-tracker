// Runs played through each game's real store, for the specs that measure or
// round-trip a shared link: a click or a check every 20 to 100 seconds. Spec
// support only; the app never imports it.

import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { SM_ITEMS } from "@alltp/pack-sm";
import { ITEMS } from "@alltp/pack-smz3";
import { vi } from "vitest";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { exportSave as exportSm, useSmStore } from "@/games/sm/store";
import {
  exportSave as exportSmz3,
  LOCATION_IDS,
  useSmz3Store,
} from "@/games/smz3/store";

/** A reproducible stream of numbers in [0, 1): runs differ by their seed only. */
export const randoms = () => {
  let seed = 7;
  return () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  };
};

/**
 * Play a game's store as a player does, a click or a check every 20 to 100
 * seconds: `share` of what there is to find gets found. The clock moves, so
 * the ALttPR timeline's stamps are as unpredictable as a real run's.
 */
export const play = {
  alttpr: (share: number, random: () => number) => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    const store = useGameStore.getState();
    store.startTimer(Date.now());
    const tick = () =>
      vi.setSystemTime(Date.now() + 20_000 + Math.floor(random() * 80_000));
    const items = Object.keys(store.items).filter(
      (id) => !id.startsWith("chest") && !id.startsWith("boss"),
    );
    for (const id of items) {
      for (let click = 0; click < 4; click++) {
        if (random() >= share) continue;
        tick();
        store.handleItemClick(id);
      }
    }
    for (const id of MAP_LOCATIONS) {
      if (random() >= share) continue;
      tick();
      store.toggleChecks([id]);
    }
    return useGameStore.getState().exportState();
  },
  sm: (share: number, random: () => number) => {
    useSmStore.setState(useSmStore.getInitialState(), true);
    for (const item of SM_ITEMS) {
      for (let n = 0; n < item.max; n++) {
        if (random() < share) useSmStore.getState().step(item.id, 1);
      }
    }
    return exportSm(useSmStore.getState());
  },
  smz3: (share: number, random: () => number) => {
    useSmz3Store.setState(useSmz3Store.getInitialState(), true);
    for (const item of ITEMS) {
      for (let n = 0; n < item.max; n++) {
        if (random() < share) useSmz3Store.getState().step(item.id, 1);
      }
    }
    for (const id of LOCATION_IDS) {
      if (random() < share) useSmz3Store.getState().toggleChecks([id]);
    }
    return exportSmz3(useSmz3Store.getState());
  },
};

export const STAGES = { early: 0.15, late: 0.95, mid: 0.5 } as const;
