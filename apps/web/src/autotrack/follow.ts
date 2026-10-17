// The board following the game, for one autotracking session: each reading
// laid on the run as it comes, and the player's "Sync from game".
//
// A reading lays only its news, what the game says that it did not at the
// last reading: the board changes when the game does, and a mark the player
// changed by hand stays as they left it until the game changes that value
// again. The first reading of a session lays everything, towards progress
// only. Nothing is laid while no game is in play (the title screen, the file
// select): memory there is not the run's.

import {
  type GameView,
  gameView,
  isEmptyView,
  keysInHand,
  mergeView,
  newsOf,
  syncView,
} from "@/autotrack/apply";
import type { AutotrackReading } from "@/autotrack/reading";
import type { RunSettings } from "@/data/presets";
import { createProgress, useGameStore } from "@/stores/gameStore";

/** The board's side of a session. */
export type Follower = {
  /** Lay a reading's news on the board. */
  read: (reading: AutotrackReading) => void;
  /**
   * Set the board to all the game holds, as one undo step.
   * @returns How many values changed, or null before any game in play was read
   */
  sync: () => number | null;
  /**
   * Start a new run of the seed's run type with what the game holds laid on
   * it, as one undo step: undoing it brings the board back as it was.
   */
  switchRun: (presetId: string, settings: RunSettings) => void;
  /**
   * Whether the board holds the game alone: a new run of its run type with
   * what the game holds laid on it, nothing the player marked beyond.
   */
  holdsGameOnly: () => boolean;
};

/** Two records or arrays with the same values under the same keys. */
const sameValues = (a: object, b: object) => {
  const entries = Object.entries(a);
  return (
    entries.length === Object.keys(b).length &&
    entries.every(
      ([key, value]) => (b as Record<string, unknown>)[key] === value,
    )
  );
};

/** Start following the game, for a new session. */
export const createFollower = (): Follower => {
  /** The last reading of a game in play, and the view taken of it. */
  let last: AutotrackReading | null = null;
  let shown: GameView | null = null;
  /** The small keys in hand at the last reading, or null out of play. */
  let hand: Record<number, number> | null = null;
  /** The least small keys found, by grid dungeon index. */
  const found: Record<number, number> = {};

  /**
   * Count the small keys found: memory holds those in hand, which a door
   * spends, so every rise between two readings is a key found. A stretch of
   * play starts from the board's count, or the keys in hand if more.
   */
  const countKeys = (reading: AutotrackReading, smallKeys: number[]) => {
    const now = keysInHand(reading);
    for (const [index, held] of Object.entries(now)) {
      const i = Number(index);
      const before = hand?.[i];
      found[i] =
        before === undefined || found[i] === undefined
          ? Math.max(smallKeys[i] ?? 0, held)
          : found[i] + Math.max(0, held - before);
    }
    hand = now;
  };

  return {
    holdsGameOnly: () => {
      const store = useGameStore.getState();
      const fresh = createProgress(store.presetId, store.settings);
      const game =
        last === null
          ? null
          : syncView(fresh, gameView(last, fresh, found))?.next;
      const run = { ...fresh, ...game };
      return (
        sameValues(run.items, store.items) &&
        sameValues(run.checked, store.checked) &&
        sameValues(run.medallions, store.medallions) &&
        sameValues(run.smallKeys, store.smallKeys)
      );
    },
    read: (reading) => {
      if (reading.progress.started !== true) {
        hand = null;
        return;
      }
      const store = useGameStore.getState();
      countKeys(reading, store.smallKeys);
      const view = gameView(reading, store, found);
      const news = shown === null ? view : newsOf(shown, view);
      last = reading;
      shown = view;
      if (isEmptyView(news)) return;
      store.applyGameNews((board) => mergeView(board, news)?.next ?? null);
    },
    switchRun: (presetId, settings) => {
      const reading = last;
      useGameStore
        .getState()
        .applyRun(presetId, settings, (fresh) =>
          reading === null
            ? null
            : (syncView(fresh, gameView(reading, fresh, found))?.next ?? null),
        );
    },
    sync: () => {
      if (last === null) return null;
      const store = useGameStore.getState();
      const laid = syncView(store, gameView(last, store, found));
      if (laid !== null) store.syncWithGame(laid.next);
      return laid?.count ?? 0;
    },
  };
};
