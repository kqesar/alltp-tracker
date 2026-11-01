// A ROM of another seed than the run's, for a game whose autotracking is the
// shared session (autotrack/gameSession.ts): the check the board and the
// dialog show (games/seedId.ts, `checkRomSeed`), and the player's two answers.
// The follower holds such a ROM's readings unlaid; either answer resyncs it,
// and it lays the reading it held on the run, now that the run is the ROM's.

import { useMemo } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import type { GameAutotrack } from "@/autotrack/gameSession";
import { requestResync } from "@/autotrack/resync";
import { type RomSeedCheck, recordSeed } from "@/games/seedId";

/** What the board's notice and the dialog's line need of a game. */
export type RomSeed = {
  /** The check, while a session is connected; null when there is nothing to say. */
  useCheck: () => RomSeedCheck | null;
  /** Start a new run, New game's, which takes the ROM's seed. */
  startRun: () => void;
  /** The run takes the ROM's seed as its own, and follows it. */
  ignore: () => void;
};

/** A run's store, as far as the ROM's seed goes. */
type RunStore<Run extends { seed: string | null }> = UseBoundStore<
  StoreApi<
    Run & {
      applyGameNews: (change: (run: Run) => Partial<Run> | null) => void;
      reset: () => void;
    }
  >
>;

/**
 * The ROM's seed against a game's run.
 * @param game - The game's id, whose follower the answers resync
 * @param session - The game's autotracking
 * @param store - The game's run store
 * @param check - The game's check of a reading against the run's seed
 */
export const romSeedOf = <Reading, Run extends { seed: string | null }>({
  check,
  game,
  session,
  store,
}: {
  check: (reading: Reading, run: string | null) => RomSeedCheck | null;
  game: string;
  session: GameAutotrack<Reading>;
  store: RunStore<Run>;
}): RomSeed => {
  /** The check of the last reading, when it says the ROM is another seed's. */
  const differs = () => {
    const { reading } = session.useStore.getState();
    const now = reading === null ? null : check(reading, store.getState().seed);
    return now?.kind === "differs" ? now : null;
  };
  return {
    ignore: () => {
      const now = differs();
      if (now === null) return;
      recordSeed(store, now.rom);
      requestResync(game);
    },
    // New game resyncs the follower, which lays the ROM it held
    startRun: () => {
      if (differs() !== null) store.getState().reset();
    },
    useCheck: () => {
      const reading = session.useStore((state) =>
        state.status.code === "connected" ? state.reading : null,
      );
      const run = store((state) => state.seed);
      return useMemo(
        () => (reading === null ? null : check(reading, run)),
        [reading, run],
      );
    },
  };
};
