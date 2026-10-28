// Runs played through each game's real store, for the specs that measure or
// round-trip a shared link: a click or a check every 20 to 100 seconds. Spec
// support only; the app never imports it.

import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { SM_ITEMS } from "@alltp/pack-sm";
import { ITEMS } from "@alltp/pack-smz3";
import { vi } from "vitest";
import { isTimelineKey } from "@/games/alttpr/logic/timeline";
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
 * The seed each game's played run is on, as its ROM names it: alttpr.com's
 * hash, a Map Rando seed name, samus.link's guid. Real shapes, so the links
 * measured carry what a real run's does.
 */
export const SEEDS = {
  alttpr: "9MQ9gO1wMD",
  sm: "dsjF6gGsH",
  smz3: "8506bbef2c2b4432af378b571c6c9133",
} as const;

/**
 * Play a game's store as a player does, a click or a check every 20 to 100
 * seconds: `share` of what there is to find gets found. The clock moves, so
 * the ALttPR timeline's stamps are as unpredictable as a real run's.
 */
export const play = {
  alttpr: (share: number, random: () => number) => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useGameStore.setState({ seed: SEEDS.alttpr });
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
    useSmStore.setState({ seed: SEEDS.sm });
    for (const item of SM_ITEMS) {
      for (let n = 0; n < item.max; n++) {
        if (random() < share) useSmStore.getState().step(item.id, 1);
      }
    }
    return exportSm(useSmStore.getState());
  },
  smz3: (share: number, random: () => number) => {
    useSmz3Store.setState(useSmz3Store.getInitialState(), true);
    useSmz3Store.setState({ seed: SEEDS.smz3 });
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

/**
 * An ALttPR run autotracked on the game's clock, `stamps` finds long, laid
 * through the store as autotracking lays it: a reading's check, and for
 * about two in five the item it gave, at one instant (so nearly three finds
 * in ten share the instant of the one before), the timer set on the game's
 * clock. That clock stops in every menu, pause and transition and runs a
 * little ahead of real time, so the timer's reading drifts from the instant
 * anew at about one find in three: by a fraction of a second to a few
 * seconds, now and then by minutes (a break), or back a quarter second when
 * the game ran ahead. Readings come half a second to five minutes apart. The
 * shape of a real run of this kind (measured on one, October 2026), which
 * `play.alttpr`, its timer running straight, does not have. Up to about 300
 * finds: every location checked, and the items that came with them.
 */
export const playOnGameClock = (
  stamps: number,
  random: () => number,
): string => {
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({ seed: SEEDS.alttpr });
  const logUniform = (low: number, high: number) =>
    Math.round(low * (high / low) ** random());
  const found = () => Object.keys(useGameStore.getState().timeline).length;
  /** An item's next level that is a find, at random, or null. */
  const nextItem = (): [string, boolean | number] | null => {
    const open = Object.entries(useGameStore.getState().items).flatMap(
      ([id, value]): [string, boolean | number][] => {
        // Whose bits are items: a level is not one more of them
        if (id === "bow" || id === "boomerang") return [];
        if (typeof value === "boolean") {
          return !value && isTimelineKey(`item:${id}`) ? [[id, true]] : [];
        }
        return isTimelineKey(`item:${id}:${value + 1}`)
          ? [[id, value + 1]]
          : [];
      },
    );
    return open[Math.floor(random() * open.length)] ?? null;
  };
  let at = Date.now();
  // The timer starts at the first reading in play: its reading is 0 there
  let drift = at;
  for (const place of MAP_LOCATIONS) {
    if (found() >= stamps) break;
    const gap = logUniform(500, 280_000);
    if (random() < 0.47) {
      const kind = random();
      const change =
        kind < 0.1
          ? -251
          : kind < 0.85
            ? logUniform(200, 12_000)
            : logUniform(20_000, 240_000);
      // A pause never outlasts the time between two readings
      drift += Math.min(change, gap);
    }
    at += gap;
    vi.setSystemTime(at);
    useGameStore.setState({
      timer: { elapsedMs: 0, finished: false, startedAt: drift },
    });
    const item = found() + 1 < stamps && random() < 0.42 ? nextItem() : null;
    useGameStore.getState().applyGameNews((run) => ({
      checked: { ...run.checked, [place]: true },
      ...(item && { items: { ...run.items, [item[0]]: item[1] } }),
    }));
  }
  return useGameStore.getState().exportState();
};
