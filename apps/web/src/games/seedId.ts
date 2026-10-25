// The id of the seed a run was played on, as its game's ROM states it: the
// seed's hash (ALttPR, alttpr.com's), its name (Super Metroid, Map Rando's)
// or its guid (SMZ3, samus.link's). Kept on the run (`seed`, null when
// unknown) so a later look at the run knows which seed it belongs to.
// Text from outside the page, a save or a shared link, is held to this shape.

/** Printable ASCII, 1 to 64 characters: every id the three generators write. */
export const SEED_ID = /^[\x20-\x7e]{1,64}$/;

/** Whether a value is a seed id. */
export const isSeedId = (value: unknown): value is string =>
  typeof value === "string" && SEED_ID.test(value);

/** A run's store, as far as recording its seed goes. */
type SeedStore<Run extends { seed: string | null }> = {
  getState: () => Run & {
    applyGameNews: (change: (run: Run) => Partial<Run> | null) => void;
  };
};

/**
 * Record the seed the game says it is on as the run's, when that differs from
 * the run's: news of the game's, so no undo step. The history gets it too, but
 * for the snapshots of another seed (a run before a seed switch, which undoing
 * gives back as it was).
 * @param store - The game's run store
 * @param seed - The seed the ROM names, or null when it names none
 */
export const recordSeed = <Run extends { seed: string | null }>(
  store: SeedStore<Run>,
  seed: string | null,
): void => {
  const before = store.getState().seed;
  if (seed === null || seed === before) return;
  store
    .getState()
    .applyGameNews((run) =>
      run.seed === before ? ({ seed } as Partial<Run>) : null,
    );
};
